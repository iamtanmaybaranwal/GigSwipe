import { Router } from 'express';
import { body } from 'express-validator';
import mongoose from 'mongoose';
import { requireAuth, attachUserIfPresent, requireRole } from '../middleware/auth';
import { MILES_TO_METERS } from '../utils/geo';
import { serializeGig } from '../utils/serializeGig';
import { serializePublicUser } from '../utils/serialize';
import { ah, HttpError, requireId, sendValidationError } from '../utils/http';
import GigModel from '../models/Gig';
import UserModel from '../models/User';
import ApplicationModel from '../models/Application';

const router = Router();
const COLORS = ['#7B61FF', '#FF9500', '#34C759', '#FF2D55', '#5AC8FA', '#ff5864'];
export const GIG_CATEGORIES = ['Food & Beverage', 'Marketing', 'Events', 'Creative', 'Retail', 'Admin', 'Tech', 'Other'];
const FEED_LIMIT = 100;

// GET /api/gigs — worker swipe feed (public, but personalised when signed in).
// Uses a MongoDB 2dsphere index + $geoNear — the same "find nearby X" query
// ride-hailing apps use — so gigs inside the viewer's radius come nearest-first.
// Gigs without coordinates (remote, or business hasn't set a location) follow.
// Gigs the signed-in worker already applied to are left out.
router.get('/', attachUserIfPresent, ah(async (req, res) => {
  const viewer = req.user ? await UserModel.findById(req.user.id).lean() : null;

  const excludeIds: mongoose.Types.ObjectId[] = viewer && viewer.role === 'worker'
    ? (await ApplicationModel.find({ workerId: viewer._id }).select('gigId').lean()).map(a => a.gigId)
    : [];
  const notApplied = excludeIds.length ? { _id: { $nin: excludeIds } } : {};

  const hasViewerLocation = viewer?.latitude != null && viewer?.longitude != null;
  if (!hasViewerLocation) {
    const all = await GigModel.find(notApplied).sort({ createdAt: -1 }).limit(FEED_LIMIT).lean();
    return res.json({ gigs: all.map(serializeGig) });
  }

  const [near, withoutLocation] = await Promise.all([
    GigModel.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [viewer!.longitude!, viewer!.latitude!] },
          distanceField: 'distanceMeters',
          spherical: true,
          query: notApplied,
          ...(viewer!.radiusMiles != null && { maxDistance: viewer!.radiusMiles * MILES_TO_METERS }),
        },
      },
      { $limit: FEED_LIMIT },
    ]),
    GigModel.find({ ...notApplied, geo: { $exists: false } }).sort({ createdAt: -1 }).limit(FEED_LIMIT).lean(),
  ]);

  res.json({ gigs: [...near.map(serializeGig), ...withoutLocation.map(serializeGig)] });
}));

// GET /api/gigs/mine — this business's gigs, each with its applicant count
router.get('/mine', requireAuth, ah(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user!.id);
  const [mine, counts] = await Promise.all([
    GigModel.find({ businessId: userId }).sort({ createdAt: -1 }).lean(),
    ApplicationModel.aggregate([
      { $match: { businessId: userId } },
      { $group: { _id: '$gigId', total: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } } } },
    ]),
  ]);
  const byGig = new Map(counts.map(c => [c._id.toString(), c]));
  res.json({
    gigs: mine.map(g => ({
      ...serializeGig(g),
      applicantCount: byGig.get(g._id.toString())?.total ?? 0,
      pendingCount:   byGig.get(g._id.toString())?.pending ?? 0,
    })),
  });
}));

// GET /api/gigs/history — business's posted gigs with hired workers (must be before /:id)
router.get('/history', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const [myGigs, hiredApps] = await Promise.all([
    GigModel.find({ businessId: userId }).sort({ createdAt: -1 }).lean(),
    ApplicationModel.find({ businessId: userId, status: 'hired' }).populate('workerId').lean(),
  ]);

  const history = myGigs.map(gig => {
    const hiredWorkers = hiredApps
      .filter(a => a.gigId.toString() === gig._id.toString() && a.workerId)
      .map(a => serializePublicUser(a.workerId));
    return { gig: serializeGig(gig), hiredWorkers, totalWorkers: hiredWorkers.length };
  });
  res.json({ history });
}));

// GET /api/gigs/:id — single gig detail (public)
router.get('/:id', ah(async (req, res) => {
  const id = requireId(req.params.id, 'Gig');
  const gig = await GigModel.findById(id).lean();
  if (!gig) throw new HttpError(404, 'Gig not found');
  res.json({ gig: serializeGig(gig) });
}));

// POST /api/gigs — create a new gig (job giver only)
router.post(
  '/',
  requireAuth,
  requireRole('business'),
  [
    body('title').isString().trim().notEmpty().withMessage('Title is required').isLength({ max: 80 }).withMessage('Title is too long (max 80)'),
    body('pay').isString().trim().notEmpty().withMessage('Pay is required').isLength({ max: 60 }).withMessage('Pay is too long (max 60)'),
    body('hours').isString().trim().notEmpty().withMessage('Hours are required').isLength({ max: 60 }).withMessage('Hours are too long (max 60)'),
    body('description').isString().trim().notEmpty().withMessage('Description is required').isLength({ max: 2000 }).withMessage('Description is too long (max 2000)'),
    body('category').isIn(GIG_CATEGORIES).withMessage('Please choose a category'),
    body('workMode').isIn(['onsite', 'remote']).withMessage('workMode must be "onsite" or "remote"'),
    body('location').optional({ values: 'null' }).isString().trim().isLength({ max: 120 }).withMessage('Location is too long'),
  ],
  ah(async (req, res) => {
    if (sendValidationError(req, res)) return;
    const user = await UserModel.findById(req.user!.id).lean();
    if (!user) throw new HttpError(401, 'Account not found. Please sign in again.');

    const { title, pay, hours, description, category, location, workMode } = req.body;
    // Remote gigs never carry coordinates — there's no travel distance to match on.
    const isOnsite = workMode === 'onsite';

    const gig = await GigModel.create({
      businessId:    user._id,
      title, pay, hours, description, category, workMode,
      location:      isOnsite ? (location?.trim() || user.locationLabel || user.location || 'Location TBD') : 'Remote',
      businessName:  user.businessName || user.name,
      businessColor: user.avatarColor || COLORS[Math.floor(Math.random() * COLORS.length)],
      ...(isOnsite && user.latitude != null && user.longitude != null && {
        geo: { type: 'Point', coordinates: [user.longitude, user.latitude] },
      }),
    });

    res.status(201).json({ gig: serializeGig(gig.toObject()) });
  })
);

// DELETE /api/gigs/:id — removes the gig and closes its pending applications.
// Accepted/hired applications are kept so chat history and ratings survive.
router.delete('/:id', requireAuth, ah(async (req, res) => {
  const id = requireId(req.params.id, 'Gig');
  const gig = await GigModel.findById(id);
  if (!gig) throw new HttpError(404, 'Gig not found');
  if (gig.businessId.toString() !== req.user!.id) throw new HttpError(403, 'Not your gig');
  await ApplicationModel.updateMany({ gigId: gig._id, status: 'pending' }, { status: 'rejected' });
  await gig.deleteOne();
  res.json({ success: true });
}));

export default router;
