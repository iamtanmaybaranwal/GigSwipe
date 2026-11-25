import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { ah, HttpError, requireId } from '../utils/http';
import { serializeMessage } from '../utils/serialize';
import { loadParticipantApplication, markRead, postMessage } from '../services/chat';
import MessageModel from '../models/Message';

const router = Router();
const PAGE_SIZE = 200;

// GET /api/chat/:applicationId — messages in a thread (oldest → newest).
// Pass ?before=<ISO timestamp> to load older pages. Marks the thread as read.
router.get('/:applicationId', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const applicationId = requireId(req.params.applicationId, 'Conversation');
  const app = await loadParticipantApplication(applicationId, userId);
  if (!app) throw new HttpError(403, 'You are not part of this conversation');

  const before = typeof req.query.before === 'string' ? new Date(req.query.before) : null;
  const filter: Record<string, unknown> = { applicationId };
  if (before && !isNaN(before.getTime())) filter.createdAt = { $lt: before };

  const newestFirst = await MessageModel.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE).lean();
  if (!before) await markRead(app, userId);

  res.json({
    messages: newestFirst.reverse().map(serializeMessage),
    hasMore: newestFirst.length === PAGE_SIZE,
  });
}));

// POST /api/chat/:applicationId/read — mark the thread as read (used while the chat is open)
router.post('/:applicationId/read', requireAuth, ah(async (req, res) => {
  const applicationId = requireId(req.params.applicationId, 'Conversation');
  const app = await loadParticipantApplication(applicationId, req.user!.id);
  if (!app) throw new HttpError(403, 'You are not part of this conversation');
  await markRead(app, req.user!.id);
  res.json({ success: true });
}));

// POST /api/chat/:applicationId/message — REST fallback when the socket is down
router.post('/:applicationId/message', requireAuth, ah(async (req, res) => {
  const applicationId = requireId(req.params.applicationId, 'Conversation');
  const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId.slice(0, 64) : undefined;
  const message = await postMessage(applicationId, req.user!.id, String(req.body?.text ?? ''), clientId);
  res.status(201).json({ message });
}));

export default router;
