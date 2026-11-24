import 'dotenv/config'; // must be first — loads .env before anything else reads process.env

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { connectDB } from './db';
import { initRealtime } from './realtime';
import { errorHandler } from './utils/http';
import authRoutes from './routes/auth';
import gigRoutes from './routes/gigs';
import applicationRoutes from './routes/applications';
import chatRoutes from './routes/chat';
import ratingRoutes from './routes/ratings';
import userRoutes from './routes/users';
import geoRoutes from './routes/geo';
import UserModel from './models/User';
import GigModel from './models/Gig';
import ApplicationModel from './models/Application';

// ── Fail fast on missing configuration ────────────────────────────────────────
for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`[startup] ${key} is not set in backend/.env — the server cannot start.`);
    process.exit(1);
  }
}
if ((process.env.JWT_SECRET ?? '').length < 32) {
  console.warn('[startup] JWT_SECRET is shorter than 32 characters. Use a long random value in production.');
}

const app = express();
const httpServer = createServer(app);
initRealtime(httpServer);

// Behind a load balancer / reverse proxy (Render, Railway, Nginx…) set TRUST_PROXY=1
// so rate limiting sees the real client IP.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Basic abuse protection: a general limit for the whole API, and a much
// stricter one for login/register to slow down password guessing.
app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  const [users, gigs, applications] = connected
    ? await Promise.all([UserModel.estimatedDocumentCount(), GigModel.estimatedDocumentCount(), ApplicationModel.estimatedDocumentCount()])
    : [0, 0, 0];
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    db: connected ? 'connected' : 'disconnected',
    counts: { users, gigs, applications },
  });
});

app.get('/api/db-test', async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ ok: false, message: 'MongoDB not connected' });
  }
  const count = await UserModel.countDocuments();
  res.json({ ok: true, message: 'MongoDB is connected and working', usersInDB: count });
});

// ── REST routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/gigs',         gigRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/chat',         chatRoutes);
app.use('/api/ratings',      ratingRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/geo',          geoRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

// ── Start (connect DB first, then listen) ─────────────────────────────────────
async function start() {
  try {
    await connectDB(); // Mongoose builds the schema indexes (geo, unique, lookup) automatically

    const PORT = Number(process.env.PORT ?? 3001);
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n  GigSwipe backend is running!`);
      console.log(`   REST API  → http://localhost:${PORT}/api`);
      console.log(`   Health    → http://localhost:${PORT}/health`);
      console.log(`   Socket.io → ws://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('[startup] Failed to start:', err);
    process.exit(1);
  }
}

function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received — closing connections…`);
  httpServer.close(() => {
    mongoose.connection.close().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));

if (require.main === module) start();

export { app, httpServer };
