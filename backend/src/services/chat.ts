import ApplicationModel from '../models/Application';
import MessageModel from '../models/Message';
import UserModel from '../models/User';
import { HttpError } from '../utils/http';
import { serializeMessage } from '../utils/serialize';
import { emitToChat, emitToUser } from '../realtime';

export const MAX_MESSAGE_LENGTH = 2000;

/** Returns the application only if `userId` is its worker or business. */
export async function loadParticipantApplication(applicationId: string, userId: string) {
  const app = await ApplicationModel.findById(applicationId);
  if (!app) return null;
  if (app.workerId.toString() !== userId && app.businessId.toString() !== userId) return null;
  return app;
}

/**
 * Saves a message, updates the conversation summary and pushes it live.
 * Used by both the socket handler and the REST fallback so they behave identically.
 */
export async function postMessage(applicationId: string, senderId: string, rawText: string, clientId?: string) {
  const text = (rawText ?? '').trim();
  if (!text) throw new HttpError(400, 'text is required');
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(400, `Messages can be at most ${MAX_MESSAGE_LENGTH} characters`);
  }

  const app = await ApplicationModel.findById(applicationId);
  if (!app) throw new HttpError(404, 'Conversation not found');
  const isWorker = app.workerId.toString() === senderId;
  const isBusiness = app.businessId.toString() === senderId;
  if (!isWorker && !isBusiness) throw new HttpError(403, 'You are not part of this conversation');
  if (app.status === 'rejected') throw new HttpError(400, 'This application was closed, so new messages cannot be sent.');

  const sender = await UserModel.findById(senderId).select('name role');
  if (!sender) throw new HttpError(401, 'Account not found. Please sign in again.');

  const doc = await MessageModel.create({
    applicationId: app._id,
    senderId,
    senderName: sender.name,
    senderRole: sender.role,
    text,
  });

  const now = doc.createdAt;
  await ApplicationModel.updateOne(
    { _id: app._id },
    {
      lastMessage: text.slice(0, 200),
      lastMessageAt: now,
      // The sender has obviously read everything up to their own message
      ...(isWorker ? { workerLastReadAt: now } : { businessLastReadAt: now }),
    }
  );

  const message = { ...serializeMessage(doc), ...(clientId && { clientId }) };
  emitToChat(applicationId, 'new_message', message);
  const otherId = isWorker ? app.businessId.toString() : app.workerId.toString();
  emitToUser(otherId, 'inbox_update', { applicationId });
  emitToUser(senderId, 'inbox_update', { applicationId });
  return message;
}

/** Number of messages from the other party the viewer has not read yet. */
export async function unreadCountFor(app: any, viewerId: string): Promise<number> {
  const isWorker = app.workerId.toString() === viewerId;
  const lastRead: Date | undefined = isWorker ? app.workerLastReadAt : app.businessLastReadAt;
  if (!app.lastMessageAt) return 0;
  if (lastRead && new Date(app.lastMessageAt) <= new Date(lastRead)) return 0;
  return MessageModel.countDocuments({
    applicationId: app._id,
    senderId: { $ne: viewerId },
    ...(lastRead && { createdAt: { $gt: lastRead } }),
  });
}

export async function markRead(app: any, viewerId: string) {
  const isWorker = app.workerId.toString() === viewerId;
  await ApplicationModel.updateOne(
    { _id: app._id },
    isWorker ? { workerLastReadAt: new Date() } : { businessLastReadAt: new Date() }
  );
}
