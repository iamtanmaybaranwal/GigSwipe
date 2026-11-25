import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { ah, HttpError, requireId } from '../utils/http';
import { serializePublicUser } from '../utils/serialize';
import { MILES_TO_METERS } from '../utils/geo';
import UserModel, { AVAILABILITY_SLOTS } from '../models/User';
import ApplicationModel from '../models/Application';
import RatingModel from '../models/Rating';

const router = Router();
const SEARCH_LIMIT = 60;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/users/workers — job givers search for job seekers nearby.
// Query: q (name/skill/profession), availableNow=1, slot (availability key), radius (miles).
// Only people who allow it (discoverable) are listed, and only an approximate
// distance is shown — never exact coordinates.
router.get('/workers', requireAuth, requireRole('business'), ah(async (req, res) => {
  const me = await UserModel.findById(req.user!.id).lean();
  if (!me) throw new HttpError(401, 'Account not found. Please sign in again.');
  const qs = req.query as Record<string, string | undefined>;

  const and: Record<string, unknown>[] = [{ role: 'worker' }, { discoverable: { $ne: false } }];
  const q = (qs.q ?? '').trim().slice(0, 60);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ name: rx }, { major: rx }, { skills: rx }, { bio: rx }] });
  }
  if (qs.availableNow === '1') and.push({ availableUntil: { $gt: new Date() } });
  if (qs.slot && (AVAILABILITY_SLOTS as readonly string[]).includes(qs.slot)) and.push({ availability: qs.slot });
  const filter = { $and: and };

  const radius = Number(qs.radius) >= 1 && Number(qs.radius) <= 500 ? Number(qs.radius) : 25;
  const hasLocation = me.latitude != null && me.longitude != null;

  const docs: any[] = hasLocation
    ? await UserModel.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [me.longitude!, me.latitude!] },
            distanceField: 'distanceMeters',
            spherical: true,
            maxDistance: radius * MILES_TO_METERS,
            query: filter,
          },
        },
        { $limit: SEARCH_LIMIT },
      ])
    : await UserModel.find(filter).sort({ availableUntil: -1, updatedAt: -1 }).limit(SEARCH_LIMIT).lean();

  // Rating summary for each result in one query
  const ids = docs.map(d => d._id);
  const [ratings, done] = await Promise.all([
    RatingModel.aggregate([
      { $match: { ratee: { $in: ids.map(String) } } }, // ratee is stored as a string id
      { $group: { _id: '$ratee', avg: { $avg: '$stars' }, total: { $sum: 1 } } },
    ]),
    ApplicationModel.aggregate([
      { $match: { workerId: { $in: ids }, status: 'hired' } },
      { $group: { _id: '$workerId', count: { $sum: 1 } } },
    ]),
  ]);
  const ratingBy = new Map(ratings.map(r => [r._id.toString(), r]));
  const doneBy = new Map(done.map(d => [d._id.toString(), d.count]));

  const workers = docs.map(d => {
    const id = d._id.toString();
    const miles = d.distanceMeters != null ? d.distanceMeters / MILES_TO_METERS : undefined;
    return {
      ...serializePublicUser(d),
      // Rounded so nobody's exact home can be worked out from repeated searches
      distanceMiles: miles != null ? Math.max(0.5, Math.round(miles * 2) / 2) : undefined,
      averageStars: ratingBy.get(id)?.avg ?? 0,
      totalRatings: ratingBy.get(id)?.total ?? 0,
      gigsCompleted: doneBy.get(id) ?? 0,
    };
  });
  // Available-now people first, then by distance (aggregate order is kept within each group)
  workers.sort((a: any, b: any) => Number(b.availableNow) - Number(a.availableNow));
  res.json({ workers, hasLocation });
}));

// GET /api/users/:userId — public profile + completion stats (no auth required).
// Email is never included in public profiles.
router.get('/:userId', ah(async (req, res) => {
  const userId = requireId(req.params.userId, 'User');
  const user = await UserModel.findById(userId).lean();
  if (!user) throw new HttpError(404, 'User not found');

  const [gigsCompleted, workersHired] = await Promise.all([
    ApplicationModel.countDocuments({ workerId: userId, status: 'hired' }),
    ApplicationModel.countDocuments({ businessId: userId, status: 'hired' }),
  ]);

  res.json({ user: serializePublicUser(user), gigsCompleted, workersHired });
}));

export default router;
