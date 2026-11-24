import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { ah, HttpError, isId, requireId, sendValidationError } from '../utils/http';
import RatingModel from '../models/Rating';
import ApplicationModel from '../models/Application';
import UserModel from '../models/User';

const router = Router();

const serializeRating = (d: any) => ({
  id:            d._id.toString(),
  rater:         d.rater,
  ratee:         d.ratee,
  applicationId: d.applicationId,
  gigTitle:      d.gigTitle,
  stars:         d.stars,
  review:        d.review,
  raterRole:     d.raterRole,
  raterName:     d.raterName,
  createdAt:     d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
});

// ── POST /api/ratings — rate the other person on an application ──────────────
router.post(
  '/',
  requireAuth,
  [
    body('applicationId').custom(v => isId(v)).withMessage('applicationId is required'),
    body('stars').isInt({ min: 1, max: 5 }).withMessage('Stars must be a whole number between 1 and 5').toInt(),
    body('review').optional({ values: 'null' }).isString().trim()
      .isLength({ max: 500 }).withMessage('Review cannot exceed 500 characters'),
  ],
  ah(async (req, res) => {
    if (sendValidationError(req, res)) return;
    const { applicationId, stars, review } = req.body;
    const raterId = req.user!.id;

    const app = await ApplicationModel.findById(applicationId);
    if (!app) throw new HttpError(404, 'Application not found');

    const isWorker = app.workerId.toString() === raterId;
    const isBusiness = app.businessId.toString() === raterId;
    if (!isWorker && !isBusiness) throw new HttpError(403, 'You are not part of this application');

    // Only allow rating once there's an actual working relationship
    if (app.status !== 'accepted' && app.status !== 'hired') {
      throw new HttpError(400, 'You can only rate after the application has been accepted.');
    }

    const existing = await RatingModel.findOne({ rater: raterId, applicationId });
    if (existing) {
      return res.status(409).json({ error: 'You have already rated this application.', rating: serializeRating(existing) });
    }

    const rater = await UserModel.findById(raterId).select('name').lean();
    try {
      const rating = await RatingModel.create({
        rater:     raterId,
        ratee:     isWorker ? app.businessId.toString() : app.workerId.toString(),
        applicationId,
        gigTitle:  app.gigTitle,
        stars,
        review:    review?.trim() || undefined,
        raterRole: isWorker ? 'worker' : 'business',
        raterName: rater?.name ?? 'Anonymous',
      });
      res.status(201).json({ rating: serializeRating(rating) });
    } catch (err: any) {
      if (err?.code === 11000) throw new HttpError(409, 'You have already rated this application.');
      throw err;
    }
  })
);

// ── GET /api/ratings/given — applicationIds the current user has already rated ─
router.get('/given', requireAuth, ah(async (req, res) => {
  const given = await RatingModel.find({ rater: req.user!.id }, 'applicationId -_id').lean();
  res.json({ ratedApplicationIds: given.map(r => r.applicationId) });
}));

// ── GET /api/ratings/user/:userId — public ratings FOR a user ─────────────────
router.get('/user/:userId', ah(async (req, res) => {
  const userId = requireId(req.params.userId, 'User');
  const [[stats], ratings] = await Promise.all([
    RatingModel.aggregate([
      { $match: { ratee: userId } },
      { $group: { _id: null, averageStars: { $avg: '$stars' }, totalRatings: { $sum: 1 } } },
    ]),
    RatingModel.find({ ratee: userId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  res.json({
    averageStars: stats ? Math.round(stats.averageStars * 10) / 10 : 0,
    totalRatings: stats?.totalRatings ?? 0,
    ratings: ratings.map(serializeRating),
  });
}));

export default router;
