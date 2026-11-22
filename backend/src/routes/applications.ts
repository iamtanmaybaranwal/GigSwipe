import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { users, applications, messages } from '../store';
import { requireAuth } from '../middleware/auth';
import GigModel from '../models/Gig';
import type { Application } from '../types';

const router = Router();

// Generates a fresh 4-digit hire code (valid 24h) for an application.
function generateHireCode(): { code: string; expiry: string } {
  return {
    code:   String(Math.floor(1000 + Math.random() * 9000)),
    expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// POST /api/applications — worker applies to a gig (swipe right OR Apply Now)
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const user = users.get(userId);
  if (!user || user.role !== 'worker') {
    return res.status(403).json({ error: 'Only job seekers can apply to gigs' });
  }

  const { gigId } = req.body;
  if (!gigId) return res.status(400).json({ error: 'gigId is required' });

  const gig = await GigModel.findById(gigId).catch(() => null);
  if (!gig) return res.status(404).json({ error: 'Gig not found' });

  const existing = [...applications.values()].find(
    a => a.gigId === gigId && a.workerId === userId
  );
  if (existing) return res.json({ application: existing, alreadyApplied: true });

  const app: Application = {
    id:            uuidv4(),
    gigId,
    gigTitle:      gig.title,
    workerId:      userId,
    businessId:    gig.businessId.toString(),
    businessName:  gig.businessName,
    businessColor: gig.businessColor,
    status:        'pending',
    createdAt:     new Date().toISOString(),
  };

  applications.set(app.id, app);
  messages.set(app.id, []);

  res.status(201).json({ application: app });
});

// GET /api/applications/mine — worker's own applications (shown as Matches)
router.get('/mine', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const mine = [...applications.values()]
    .filter(a => a.workerId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const enriched = mine.map(app => {
    const thread = messages.get(app.id) ?? [];
    const last = thread[thread.length - 1];
    return {
      ...app,
      lastMessage:     last?.text ?? 'No messages yet',
      lastMessageTime: last?.timestamp ?? app.createdAt,
      unreadCount:     0,
    };
  });

  res.json({ applications: enriched });
});

// GET /api/applications/gig/:gigId — business views applicants for one of their gigs
router.get('/gig/:gigId', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const gig = await GigModel.findById(req.params.gigId).catch(() => null);
  if (!gig) return res.status(404).json({ error: 'Gig not found' });
  if (gig.businessId.toString() !== userId) return res.status(403).json({ error: 'Not your gig' });

  const applicants = [...applications.values()]
    .filter(a => a.gigId === req.params.gigId)
    .map(app => {
      const worker = users.get(app.workerId);
      return { ...app, worker: worker ?? null };
    });

  res.json({ applicants });
});

// GET /api/applications/hired — all hired applications for the current user (both roles)
router.get('/hired', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const hired = [...applications.values()].filter(
    a => a.status === 'hired' && (a.workerId === userId || a.businessId === userId)
  ).map(app => {
    const worker = users.get(app.workerId);
    const biz    = users.get(app.businessId);
    return { ...app, worker: worker ?? null, business: biz ?? null };
  });
  res.json({ applications: hired });
});

// GET /api/applications/with/:userId — shared applications between current user and target
// Used by the public profile screen to check if a review can be left
router.get('/with/:userId', requireAuth, (req, res) => {
  const currentUserId = req.user!.id;
  const targetUserId  = req.params.userId;

  const shared = [...applications.values()]
    .filter(a =>
      (a.workerId === currentUserId && a.businessId === targetUserId) ||
      (a.businessId === currentUserId && a.workerId === targetUserId)
    )
    .filter(a => a.status === 'accepted' || a.status === 'hired')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json({ applications: shared });
});

// GET /api/applications/work-history — worker's completed gigs with business + co-workers
router.get('/work-history', requireAuth, (req, res) => {
  const userId = req.user!.id;

  const hiredApps = [...applications.values()]
    .filter(a => a.workerId === userId && a.status === 'hired')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const history = hiredApps.map(app => {
    const biz = users.get(app.businessId) ?? null;

    // All hired workers on the same gig (for co-worker count + avatars)
    const allHiredForGig = [...applications.values()].filter(
      a => a.gigId === app.gigId && a.status === 'hired'
    );
    const coWorkers = allHiredForGig
      .filter(a => a.workerId !== userId)
      .map(a => users.get(a.workerId) ?? null)
      .filter(Boolean);

    return {
      application: app,
      business:    biz,
      totalWorkers: allHiredForGig.length,
      coWorkers,
    };
  });

  return res.json({ history });
});

// GET /api/applications/:id — single application detail (for chat screen)
router.get('/:id', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const app = applications.get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.workerId !== userId && app.businessId !== userId) {
    return res.status(403).json({ error: 'You are not part of this application' });
  }

  const thread = messages.get(app.id) ?? [];
  const last   = thread[thread.length - 1];
  const worker = users.get(app.workerId);

  return res.json({
    application: {
      ...app,
      workerName:      worker?.name       ?? 'Job Seeker',
      workerColor:     worker?.avatarColor ?? '#ff5864',
      lastMessage:     last?.text          ?? 'No messages yet',
      lastMessageTime: last?.timestamp     ?? app.createdAt,
      unreadCount:     0,
    },
  });
});

// POST /api/applications/:id/hire-request — business generates a 4-digit code for the worker
router.post('/:id/hire-request', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const app = applications.get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.businessId !== userId) return res.status(403).json({ error: 'Only the job giver can initiate hire' });
  if (app.status !== 'accepted') return res.status(400).json({ error: 'Application must be accepted before hiring' });

  const { code, expiry } = generateHireCode();
  applications.set(app.id, { ...app, hireCode: code, hireCodeExpiry: expiry });

  return res.json({
    message: `New hire code generated. Ask ${users.get(app.workerId)?.name ?? 'the job seeker'} to open GigSwipe → Matches, tap this gig, and read the 4-digit code. Then enter it here to confirm the hire.`,
  });
});

// POST /api/applications/:id/verify-hire — business submits the worker's code to confirm hire
router.post('/:id/verify-hire', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  const app = applications.get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.businessId !== userId) return res.status(403).json({ error: 'Only the job giver can verify hire' });
  if (!app.hireCode) return res.status(400).json({ error: 'No hire code exists. Please request one first.' });

  if (app.hireCodeExpiry && new Date(app.hireCodeExpiry) < new Date()) {
    applications.set(app.id, { ...app, hireCode: undefined, hireCodeExpiry: undefined });
    return res.status(400).json({ error: 'Hire code has expired. Please request a new one.' });
  }

  if (String(code).trim() !== app.hireCode) {
    return res.status(400).json({ error: 'Incorrect code. Ask the job seeker to double-check the code in their Matches tab.' });
  }

  const hired = { ...app, status: 'hired' as const, hireCode: undefined, hireCodeExpiry: undefined };
  applications.set(app.id, hired);

  return res.json({
    message: `Hire confirmed! Work begins now.`,
    application: hired,
  });
});

// PATCH /api/applications/:id — accept, reject, or hire
router.patch('/:id', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const app = applications.get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (app.businessId !== userId) return res.status(403).json({ error: 'Not your application' });

  const { status } = req.body;
  if (!['accepted', 'rejected', 'hired'].includes(status)) {
    return res.status(400).json({ error: 'status must be "accepted", "rejected", or "hired"' });
  }

  // Accepting a worker immediately generates their 4-digit hire code, so it's
  // ready and waiting in the chat as soon as the business opens it.
  const codeFields = (status === 'accepted' && !app.hireCode)
    ? generateHireCode()
    : null;

  const updated: Application = {
    ...app,
    status,
    ...(codeFields && { hireCode: codeFields.code, hireCodeExpiry: codeFields.expiry }),
  };
  applications.set(req.params.id, updated);
  res.json({ application: updated });
});

export default router;
