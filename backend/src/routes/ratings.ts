import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { applications, users } from '../store';
import { requireAuth } from '../middleware/auth';
import RatingModel from '../models/Rating';

const router = Router();

// ── POST /api/ratings — submit a rating ──────────────────────────────────────
router.post(
  '/',
  requireAuth,
  [
    body('applicationId').notEmpty().withMessage('applicationId is required'),
    body('stars')
      .isInt({ min: 1, max: 5 })
      .withMessage('Stars must be a whole number between 1 and 5'),
    body('review')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Review cannot exceed 500 characters'),
  ],
  async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { applicationId, stars, review } = req.body;
    const raterId   = req.user!.id;
    const raterRole = req.user!.role;

    // Fetch the application from in-memory store
    const app = applications.get(applicationId);
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Only participants can submit a rating
    if (app.workerId !== raterId && app.businessId !== raterId) {
      return res.status(403).json({ error: 'You are not part of this application' });
    }

    // Only allow rating once there's an actual working relationship
    if (app.status !== 'accepted' && app.status !== 'hired') {
      return res.status(400).json({
        error: 'You can only rate after the application has been accepted.',
      });
    }

    // Determine who is being rated (the other party)
    const rateeId = raterId === app.workerId ? app.businessId : app.workerId;

    // Check for duplicate rating (the unique index handles this too, but a clear
    // error message is better than a duplicate-key exception)
    const existing = await RatingModel.findOne({ rater: raterId, applicationId });
    if (existing) {
      return res.status(409).json({
        error: 'You have already rated this application.',
        rating: existing.toJSON(),
      });
    }

    const rater = users.get(raterId);

    try {
      const rating = await RatingModel.create({
        rater: raterId,
        ratee: rateeId,
        applicationId,
        gigTitle:  app.gigTitle,
        stars,
        review:    review?.trim() || undefined,
        raterRole,
        raterName: rater?.name ?? 'Anonymous',
      });
      return res.status(201).json({ rating: rating.toJSON() });
    } catch (err) {
      console.error('[ratings/submit]', err);
      return res.status(500).json({ error: 'Could not save rating. Please try again.' });
    }
  }
);

// ── GET /api/ratings/given — applicationIds the current user has already rated ─
// Used by the frontend to disable "Rate" buttons that have already been used.
router.get('/given', requireAuth, async (req: any, res: any) => {
  try {
    const given = await RatingModel.find(
      { rater: req.user!.id },
      'applicationId -_id'
    );
    return res.json({ ratedApplicationIds: given.map(r => r.applicationId) });
  } catch (err) {
    console.error('[ratings/given]', err);
    return res.status(500).json({ error: 'Could not fetch rated applications.' });
  }
});

// ── GET /api/ratings/user/:userId — all ratings FOR a specific user ───────────
// Public — used by profile screens to display stars and reviews.
router.get('/user/:userId', async (req: any, res: any) => {
  const { userId } = req.params;

  try {
    // Compute the true average via aggregation — never drifts
    const [stats] = await RatingModel.aggregate([
      { $match: { ratee: userId } },
      {
        $group: {
          _id: null,
          averageStars: { $avg: '$stars' },
          totalRatings: { $sum: 1 },
        },
      },
    ]);

    // Return the 10 most recent reviews for the profile display
    const ratings = await RatingModel.find({ ratee: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .then(docs =>
        docs.map(d => ({
          id:            d._id.toString(),
          rater:         d.rater,
          ratee:         d.ratee,
          applicationId: d.applicationId,
          gigTitle:      d.gigTitle,
          stars:         d.stars,
          review:        d.review,
          raterRole:     d.raterRole,
          raterName:     d.raterName,
          createdAt:     (d as any).createdAt?.toISOString(),
        }))
      );

    return res.json({
      averageStars: stats ? Math.round(stats.averageStars * 10) / 10 : 0,
      totalRatings: stats?.totalRatings ?? 0,
      ratings,
    });
  } catch (err) {
    console.error('[ratings/user]', err);
    return res.status(500).json({ error: 'Could not fetch ratings.' });
  }
});

export default router;
