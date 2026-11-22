import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { applications, users, messages } from '../store';
import { requireAuth } from '../middleware/auth';
import type { Message } from '../types';

const router = Router();

// GET /api/chat/:applicationId — fetch all messages in a thread
router.get('/:applicationId', requireAuth, (req, res) => {
  const userId = req.user!.id;

  const app = applications.get(req.params.applicationId);
  if (!app) return res.status(404).json({ error: 'Conversation not found' });

  if (app.workerId !== userId && app.businessId !== userId) {
    return res.status(403).json({ error: 'You are not part of this conversation' });
  }

  const thread = messages.get(req.params.applicationId) ?? [];
  res.json({ messages: thread });
});

// POST /api/chat/:applicationId/message — REST fallback for sending a message
// (Socket.io is preferred for real-time; this endpoint is the backup)
router.post('/:applicationId/message', requireAuth, (req, res) => {
  const userId = req.user!.id;

  const app = applications.get(req.params.applicationId);
  if (!app) return res.status(404).json({ error: 'Conversation not found' });

  if (app.workerId !== userId && app.businessId !== userId) {
    return res.status(403).json({ error: 'You are not part of this conversation' });
  }

  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  const sender = users.get(userId);
  const msg: Message = {
    id:            uuidv4(),
    applicationId: req.params.applicationId,
    senderId:      userId,
    senderName:    sender?.name ?? 'Unknown',
    senderRole:    sender?.role ?? 'worker',
    text:          text.trim(),
    timestamp:     new Date().toISOString(),
  };

  const thread = messages.get(req.params.applicationId) ?? [];
  thread.push(msg);
  messages.set(req.params.applicationId, thread);

  res.status(201).json({ message: msg });
});

export default router;
