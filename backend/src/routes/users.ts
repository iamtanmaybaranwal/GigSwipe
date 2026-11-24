import { Router } from 'express';
import { ah, HttpError, requireId } from '../utils/http';
import { serializePublicUser } from '../utils/serialize';
import UserModel from '../models/User';
import ApplicationModel from '../models/Application';

const router = Router();

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
