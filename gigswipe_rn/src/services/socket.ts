// Socket.io client — real-time chat and live list updates.
// One shared, authenticated connection for the whole app. Screens subscribe
// through onSocketEvent(), which works even before the socket has connected
// and keeps working across reconnects.

import { io, type Socket } from 'socket.io-client';
import { BASE_URL } from '../config';
import type { Message } from '../api/types';

type Handler = (payload: any) => void;

let socket: Socket | null = null;
let currentToken: string | null = null;
const joinedRooms = new Set<string>();
const listeners = new Map<string, Set<Handler>>();

function dispatch(event: string, payload?: unknown) {
  listeners.get(event)?.forEach(fn => {
    try { fn(payload); } catch (e) { console.warn('[socket] listener error', e); }
  });
}

export function connectSocket(token: string) {
  if (socket && currentToken === token) return;
  disconnectSocket();
  currentToken = token;

  socket = io(BASE_URL, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    // Rooms are lost when the connection drops — re-join after every (re)connect
    joinedRooms.forEach(id => socket?.emit('join_chat', id));
    dispatch('connection_change', true);
  });
  socket.on('disconnect', () => dispatch('connection_change', false));
  socket.onAny((event: string, payload: unknown) => dispatch(event, payload));
}

export function disconnectSocket() {
  joinedRooms.clear();
  currentToken = null;
  if (socket) {
    socket.removeAllListeners();
    socket.offAny();
    socket.disconnect();
    socket = null;
  }
}

export const isSocketConnected = () => !!socket?.connected;

export function joinChat(applicationId: string) {
  joinedRooms.add(applicationId);
  if (socket?.connected) socket.emit('join_chat', applicationId);
}

export function leaveChat(applicationId: string) {
  joinedRooms.delete(applicationId);
  if (socket?.connected) socket.emit('leave_chat', applicationId);
}

/** Sends over the socket and waits for the server to confirm it was saved. */
export async function sendSocketMessage(applicationId: string, text: string, clientId: string): Promise<Message> {
  if (!socket?.connected) throw new Error('offline');
  const res: any = await socket.timeout(8000).emitWithAck('send_message', { applicationId, text, clientId });
  if (!res?.ok) {
    const err: any = new Error(res?.error ?? 'Could not send message');
    err.fromServer = true;
    throw err;
  }
  return res.message as Message;
}

/**
 * Subscribe to a server event ('new_message', 'inbox_update', 'application_update')
 * or 'connection_change'. Returns an unsubscribe function.
 */
export function onSocketEvent<T = any>(event: string, handler: (payload: T) => void): () => void {
  let set = listeners.get(event);
  if (!set) { set = new Set(); listeners.set(event, set); }
  set.add(handler as Handler);
  return () => { listeners.get(event)?.delete(handler as Handler); };
}
