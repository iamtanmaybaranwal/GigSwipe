import { Router } from 'express';
import { users, applications } from '../store';
import { requireAuth, attachUserIfPresent } from '../middleware/auth';
import { MILES_TO_METERS } from '../utils/geo';
import { serializeGig } from '../utils/serializeGig';
import GigModel from '../models/Gig';

const router = Router();
const COLORS = ['#7B61FF', '#FF9500', '#34C759', '#FF2D55', '#5AC8FA', '#ff5864'];

// GET /api/gigs — worker swipe feed (public, but personalized when signed in).
// Uses a real MongoDB 2dsphere index + $geoNear — the same "find nearby X"
// geospatial query ride-hailing apps run to find nearby drivers, applied here
// to fixed gig addresses instead of moving vehicles. Gigs within the viewer's
// radius are returned nearest-first; gigs with no location are appended after
// so a business that hasn't set a location yet doesn't just disappear.
router.get('/', attachUserIfPresent, async (req, res) => {
  try {
    const viewer = req.user ? users.get(req.user.id) : undefined;
    const hasViewerLocation = viewer?.latitude != null && viewer?.longitude != null;

    if (!hasViewerLocation) {
      const all = await GigModel.find().sort({ createdAt: -1 }).lean();
      return res.json({ gigs: all.map(serializeGig) });
    }

    const [near, withoutLocation] = await Promise.all([
      GigModel.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [viewer!.longitude!, viewer!.latitude!] },
            distanceField: 'distanceMeters',
            spherical: true,
            ...(viewer!.radiusMiles != null && { maxDistance: viewer!.radiusMiles * MILES_TO_METERS }),
          },
        },
      ]),
      GigModel.find({ geo: { $exists: false } }).sort({ createdAt: -1 }).lean(),
    ]);

    res.json({ gigs: [...near.map(serializeGig), ...withoutLocation.map(serializeGig)] });
  } catch (err) {
    console.error('[gigs/feed]', err);
    res.status(500).json({ error: 'Could not load gigs.' });
  }
});

// GET /api/gigs/mine — only this business's gigs
router.get('/mine', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const mine = await GigModel.find({ businessId: userId }).sort({ createdAt: -1 }).lean();
  res.json({ gigs: mine.map(serializeGig) });
});

// GET /api/gigs/history — business's posted gigs with hired workers (must be before /:id)
router.get('/history', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const myGigs = await GigModel.find({ businessId: userId }).sort({ createdAt: -1 }).lean();

  const history = myGigs.map(gig => {
    const hiredApps = [...applications.values()].filter(
      a => a.gigId === gig._id.toString() && a.status === 'hired'
    );
    const hiredWorkers = hiredApps.map(a => users.get(a.workerId) ?? null).filter(Boolean);
    return { gig: serializeGig(gig), hiredWorkers, totalWorkers: hiredWorkers.length };
  });

  res.json({ history });
});

// GET /api/gigs/:id — single gig detail (public)
router.get('/:id', async (req, res) => {
  const gig = await GigModel.findById(req.params.id).lean().catch(() => null);
  if (!gig) return res.status(404).json({ error: 'Gig not found' });
  res.json({ gig: serializeGig(gig) });
});

// POST /api/gigs — create a new gig (job giver only)
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const user = users.get(userId);
  if (!user || user.role !== 'business') {
    return res.status(403).json({ error: 'Only job givers can post gigs' });
  }

  const { title, pay, hours, description, category, location, workMode } = req.body;
  if (!title?.trim() || !pay?.trim() || !hours?.trim() || !description?.trim() || !category) {
    return res.status(400).json({ error: 'title, pay, hours, description, and category are required' });
  }
  if (!['onsite', 'remote'].includes(workMode)) {
    return res.status(400).json({ error: 'workMode must be "onsite" or "remote"' });
  }

  // Remote gigs never carry coordinates — there's no travel distance to match on.
  const isOnsite = workMode === 'onsite';

  try {
    const gig = await GigModel.create({
      businessId:    userId,
      title:         title.trim(),
      pay:           pay.trim(),
      hours:         hours.trim(),
      description:   description.trim(),
      category,
      workMode,
      location:      isOnsite ? (location?.trim() || user.locationLabel || 'Location TBD') : 'Remote',
      businessName:  user.businessName || user.name,
      businessColor: user.avatarColor || COLORS[Math.floor(Math.random() * COLORS.length)],
      ...(isOnsite && user.latitude != null && user.longitude != null && {
        geo: { type: 'Point', coordinates: [user.longitude, user.latitude] },
      }),
    });

    res.status(201).json({ gig: serializeGig(gig.toObject()) });
  } catch (err) {
    console.error('[gigs/create]', err);
    res.status(500).json({ error: 'Could not create gig. Please try again.' });
  }
});

// DELETE /api/gigs/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const gig = await GigModel.findById(req.params.id).catch(() => null);
  if (!gig) return res.status(404).json({ error: 'Gig not found' });
  if (gig.businessId.toString() !== userId) return res.status(403).json({ error: 'Not your gig' });
  await gig.deleteOne();
  res.json({ success: true });
});

export default router;
