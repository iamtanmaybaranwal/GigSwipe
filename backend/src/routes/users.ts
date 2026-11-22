import { Router } from 'express';
import { users, applications } from '../store';
import UserModel from '../models/User';

const router = Router();

// GET /api/users/:userId — public profile + completion stats (no auth required)
router.get('/:userId', async (req: any, res: any) => {
  const { userId } = req.params;

  // Fast path: in-memory store
  let user = users.get(userId) as any;

  if (!user) {
    // Fall back to MongoDB
    try {
      const dbUser = await UserModel.findById(userId);
      if (!dbUser) return res.status(404).json({ error: 'User not found' });
      user = dbUser.toJSON();
    } catch {
      return res.status(404).json({ error: 'User not found' });
    }
  }

  // Completion stats from in-memory store
  const hiredApps    = [...applications.values()].filter(a => a.status === 'hired');
  const gigsCompleted = hiredApps.filter(a => a.workerId   === userId).length;
  const workersHired  = hiredApps.filter(a => a.businessId === userId).length;

  return res.json({ user, gigsCompleted, workersHired });
});

export default router;
