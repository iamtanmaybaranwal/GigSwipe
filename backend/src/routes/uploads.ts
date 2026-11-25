// Image uploads (profile photos, gig photos).
// The app resizes photos before sending them as base64 JSON, which avoids
// multipart parsing and keeps uploads small (~100–400 KB).
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { ah, HttpError, requireId } from '../utils/http';
import UploadModel from '../models/Upload';

const router = Router();
const MAX_BYTES = 3 * 1024 * 1024;
const DAILY_LIMIT = 60;

/** Detects the real image type from the file's first bytes (never trust the client's label). */
function sniff(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

// POST /api/uploads { data: base64 } → { id, url }
router.post('/', requireAuth, ah(async (req, res) => {
  const raw = typeof req.body?.data === 'string' ? req.body.data.replace(/^data:[^;]+;base64,/, '') : '';
  if (!raw) throw new HttpError(400, 'No image was sent.');
  const data = Buffer.from(raw, 'base64');
  if (!data.length) throw new HttpError(400, 'The image could not be read.');
  if (data.length > MAX_BYTES) throw new HttpError(413, 'This photo is too large. Please choose a smaller one.');
  const contentType = sniff(data);
  if (!contentType) throw new HttpError(400, 'Only JPEG, PNG or WebP photos are supported.');

  const since = new Date(Date.now() - 86_400_000);
  if ((await UploadModel.countDocuments({ ownerId: req.user!.id, createdAt: { $gte: since } })) >= DAILY_LIMIT) {
    throw new HttpError(429, 'You have uploaded a lot of photos today. Please try again tomorrow.');
  }

  const doc = await UploadModel.create({ ownerId: req.user!.id, contentType, size: data.length, data });
  const id = String(doc._id);
  res.status(201).json({ id, url: `/api/uploads/${id}` });
}));

// GET /api/uploads/:id — public, cached forever (an id's bytes never change)
router.get('/:id', ah(async (req, res) => {
  const id = requireId(req.params.id, 'Photo');
  const doc = await UploadModel.findById(id).select('contentType data'); // not lean: keeps `data` a real Buffer
  if (!doc) throw new HttpError(404, 'Photo not found');
  res.set({
    'Content-Type': doc.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(Buffer.from(doc.data));
}));

export default router;
