import { Router } from 'express';
import { randomInt } from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth';
import { ah, HttpError, requireId } from '../utils/http';
import { serializeApplication, serializePublicUser } from '../utils/serialize';
import { unreadCountFor } from '../services/chat';
import { emitToUser } from '../realtime';
import GigModel from '../models/Gig';
import UserModel from '../models/User';
import ApplicationModel, { type IApplication } from '../models/Application';

const router = Router();

const HIRE_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

// Cryptographically random 4-digit code (Math.random is predictable).
const newHireCode = () => ({
  hireCode:         String(randomInt(1000, 10000)),
  hireCodeExpiry:   new Date(Date.now() + HIRE_CODE_TTL_MS),
  hireCodeAttempts: 0,
});

async function withChatMeta(app: IApplication, viewerId: string) {
  return {
    ...serializeApplication(app, viewerId),
    lastMessage:     app.lastMessage ?? 'No messages yet',
    lastMessageTime: (app.lastMessageAt ?? app.createdAt).toISOString(),
    unreadCount:     await unreadCountFor(app, viewerId),
  };
}

/** Tells both people on an application that it changed, so their screens refresh. */
function notifyChange(app: IApplication) {
  const payload = { applicationId: String(app._id), status: app.status };
  emitToUser(app.workerId.toString(), 'application_update', payload);
  emitToUser(app.businessId.toString(), 'application_update', payload);
}

async function loadOwnApplication(id: string, userId: string) {
  const app = await ApplicationModel.findById(requireId(id, 'Application'));
  if (!app) throw new HttpError(404, 'Application not found');
  if (app.workerId.toString() !== userId && app.businessId.toString() !== userId) {
    throw new HttpError(403, 'You are not part of this application');
  }
  return app;
}

// POST /api/applications — worker applies to a gig (swipe right OR Apply Now)
router.post('/', requireAuth, requireRole('worker'), ah(async (req, res) => {
  const userId = req.user!.id;
  const gigId = requireId(req.body?.gigId, 'Gig');

  const gig = await GigModel.findById(gigId);
  if (!gig) throw new HttpError(404, 'This gig is no longer available');

  const existing = await ApplicationModel.findOne({ gigId, workerId: userId });
  if (existing) return res.json({ application: serializeApplication(existing, userId), alreadyApplied: true });

  try {
    const app = await ApplicationModel.create({
      gigId:         gig._id,
      gigTitle:      gig.title,
      workerId:      userId,
      businessId:    gig.businessId,
      businessName:  gig.businessName,
      businessColor: gig.businessColor,
      status:        'pending',
    });
    emitToUser(gig.businessId.toString(), 'application_update', { applicationId: String(app._id), status: app.status, gigId });
    res.status(201).json({ application: serializeApplication(app, userId) });
  } catch (err: any) {
    // Two quick taps can race past the findOne above — the unique index catches it
    if (err?.code === 11000) {
      const app = await ApplicationModel.findOne({ gigId, workerId: userId });
      return res.json({ application: serializeApplication(app!, userId), alreadyApplied: true });
    }
    throw err;
  }
}));

// GET /api/applications/mine — worker's own applications (shown as Matches)
router.get('/mine', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const mine = await ApplicationModel.find({ workerId: userId }).sort({ lastMessageAt: -1, createdAt: -1 });
  res.json({ applications: await Promise.all(mine.map(a => withChatMeta(a, userId))) });
}));

// GET /api/applications/inbox — every conversation for the current user (both roles),
// most recent first, with the other person's public profile attached.
router.get('/inbox', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const apps = await ApplicationModel.find({ $or: [{ workerId: userId }, { businessId: userId }] })
    .sort({ updatedAt: -1 })
    .limit(200);
  const otherIds = apps.map(a => (a.workerId.toString() === userId ? a.businessId : a.workerId));
  const others = await UserModel.find({ _id: { $in: otherIds } }).lean();
  const byId = new Map(others.map(u => [u._id.toString(), u]));

  const conversations = await Promise.all(apps.map(async a => {
    const otherId = a.workerId.toString() === userId ? a.businessId.toString() : a.workerId.toString();
    return { ...(await withChatMeta(a, userId)), otherUser: serializePublicUser(byId.get(otherId)) };
  }));
  conversations.sort((x, y) => new Date(y.lastMessageTime).getTime() - new Date(x.lastMessageTime).getTime());
  res.json({ conversations });
}));

// GET /api/applications/gig/:gigId — business views applicants for one of their gigs
router.get('/gig/:gigId', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const gigId = requireId(req.params.gigId, 'Gig');
  const gig = await GigModel.findById(gigId).lean();
  if (!gig) throw new HttpError(404, 'Gig not found');
  if (gig.businessId.toString() !== userId) throw new HttpError(403, 'Not your gig');

  const apps = await ApplicationModel.find({ gigId }).sort({ createdAt: -1 }).populate('workerId');
  const applicants = apps.map(app => {
    const worker = app.workerId as any;
    const plain = serializeApplication({ ...app.toObject(), workerId: worker?._id ?? app.workerId }, userId);
    return { ...plain, worker: worker ? serializePublicUser(worker) : null };
  });
  res.json({ applicants });
}));

// GET /api/applications/hired — all hired applications for the current user (both roles)
router.get('/hired', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const hired = await ApplicationModel.find({
    status: 'hired',
    $or: [{ workerId: userId }, { businessId: userId }],
  }).sort({ hiredAt: -1 }).lean();

  const ids = [...new Set(hired.flatMap(a => [a.workerId.toString(), a.businessId.toString()]))];
  const users = await UserModel.find({ _id: { $in: ids } }).lean();
  const byId = new Map(users.map(u => [u._id.toString(), u]));

  res.json({
    applications: hired.map(a => ({
      ...serializeApplication(a, userId),
      worker:   serializePublicUser(byId.get(a.workerId.toString())),
      business: serializePublicUser(byId.get(a.businessId.toString())),
    })),
  });
}));

// GET /api/applications/with/:userId — accepted/hired applications shared with another user
// (used by the public profile screen to offer "Leave a Review")
router.get('/with/:userId', requireAuth, ah(async (req, res) => {
  const me = req.user!.id;
  const other = requireId(req.params.userId, 'User');
  const shared = await ApplicationModel.find({
    status: { $in: ['accepted', 'hired'] },
    $or: [{ workerId: me, businessId: other }, { businessId: me, workerId: other }],
  }).sort({ createdAt: -1 });
  res.json({ applications: shared.map(a => serializeApplication(a, me)) });
}));

// GET /api/applications/work-history — worker's completed gigs with business + co-workers
router.get('/work-history', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const mine = await ApplicationModel.find({ workerId: userId, status: 'hired' }).sort({ hiredAt: -1 }).lean();
  const gigIds = mine.map(a => a.gigId);
  const allHired = await ApplicationModel.find({ gigId: { $in: gigIds }, status: 'hired' }).lean();

  const userIds = [...new Set([
    ...mine.map(a => a.businessId.toString()),
    ...allHired.map(a => a.workerId.toString()),
  ])];
  const users = await UserModel.find({ _id: { $in: userIds } }).lean();
  const byId = new Map(users.map(u => [u._id.toString(), u]));

  const history = mine.map(app => {
    const sameGig = allHired.filter(a => a.gigId.toString() === app.gigId.toString());
    const coWorkers = sameGig
      .filter(a => a.workerId.toString() !== userId)
      .map(a => serializePublicUser(byId.get(a.workerId.toString())))
      .filter(Boolean);
    return {
      application:  serializeApplication(app, userId),
      business:     serializePublicUser(byId.get(app.businessId.toString())),
      totalWorkers: sameGig.length,
      coWorkers,
    };
  });
  res.json({ history });
}));

// GET /api/applications/:id — single application detail (for chat screen)
router.get('/:id', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const app = await loadOwnApplication(req.params.id, userId);
  const worker = await UserModel.findById(app.workerId).select('name avatarColor').lean();
  res.json({
    application: {
      ...(await withChatMeta(app, userId)),
      workerName:  worker?.name ?? 'Job Seeker',
      workerColor: worker?.avatarColor ?? '#ff5864',
    },
  });
}));

// POST /api/applications/:id/hire-request — business generates a fresh code for the worker
router.post('/:id/hire-request', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const app = await loadOwnApplication(req.params.id, userId);
  if (app.businessId.toString() !== userId) throw new HttpError(403, 'Only the job giver can start a hire');
  if (app.status !== 'accepted') throw new HttpError(400, 'Accept the application before hiring');

  Object.assign(app, newHireCode());
  await app.save();
  notifyChange(app);

  const worker = await UserModel.findById(app.workerId).select('name').lean();
  res.json({
    message: `New hire code generated. Ask ${worker?.name ?? 'the job seeker'} to open GigSwipe → Matches and read you the 4-digit code for this gig, then enter it here to confirm the hire.`,
    application: serializeApplication(app, userId),
  });
}));

// POST /api/applications/:id/verify-hire — business enters the worker's code to confirm the hire
router.post('/:id/verify-hire', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const code = String(req.body?.code ?? '').trim();
  if (!/^\d{4}$/.test(code)) throw new HttpError(400, 'Please enter the 4-digit code.');

  const app = await loadOwnApplication(req.params.id, userId);
  if (app.businessId.toString() !== userId) throw new HttpError(403, 'Only the job giver can confirm a hire');
  if (app.status === 'hired') throw new HttpError(400, 'This job seeker is already hired.');
  if (app.status !== 'accepted') throw new HttpError(400, 'Accept the application before hiring');
  if (!app.hireCode || !app.hireCodeExpiry) throw new HttpError(400, 'No hire code exists. Please generate one first.');

  if (app.hireCodeExpiry < new Date()) {
    app.hireCode = undefined; app.hireCodeExpiry = undefined;
    await app.save();
    notifyChange(app);
    throw new HttpError(400, 'This hire code has expired. Generate a new one.');
  }

  if (code !== app.hireCode) {
    app.hireCodeAttempts = (app.hireCodeAttempts ?? 0) + 1;
    const left = MAX_CODE_ATTEMPTS - app.hireCodeAttempts;
    if (left <= 0) {
      // Too many wrong guesses — burn the code so it can't be brute-forced
      app.hireCode = undefined; app.hireCodeExpiry = undefined; app.hireCodeAttempts = 0;
      await app.save();
      notifyChange(app);
      throw new HttpError(400, 'Too many incorrect attempts. The code was cancelled — generate a new one.');
    }
    await app.save();
    throw new HttpError(400, `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`);
  }

  app.status = 'hired';
  app.hiredAt = new Date();
  app.hireCode = undefined; app.hireCodeExpiry = undefined; app.hireCodeAttempts = 0;
  await app.save();
  notifyChange(app);

  res.json({ message: 'Hire confirmed! Work begins now.', application: serializeApplication(app, userId) });
}));

// PATCH /api/applications/:id — business accepts or rejects.
// "hired" can only be reached through verify-hire (the code check).
router.patch('/:id', requireAuth, ah(async (req, res) => {
  const userId = req.user!.id;
  const app = await loadOwnApplication(req.params.id, userId);
  if (app.businessId.toString() !== userId) throw new HttpError(403, 'Not your application');

  const { status } = req.body ?? {};
  if (status === 'hired') {
    throw new HttpError(400, 'To hire, enter the 4-digit code from the job seeker.');
  }
  if (!['accepted', 'rejected'].includes(status)) {
    throw new HttpError(400, 'status must be "accepted" or "rejected"');
  }
  if (app.status === 'hired') throw new HttpError(400, 'This job seeker is already hired.');

  app.status = status;
  if (status === 'accepted' && !app.hireCode) {
    // The code is ready in the worker's Matches tab as soon as they're accepted
    Object.assign(app, newHireCode());
  }
  if (status === 'rejected') {
    app.hireCode = undefined; app.hireCodeExpiry = undefined;
  }
  await app.save();
  notifyChange(app);
  res.json({ application: serializeApplication(app, userId) });
}));

export default router;
