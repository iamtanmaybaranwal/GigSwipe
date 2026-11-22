import 'dotenv/config'; // must be first — loads .env before anything else reads process.env

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { connectDB } from './db';
import { applications, messages, users } from './store';
import authRoutes from './routes/auth';
import gigRoutes from './routes/gigs';
import applicationRoutes from './routes/applications';
import chatRoutes from './routes/chat';
import ratingRoutes from './routes/ratings';
import userRoutes    from './routes/users';
import type { Message } from './types';
import UserModel from './models/User';
import GigModel from './models/Gig';

const app = express();
const httpServer = createServer(app);

// Allow all origins so Expo Go on any device can connect
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const gigCount = mongoose.connection.readyState === 1 ? await GigModel.countDocuments() : 0;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    counts: { users: users.size, gigs: gigCount, applications: applications.size },
  });
});

// ── MongoDB connection test ───────────────────────────────────────────────────
app.get('/api/db-test', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, message: 'MongoDB not connected' });
    }
    // A real read to prove the connection is live, not just the flag
    const count = await UserModel.countDocuments();
    res.json({ ok: true, message: 'MongoDB is connected and working', usersInDB: count });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── REST routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/gigs',         gigRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/chat',         chatRoutes);
app.use('/api/ratings',      ratingRoutes);
app.use('/api/users',        userRoutes);

// ── Socket.io — real-time chat ────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on('join_chat', (applicationId: string) => {
    socket.join(applicationId);
    console.log(`[socket] ${socket.id} joined room ${applicationId}`);
  });

  socket.on('send_message', (data: {
    applicationId: string;
    senderId: string;
    text: string;
  }) => {
    const { applicationId, senderId, text } = data;
    if (!applicationId || !senderId || !text?.trim()) return;

    const application = applications.get(applicationId);
    if (!application) return;

    if (application.workerId !== senderId && application.businessId !== senderId) return;

    const sender = users.get(senderId);
    const msg: Message = {
      id: uuidv4(),
      applicationId,
      senderId,
      senderName: sender?.name ?? 'Unknown',
      senderRole: sender?.role ?? 'worker',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const thread = messages.get(applicationId) ?? [];
    thread.push(msg);
    messages.set(applicationId, thread);

    io.to(applicationId).emit('new_message', msg);
    console.log(`[socket] message in room ${applicationId}: "${msg.text}"`);
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// ── Start (connect DB first, then listen) ─────────────────────────────────────
async function start() {
  try {
    await connectDB();

    const PORT = process.env.PORT ?? 3001;
    httpServer.listen(PORT, () => {
      console.log(`\n  GigSwipe backend is running!`);
      console.log(`   REST API  → http://localhost:${PORT}/api`);
      console.log(`   DB test   → http://localhost:${PORT}/api/db-test`);
      console.log(`   Health    → http://localhost:${PORT}/health`);
      console.log(`   Socket.io → ws://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('[startup] Failed to connect to MongoDB — server will not start:', err);
    process.exit(1);
  }
}

start();
