// Job givers invite specific job seekers to apply to a gig.
import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth, requireRole } from '../middleware/auth';
import { ah, HttpError, requireId, sendValidationError } from '../utils/http';
import { serializeGig, isGigExpired } from '../utils/serializeGig';
import { serializeApplication, serializePublicUser } from '../utils/serialize';
import { applyToGig, closedReason } from '../services/gigs';
import { emitToUser } from '../realtime';
import InviteModel from '../models/Invite';
import GigModel from '../models/Gig';
import UserModel from '../models/User';
import ApplicationModel from '../models/Application';

const router = Router();
const DAILY_INVITE_LIMIT = 100;

const serializeInvite = (i: any) => ({
  id:        String(i._id),
  gigId:     String(i.gigId),
  businessId: String(i.businessId),
  workerId:  String(i.workerId),
  message:   i.message || undefined,
  status:    i.status,
  applicationId: i.applicationId ? String(i.applicationId) : undefined,
  createdAt: new Date(i.createdAt).toISOString(),
});

// GET /api/invites/options/:workerId — the business's open gigs, each marked with
// whether this person was already invited or already applied (for the invite picker).
router.get('/options/:workerId', requireAuth, requireRole('business'), ah(async (req, res) => {
  const me = req.user!.id;
  const workerId = requireId(req.params.workerId, 'User');
  const gigs = await GigModel.find({ businessId: me, status: { $nin: ['filled', 'closed'] } }).sort({ createdAt: -1 }).limit(100).lean();
  const live = gigs.filter(g => !isGigExpired(g));
  const ids = live.map(g => g._id);
  const [invites, apps] = await Promise.all([
    InviteModel.find({ workerId, gigId: { $in: ids } }).select('gigId status').lean(),
    ApplicationModel.find({ workerId, gigId: { $in: ids } }).select('gigId').lean(),
  ]);
  const invited = new Map(invites.map(i => [i.gigId.toString(), i.status]));
  const applied = new Set(apps.map(a => a.gigId.toString()));
  res.json({
    gigs: live.map(g => ({
      gig: serializeGig(g),
      state: applied.has(g._id.toString()) ? 'applied' : invited.has(g._id.toString()) ? `invite_${invited.get(g._id.toString())}` : 'none',
    })),
  });
}));

// POST /api/invites { gigId, workerId, message? }
router.post(
  '/',
  requireAuth,
  requireRole('business'),
  [body('message').optional({ values: 'null' }).isString().trim().isLength({ max: 300 }).withMessage('Message is too long (max 300)')],
  ah(async (req, res) => {
    if (sendValidationError(req, res)) return;
    const me = req.user!.id;
    const gigId = requireId(req.body?.gigId, 'Gig');
    const workerId = requireId(req.body?.workerId, 'User');

    const [gig, worker] = await Promise.all([GigModel.findById(gigId), UserModel.findById(workerId).lean()]);
    if (!gig) throw new HttpError(404, 'Gig not found');
    if (gig.businessId.toString() !== me) throw new HttpError(403, 'Not your gig');
    const reason = closedReason(gig);
    if (reason) throw new HttpError(409, reason);
    if (!worker || worker.role !== 'worker') throw new HttpError(404, 'Job seeker not found');
    if (worker.discoverable === false) throw new HttpError(403, 'This person is not accepting invites.');
    if (await ApplicationModel.exists({ gigId, workerId })) throw new HttpError(409, 'They have already applied to this gig.');

    const since = new Date(Date.now() - 86_400_000);
    if ((await InviteModel.countDocuments({ businessId: me, createdAt: { $gte: since } })) >= DAILY_INVITE_LIMIT) {
      throw new HttpError(429, `You can send up to ${DAILY_INVITE_LIMIT} invites a day.`);
    }

    const existing = await InviteModel.findOne({ gigId, workerId });
    if (existing) {
      if (existing.status === 'pending') throw new HttpError(409, 'You have already invited them to this gig.');
      if (existing.status === 'declined') throw new HttpError(409, 'They declined an invite to this gig.');
      throw new HttpError(409, 'They have already applied to this gig.');
    }

    const invite = await InviteModel.create({
      gigId, workerId, businessId: me, message: req.body.message?.trim() || undefined,
    });
    emitToUser(workerId, 'invite_update', { inviteId: String(invite._id), status: 'pending' });
    res.status(201).json({ invite: serializeInvite(invite) });
  })
);

// GET /api/invites/mine — job seeker's pending invites (open gigs only)
router.get('/mine', requireAuth, requireRole('worker'), ah(async (req, res) => {
  const me = req.user!.id;
  const invites = await InviteModel.find({ workerId: me, status: 'pending' }).sort({ createdAt: -1 }).limit(50).lean();
  const [gigs, businesses] = await Promise.all([
    GigModel.find({ _id: { $in: invites.map(i => i.gigId) } }).lean(),
    UserModel.find({ _id: { $in: invites.map(i => i.businessId) } }).lean(),
  ]);
  const gigById = new Map(gigs.map(g => [g._id.toString(), g]));
  const bizById = new Map(businesses.map(b => [b._id.toString(), b]));
  res.json({
    invites: invites
      .filter(i => {
        const g = gigById.get(i.gigId.toString());
        return g && !closedReason(g as any);
      })
      .map(i => ({
        ...serializeInvite(i),
        gig: serializeGig(gigById.get(i.gigId.toString())),
        business: serializePublicUser(bizById.get(i.businessId.toString())),
      })),
  });
}));

async function loadMyInvite(id: string, workerId: string) {
  const invite = await InviteModel.findById(requireId(id, 'Invite'));
  if (!invite || invite.workerId.toString() !== workerId) throw new HttpError(404, 'Invite not found');
  return invite;
}

// POST /api/invites/:id/accept — applies to the gig and opens the chat
router.post('/:id/accept', requireAuth, requireRole('worker'), ah(async (req, res) => {
  const me = req.user!.id;
  const invite = await loadMyInvite(req.params.id, me);
  const gig = await GigModel.findById(invite.gigId);
  if (!gig) throw new HttpError(404, 'This gig is no longer available');

  const { app } = await applyToGig(me, gig);
  invite.status = 'accepted';
  invite.applicationId = app._id as any;
  await invite.save();
  emitToUser(invite.businessId.toString(), 'invite_update', { inviteId: String(invite._id), status: 'accepted' });
  res.json({ invite: serializeInvite(invite), application: serializeApplication(app, me) });
}));

// POST /api/invites/:id/decline
router.post('/:id/decline', requireAuth, requireRole('worker'), ah(async (req, res) => {
  const me = req.user!.id;
  const invite = await loadMyInvite(req.params.id, me);
  if (invite.status !== 'pending') throw new HttpError(400, 'This invite was already answered.');
  invite.status = 'declined';
  await invite.save();
  emitToUser(invite.businessId.toString(), 'invite_update', { inviteId: String(invite._id), status: 'declined' });
  res.json({ invite: serializeInvite(invite) });
}));

export default router;
