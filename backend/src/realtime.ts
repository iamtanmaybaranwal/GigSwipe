// Socket.io — real-time chat and live list updates.
//
// Every socket must authenticate with the same JWT the REST API uses
// (`io(url, { auth: { token } })`). The sender of a message is always taken
// from the verified token — never from the client payload — so nobody can
// post messages as someone else.

import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { verifyToken } from './middleware/auth';
import { isId } from './utils/http';
import { postMessage, loadParticipantApplication } from './services/chat';

let io: Server | null = null;

const userRoom = (userId: string) => `user:${userId}`;

/** Push an event to every device a user is signed in on. */
export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}

const roleRoom = (role: string) => `role:${role}`;

/** Push an event to everyone signed in with a role ('worker' | 'business'). */
export function emitToRole(role: 'worker' | 'business', event: string, payload: unknown) {
  io?.to(roleRoom(role)).emit(event, payload);
}

/** Push an event to everyone viewing a chat thread. */
export function emitToChat(applicationId: string, event: string, payload: unknown) {
  io?.to(applicationId).emit(event, payload);
}

type Ack = (res: { ok: boolean; error?: string; [k: string]: unknown }) => void;
const safeAck = (ack: unknown): Ack => (typeof ack === 'function' ? (ack as Ack) : () => {});

export function initRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth as any)?.token;
    const user = typeof token === 'string' ? verifyToken(token) : null;
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const me = socket.data.user as { id: string; role: 'worker' | 'business' };
    socket.join(userRoom(me.id));
    socket.join(roleRoom(me.role)); // e.g. "a gig was closed" goes to every job seeker

    socket.on('join_chat', async (applicationId: unknown, ack?: unknown) => {
      const reply = safeAck(ack);
      try {
        if (!isId(applicationId)) return reply({ ok: false, error: 'Conversation not found' });
        const app = await loadParticipantApplication(applicationId, me.id);
        if (!app) return reply({ ok: false, error: 'You are not part of this conversation' });
        socket.join(applicationId);
        reply({ ok: true });
      } catch (err) {
        console.error('[socket/join_chat]', err);
        reply({ ok: false, error: 'Could not join conversation' });
      }
    });

    socket.on('leave_chat', (applicationId: unknown) => {
      if (typeof applicationId === 'string') socket.leave(applicationId);
    });

    socket.on('send_message', async (data: any, ack?: unknown) => {
      const reply = safeAck(ack);
      try {
        const applicationId = data?.applicationId;
        const text = typeof data?.text === 'string' ? data.text : '';
        const clientId = typeof data?.clientId === 'string' ? data.clientId.slice(0, 64) : undefined;
        if (!isId(applicationId)) return reply({ ok: false, error: 'Conversation not found' });

        const message = await postMessage(applicationId, me.id, text, clientId);
        reply({ ok: true, message });
      } catch (err: any) {
        reply({ ok: false, error: err?.status ? err.message : 'Could not send message' });
        if (!err?.status) console.error('[socket/send_message]', err);
      }
    });
  });

  return io;
}
