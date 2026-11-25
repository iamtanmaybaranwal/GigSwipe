import { Router } from 'express';
import { body, type ValidationChain } from 'express-validator';
import mongoose from 'mongoose';
import { requireAuth, attachUserIfPresent, requireRole } from '../middleware/auth';
import { MILES_TO_METERS } from '../utils/geo';
import { serializeGig } from '../utils/serializeGig';
import { serializePublicUser } from '../utils/serialize';
import { ah, HttpError, requireId, sendValidationError } from '../utils/http';
import { assertOwnUploads, statusForOpenings } from '../services/gigs';
import { announceGigClosed, announceNewGig } from '../services/gigAlerts';
import GigModel, { PAY_UNITS } from '../models/Gig';
import UserModel from '../models/User';
import ApplicationModel from '../models/Application';
import SavedGigModel from '../models/SavedGig';
import InviteModel from '../models/Invite';

const router = Router();
const COLORS = ['#7B61FF', '#FF9500', '#34C759', '#FF2D55', '#5AC8FA', '#ff5864'];
export const GIG_CATEGORIES = [
  'Food & Beverage', 'Marketing', 'Events', 'Creative', 'Retail', 'Admin', 'Tech',
  'Delivery & Driving', 'Cleaning & Household', 'Construction & Repair', 'Care & Tutoring', 'Other',
];
const FEED_LIMIT = 100;
const MAX_PHOTOS = 6;
const DAY_MS = 86_400_000;
const CURRENCY = process.env.CURRENCY_SYMBOL || '₹';
const UNIT_SUFFIX: Record<string, string> = { hour: '/hr', day: '/day', week: '/week', month: '/month', fixed: ' total' };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const formatPay = (amount: number, unit: string) =>
  `${CURRENCY}${Number.isInteger(amount) ? amount.toLocaleString('en-IN') : amount.toFixed(2)}${UNIT_SUFFIX[unit] ?? ''}`;

/** Still running or upcoming: not ended. Gigs without dates never expire. */
const notExpired = (now: Date) => ({
  $or: [
    { endAt: { $gt: now } },
    { endAt: null, startAt: { $gt: now } },
    { endAt: null, startAt: null },
  ],
});

// ── GET /api/gigs — job seeker swipe feed ─────────────────────────────────────
// Public, but personalised when signed in. Uses a MongoDB 2dsphere index +
// $geoNear so gigs inside the viewer's range come nearest-first; gigs without
// coordinates (remote, or no business location) follow.
// Leaves out gigs the viewer already applied to or saved, and gigs that are
// filled, closed or over.
//
// Optional filters: q, category (comma-separated), mode (onsite|remote),
// minPay + payUnit, from + to (ISO dates: gig overlaps this window), radius (miles).
router.get('/', attachUserIfPresent, ah(async (req, res) => {
  const viewer = req.user ? await UserModel.findById(req.user.id).lean() : null;
  const qs = req.query as Record<string, string | undefined>;
  const now = new Date();

  // $nin (not = 'open') so gigs saved before `status` existed still count as open
  const and: Record<string, unknown>[] = [{ status: { $nin: ['filled', 'closed'] } }, notExpired(now)];

  if (viewer?.role === 'worker') {
    const [applied, saved] = await Promise.all([
      ApplicationModel.find({ workerId: viewer._id }).select('gigId').lean(),
      SavedGigModel.find({ userId: viewer._id }).select('gigId').lean(),
    ]);
    const exclude = [...applied, ...saved].map(a => a.gigId);
    if (exclude.length) and.push({ _id: { $nin: exclude } });
  }

  const q = (qs.q ?? '').trim().slice(0, 60);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }, { businessName: rx }, { category: rx }, { location: rx }] });
  }
  const categories = (qs.category ?? '').split(',').map(c => c.trim()).filter(c => GIG_CATEGORIES.includes(c));
  if (categories.length) and.push({ category: { $in: categories } });

  const mode = qs.mode === 'onsite' || qs.mode === 'remote' ? qs.mode : null;
  if (mode) and.push({ workMode: mode });

  const minPay = Number(qs.minPay);
  if (qs.payUnit && PAY_UNITS.includes(qs.payUnit as any)) {
    and.push({ payUnit: qs.payUnit, ...(minPay > 0 && { payAmount: { $gte: minPay } }) });
  }

  const from = qs.from ? new Date(qs.from) : null;
  const to = qs.to ? new Date(qs.to) : null;
  if (from && to && !isNaN(+from) && !isNaN(+to) && to > from) {
    and.push({ startAt: { $lt: to }, endAt: { $gte: from } });
  }

  const filter = { $and: and };
  const radiusParam = Number(qs.radius);
  const radiusMiles = radiusParam >= 1 && radiusParam <= 500 ? radiusParam : viewer?.radiusMiles;
  const hasViewerLocation = viewer?.latitude != null && viewer?.longitude != null;

  if (!hasViewerLocation || mode === 'remote') {
    const all = await GigModel.find(filter).sort({ createdAt: -1 }).limit(FEED_LIMIT).lean();
    return res.json({ gigs: all.map(serializeGig) });
  }

  const [near, withoutLocation] = await Promise.all([
    GigModel.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [viewer!.longitude!, viewer!.latitude!] },
          distanceField: 'distanceMeters',
          spherical: true,
          query: filter,
          ...(radiusMiles != null && { maxDistance: radiusMiles * MILES_TO_METERS }),
        },
      },
      { $limit: FEED_LIMIT },
    ]),
    mode === 'onsite'
      ? Promise.resolve([])
      : GigModel.find({ $and: [...and, { geo: { $exists: false } }] }).sort({ createdAt: -1 }).limit(FEED_LIMIT).lean(),
  ]);

  res.json({ gigs: [...near.map(serializeGig), ...withoutLocation.map(serializeGig)] });
}));

// GET /api/gigs/categories — the list the app shows in pickers and filters
router.get('/categories', (_req, res) => { res.json({ categories: GIG_CATEGORIES, currency: CURRENCY }); });

// GET /api/gigs/mine — this business's gigs, each with its applicant counts
router.get('/mine', requireAuth, ah(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user!.id);
  const [mine, counts] = await Promise.all([
    GigModel.find({ businessId: userId }).sort({ createdAt: -1 }).limit(300).lean(),
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

// GET /api/gigs/:id — single gig detail (public). Signed-in job seekers also
// get whether they saved it and their application id, if any.
router.get('/:id', attachUserIfPresent, ah(async (req, res) => {
  const id = requireId(req.params.id, 'Gig');
  const gig = await GigModel.findById(id).lean();
  if (!gig) throw new HttpError(404, 'Gig not found');

  let viewer: { saved: boolean; applicationId: string | null } | undefined;
  if (req.user?.role === 'worker') {
    const [saved, app] = await Promise.all([
      SavedGigModel.exists({ userId: req.user.id, gigId: id }),
      ApplicationModel.findOne({ gigId: id, workerId: req.user.id }).select('_id').lean(),
    ]);
    viewer = { saved: !!saved, applicationId: app ? String(app._id) : null };
  }
  res.json({ gig: serializeGig(gig), viewer });
}));

// ── Create / edit validation ─────────────────────────────────────────────────
function gigRules(isUpdate: boolean): ValidationChain[] {
  const f = (name: string) => (isUpdate ? body(name).optional() : body(name));
  return [
    f('title').isString().trim().notEmpty().withMessage('Title is required').isLength({ max: 80 }).withMessage('Title is too long (max 80)'),
    f('payAmount').isFloat({ gt: 0, max: 10_000_000 }).withMessage('Enter how much it pays').toFloat(),
    f('payUnit').isIn(PAY_UNITS).withMessage('Choose how the pay is counted (per hour, day…)'),
    body('pay').optional({ values: 'null' }).isString().trim().isLength({ max: 60 }).withMessage('Pay text is too long'),
    body('hours').optional({ values: 'null' }).isString().trim().isLength({ max: 120 }).withMessage('Schedule notes are too long (max 120)'),
    f('description').isString().trim().notEmpty().withMessage('Description is required').isLength({ max: 2000 }).withMessage('Description is too long (max 2000)'),
    f('category').isIn(GIG_CATEGORIES).withMessage('Please choose a category'),
    f('workMode').isIn(['onsite', 'remote']).withMessage('workMode must be "onsite" or "remote"'),
    body('location').optional({ values: 'null' }).isString().trim().isLength({ max: 120 }).withMessage('Location is too long'),
    body('startAt').optional({ values: 'null' }).isISO8601().withMessage('Invalid start time').toDate(),
    body('endAt').optional({ values: 'null' }).isISO8601().withMessage('Invalid end time').toDate(),
    body('openings').optional().isInt({ min: 1, max: 500 }).withMessage('People needed must be 1–500').toInt(),
    body('photos').optional().isArray({ max: MAX_PHOTOS }).withMessage(`You can add up to ${MAX_PHOTOS} photos`),
    body('photos.*').optional().isString(),
    body('status').optional().isIn(['open', 'closed']).withMessage('status must be "open" or "closed"'),
  ];
}

/** Checks a start/end pair: both or neither, end after start, sensible range. */
function checkDates(startAt: Date | null | undefined, endAt: Date | null | undefined, isNew: boolean) {
  if (!startAt && !endAt) return;
  if (!startAt || !endAt) throw new HttpError(400, 'Add both a start and an end time, or neither.');
  if (endAt <= startAt) throw new HttpError(400, 'The end time must be after the start time.');
  if (+endAt - +startAt > 90 * DAY_MS) throw new HttpError(400, 'A gig can last at most 90 days.');
  if (isNew && +endAt < Date.now()) throw new HttpError(400, 'This time has already passed. Pick a time in the future.');
  if (+startAt - Date.now() > 365 * DAY_MS) throw new HttpError(400, 'The start date must be within the next year.');
}

// POST /api/gigs — create a new gig (job giver only)
router.post('/', requireAuth, requireRole('business'), gigRules(false), ah(async (req, res) => {
  if (sendValidationError(req, res)) return;
  const user = await UserModel.findById(req.user!.id).lean();
  if (!user) throw new HttpError(401, 'Account not found. Please sign in again.');

  const { title, payAmount, payUnit, pay, hours, description, category, location, workMode, startAt, endAt, openings, photos } = req.body;
  checkDates(startAt, endAt, true);
  const photoList: string[] = photos ?? [];
  await assertOwnUploads(user._id.toString(), photoList);

  // Remote gigs never carry coordinates — there's no travel distance to match on.
  const isOnsite = workMode === 'onsite';
  const gig = await GigModel.create({
    businessId:    user._id,
    title, description, category, workMode,
    payAmount, payUnit,
    pay:           pay?.trim() || formatPay(payAmount, payUnit),
    hours:         hours?.trim() ?? '',
    startAt:       startAt ?? undefined,
    endAt:         endAt ?? undefined,
    openings:      openings ?? 1,
    photos:        photoList,
    location:      isOnsite ? (location?.trim() || user.locationLabel || user.location || 'Location TBD') : 'Remote',
    businessName:  user.businessName || user.name,
    businessColor: user.avatarColor || COLORS[Math.floor(Math.random() * COLORS.length)],
    businessPhotoUrl: user.photoUrl,
    ...(isOnsite && user.latitude != null && user.longitude != null && {
      geo: { type: 'Point', coordinates: [user.longitude, user.latitude] },
    }),
  });

  res.status(201).json({ gig: serializeGig(gig.toObject()) });
  void announceNewGig(gig); // live + push alerts to job seekers in range (background)
}));

// PUT /api/gigs/:id — edit a gig (any subset of fields), or close/reopen it
router.put('/:id', requireAuth, requireRole('business'), gigRules(true), ah(async (req, res) => {
  if (sendValidationError(req, res)) return;
  const id = requireId(req.params.id, 'Gig');
  const gig = await GigModel.findById(id);
  if (!gig) throw new HttpError(404, 'Gig not found');
  if (gig.businessId.toString() !== req.user!.id) throw new HttpError(403, 'Not your gig');
  const user = await UserModel.findById(req.user!.id).lean();
  if (!user) throw new HttpError(401, 'Account not found. Please sign in again.');

  const b = req.body;
  const oldTitle = gig.title;
  const wasOpen = gig.status === 'open';
  for (const key of ['title', 'description', 'category', 'payAmount', 'payUnit'] as const) {
    if (b[key] !== undefined) (gig as any)[key] = b[key];
  }
  if (b.hours !== undefined) gig.hours = (b.hours ?? '').trim();
  if (b.payAmount !== undefined || b.payUnit !== undefined || b.pay !== undefined) {
    gig.pay = b.pay?.trim() || formatPay(gig.payAmount ?? 0, gig.payUnit ?? 'fixed');
  }

  if (b.startAt !== undefined || b.endAt !== undefined) {
    const startAt = b.startAt !== undefined ? b.startAt : gig.startAt;
    const endAt = b.endAt !== undefined ? b.endAt : gig.endAt;
    checkDates(startAt, endAt, false);
    gig.startAt = startAt ?? undefined;
    gig.endAt = endAt ?? undefined;
  }

  if (b.photos !== undefined) {
    const added = (b.photos as string[]).filter(p => !gig.photos.includes(p));
    await assertOwnUploads(user._id.toString(), added);
    gig.photos = b.photos;
  }

  if (b.workMode !== undefined || b.location !== undefined) {
    const mode = b.workMode ?? gig.workMode;
    gig.workMode = mode;
    if (mode === 'remote') {
      gig.location = 'Remote';
      gig.geo = undefined;
    } else {
      gig.location = (b.location ?? '').trim() || (gig.location !== 'Remote' ? gig.location : '') ||
        user.locationLabel || user.location || 'Location TBD';
      if (user.latitude != null && user.longitude != null) {
        gig.geo = { type: 'Point', coordinates: [user.longitude, user.latitude] };
      }
    }
  }

  if (b.openings !== undefined) {
    if (b.openings < gig.hiredCount) {
      throw new HttpError(400, `You've already hired ${gig.hiredCount}. People needed can't be lower than that.`);
    }
    gig.openings = b.openings;
  }
  if (b.status === 'closed') gig.status = 'closed';
  else if (b.status === 'open') {
    if (gig.hiredCount >= gig.openings) throw new HttpError(400, 'Every opening is filled. Increase "People needed" to reopen it.');
    gig.status = 'open';
  } else {
    gig.status = statusForOpenings(gig);
  }

  await gig.save();
  if (wasOpen && gig.status !== 'open') announceGigClosed(String(gig._id));
  if (!wasOpen && gig.status === 'open') void announceNewGig(gig);
  if (gig.title !== oldTitle) {
    await ApplicationModel.updateMany({ gigId: gig._id }, { gigTitle: gig.title });
  }
  res.json({ gig: serializeGig(gig.toObject()) });
}));

// DELETE /api/gigs/:id — removes the gig and closes its pending applications.
// Accepted/hired applications are kept so chat history and ratings survive.
router.delete('/:id', requireAuth, ah(async (req, res) => {
  const id = requireId(req.params.id, 'Gig');
  const gig = await GigModel.findById(id);
  if (!gig) throw new HttpError(404, 'Gig not found');
  if (gig.businessId.toString() !== req.user!.id) throw new HttpError(403, 'Not your gig');
  await Promise.all([
    ApplicationModel.updateMany({ gigId: gig._id, status: 'pending' }, { status: 'rejected' }),
    SavedGigModel.deleteMany({ gigId: gig._id }),
    InviteModel.deleteMany({ gigId: gig._id, status: 'pending' }),
  ]);
  await gig.deleteOne();
  announceGigClosed(String(gig._id));
  res.json({ success: true });
}));

export default router;
