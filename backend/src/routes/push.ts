// Register / unregister a device for push notifications.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { ah, HttpError } from '../utils/http';
import PushTokenModel from '../models/PushToken';
import { pushStatus } from '../services/push';

const router = Router();
const MAX_DEVICES_PER_USER = 10;

// GET /api/push/config — what the app needs to subscribe (public key for Web Push)
router.get('/config', (_req, res) => {
  const st = pushStatus();
  res.json({ webPushPublicKey: st.webPublicKey, web: st.web, android: st.android });
});

// POST /api/push/register
//   { platform: 'web', subscription: { endpoint, keys: { p256dh, auth } }, lang }
//   { platform: 'android', token, lang }
router.post('/register', requireAuth, ah(async (req, res) => {
  const { platform, subscription, token, lang } = req.body ?? {};
  const language = lang === 'hi' ? 'hi' : 'en';
  let doc: { platform: 'web' | 'android'; token: string; keys?: { p256dh: string; auth: string } };
  if (platform === 'web') {
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys;
    if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 1000 ||
        typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
      throw new HttpError(400, 'Invalid push subscription');
    }
    doc = { platform, token: endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
  } else if (platform === 'android') {
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) throw new HttpError(400, 'Invalid push token');
    doc = { platform, token };
  } else {
    throw new HttpError(400, 'platform must be "web" or "android"');
  }

  // A device belongs to whoever signed in on it last
  await PushTokenModel.findOneAndUpdate(
    { token: doc.token },
    { ...doc, userId: req.user!.id, lang: language },
    { upsert: true, setDefaultsOnInsert: true }
  );
  // Keep the newest devices only
  const extra = await PushTokenModel.find({ userId: req.user!.id }).sort({ updatedAt: -1 }).skip(MAX_DEVICES_PER_USER).select('_id');
  if (extra.length) await PushTokenModel.deleteMany({ _id: { $in: extra.map(d => d._id) } });
  res.json({ success: true });
}));

// POST /api/push/unregister { token } — on sign-out (token = FCM token or Web Push endpoint)
router.post('/unregister', requireAuth, ah(async (req, res) => {
  const token = req.body?.token;
  if (typeof token === 'string') await PushTokenModel.deleteOne({ token, userId: req.user!.id });
  res.json({ success: true });
}));

export default router;
