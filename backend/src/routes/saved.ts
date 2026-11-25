// Saved gigs ("decide later") for job seekers.
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { ah, HttpError, requireId } from '../utils/http';
import { serializeGig } from '../utils/serializeGig';
import SavedGigModel from '../models/SavedGig';
import GigModel from '../models/Gig';
import ApplicationModel from '../models/Application';

const router = Router();
const MAX_SAVED = 200;

// GET /api/saved — saved gigs, newest first. Gigs that were deleted are dropped;
// filled, closed or ended ones are still returned (marked) so the list explains itself.
router.get('/', requireAuth, requireRole('worker'), ah(async (req, res) => {
  const userId = req.user!.id;
  const saved = await SavedGigModel.find({ userId }).sort({ createdAt: -1 }).limit(MAX_SAVED).lean();
  const gigIds = saved.map(s => s.gigId);
  const [gigs, applied] = await Promise.all([
    GigModel.find({ _id: { $in: gigIds } }).lean(),
    ApplicationModel.find({ workerId: userId, gigId: { $in: gigIds } }).select('gigId').lean(),
  ]);
  const byId = new Map(gigs.map(g => [g._id.toString(), g]));
  const appliedIds = new Set(applied.map(a => a.gigId.toString()));

  const missing = saved.filter(s => !byId.has(s.gigId.toString())).map(s => s._id);
  if (missing.length) await SavedGigModel.deleteMany({ _id: { $in: missing } });

  res.json({
    gigs: saved
      .filter(s => byId.has(s.gigId.toString()))
      .map(s => ({
        ...serializeGig(byId.get(s.gigId.toString())),
        savedAt: s.createdAt.toISOString(),
        applied: appliedIds.has(s.gigId.toString()),
      })),
  });
}));

// POST /api/saved { gigId } — idempotent
router.post('/', requireAuth, requireRole('worker'), ah(async (req, res) => {
  const userId = req.user!.id;
  const gigId = requireId(req.body?.gigId, 'Gig');
  if (!(await GigModel.exists({ _id: gigId }))) throw new HttpError(404, 'This gig is no longer available');
  if ((await SavedGigModel.countDocuments({ userId })) >= MAX_SAVED) {
    throw new HttpError(400, `You can save up to ${MAX_SAVED} gigs. Remove some first.`);
  }
  await SavedGigModel.updateOne({ userId, gigId }, { $setOnInsert: { userId, gigId } }, { upsert: true });
  res.status(201).json({ success: true });
}));

// DELETE /api/saved/:gigId — idempotent
router.delete('/:gigId', requireAuth, requireRole('worker'), ah(async (req, res) => {
  const gigId = requireId(req.params.gigId, 'Gig');
  await SavedGigModel.deleteOne({ userId: req.user!.id, gigId });
  res.json({ success: true });
}));

export default router;
