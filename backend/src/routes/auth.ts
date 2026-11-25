import { Router } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import UserModel, { AVAILABILITY_SLOTS } from '../models/User';
import GigModel from '../models/Gig';
import { requireAuth, issueToken } from '../middleware/auth';
import { ah, HttpError, sendValidationError } from '../utils/http';
import { serializeSelf } from '../utils/serialize';
import { assertOwnUploads } from '../services/gigs';
import { consumeCode, issueCode } from '../services/emailCodes';

const router = Router();

const COLORS = ['#ff5864', '#7B61FF', '#FF9500', '#34C759', '#FF2D55', '#5AC8FA'];
const RADIUS_MAX = 500;
const AVAILABLE_NOW_MAX_MS = 48 * 60 * 60 * 1000;

const optStr = (field: string, max: number) =>
  body(field).optional({ values: 'null' }).isString().withMessage(`${field} must be text`)
    .trim().isLength({ max }).withMessage(`${field} is too long (max ${max} characters)`);

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('name').isString().trim().notEmpty().withMessage('Name is required')
      .isLength({ max: 80 }).withMessage('Name is too long'),
    body('email').isString().trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
    body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['worker', 'business']).withMessage('Please choose Job Seeker or Job Giver'),
    optStr('businessName', 100), optStr('university', 120), optStr('major', 120), optStr('year', 60),
  ],
  ah(async (req, res) => {
    if (sendValidationError(req, res)) return;
    const { name, email, password, role, businessName, university, major, year } = req.body;

    const existing = await UserModel.findOne({ email });
    if (existing) {
      throw new HttpError(409, 'An account with this email already exists. Please sign in instead.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const dbUser = await UserModel.create({
      name: name.trim(),
      email,
      role,
      passwordHash,
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
      ...(role === 'business' && { businessName: businessName?.trim() || name.trim() }),
      ...(role === 'worker' && {
        university: university?.trim() ?? '',
        major:      major?.trim() ?? '',
        year:       year?.trim() ?? '',
        skills:     [],
        bio:        '',
        sampleWork: [],
      }),
    });

    res.status(201).json({ token: issueToken(dbUser.id, dbUser.role), user: serializeSelf(dbUser) });
  })
);

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isString().trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
    body('password').isString().notEmpty().withMessage('Password is required'),
  ],
  ah(async (req, res) => {
    if (sendValidationError(req, res)) return;
    const { email, password } = req.body;

    const dbUser = await UserModel.findOne({ email }).select('+passwordHash');
    // Same message for "no account" and "wrong password" so attackers can't
    // discover which emails are registered.
    const valid = !!dbUser?.passwordHash && await bcrypt.compare(password, dbUser.passwordHash);
    if (!dbUser || !valid) {
      throw new HttpError(401, 'Incorrect email or password.');
    }

    res.json({ token: issueToken(dbUser.id, dbUser.role), user: serializeSelf(dbUser) });
  })
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, ah(async (req, res) => {
  const dbUser = await UserModel.findById(req.user!.id);
  if (!dbUser) throw new HttpError(401, 'Account not found. Please sign in again.');
  res.json({ user: serializeSelf(dbUser) });
}));

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put(
  '/profile',
  requireAuth,
  [
    body('email').not().exists().withMessage('Email cannot be changed here'),
    body('role').not().exists().withMessage('Role cannot be changed'),
    body('name').optional().isString().trim().notEmpty().withMessage('Name cannot be empty')
      .isLength({ max: 80 }).withMessage('Name is too long'),
    optStr('bio', 1000), optStr('university', 120), optStr('major', 120), optStr('year', 60),
    optStr('businessName', 100), optStr('industry', 60), optStr('location', 120),
    optStr('website', 200), optStr('phone', 30), optStr('locationLabel', 120),
    body('skills').optional().isArray({ max: 30 }).withMessage('You can add up to 30 skills'),
    body('skills.*').optional().isString().trim().isLength({ min: 1, max: 40 }).withMessage('Each skill must be 1–40 characters'),
    body('sampleWork').optional().isArray({ max: 20 }).withMessage('You can add up to 20 portfolio items'),
    body('sampleWork.*').optional().isString().trim().isLength({ min: 1, max: 300 }).withMessage('Each portfolio item must be 1–300 characters'),
    body('latitude').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude').toFloat(),
    body('longitude').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude').toFloat(),
    body('radiusMiles').optional({ values: 'null' }).isFloat({ min: 1, max: RADIUS_MAX }).withMessage(`Range must be 1–${RADIUS_MAX} miles`).toFloat(),
    body('photoUrl').optional({ values: 'null' }).isString().withMessage('Invalid photo'),
    body('availability').optional().isArray({ max: AVAILABILITY_SLOTS.length }).withMessage('Invalid availability'),
    body('availability.*').optional().isIn(AVAILABILITY_SLOTS).withMessage('Invalid availability option'),
    optStr('availabilityNote', 200),
    body('availableUntil').optional({ values: 'null' }).isISO8601().withMessage('Invalid time').toDate(),
    body('discoverable').optional().isBoolean().withMessage('discoverable must be true or false').toBoolean(),
    body('notifyNewGigs').optional().isBoolean().withMessage('notifyNewGigs must be true or false').toBoolean(),
  ],
  ah(async (req, res) => {
    if (sendValidationError(req, res)) return;

    const role = req.user!.role;
    const shared = ['name', 'bio', 'locationLabel', 'latitude', 'longitude', 'radiusMiles', 'photoUrl'];
    const workerOnly = ['skills', 'university', 'major', 'year', 'sampleWork',
      'availability', 'availabilityNote', 'availableUntil', 'discoverable', 'notifyNewGigs'];
    const businessOnly = ['businessName', 'industry', 'location', 'website', 'phone'];
    const allowed = [...shared, ...(role === 'worker' ? workerOnly : businessOnly)];

    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    // Latitude and longitude only make sense together
    if ((update.latitude == null) !== (update.longitude == null) &&
        (update.latitude !== undefined || update.longitude !== undefined)) {
      throw new HttpError(400, 'Latitude and longitude must be sent together');
    }
    if (Array.isArray(update.skills)) {
      update.skills = [...new Set((update.skills as string[]).map(s => s.trim()).filter(Boolean))];
    }
    if (Array.isArray(update.availability)) update.availability = [...new Set(update.availability as string[])];

    // "Available now" lasts at most 48 hours, so nobody stays "available" by accident
    if (update.availableUntil instanceof Date) {
      const ms = +update.availableUntil - Date.now();
      if (ms <= 0) update.availableUntil = null;
      else if (ms > AVAILABLE_NOW_MAX_MS) update.availableUntil = new Date(Date.now() + AVAILABLE_NOW_MAX_MS);
    }

    // Profile photo: must be an image this user uploaded; '' or null removes it
    if (update.photoUrl !== undefined) {
      if (update.photoUrl) await assertOwnUploads(req.user!.id, [update.photoUrl as string]);
      else update.photoUrl = null;
    }

    // Keep the GeoJSON mirror (used by worker search) in step with lat/lng
    const unset: Record<string, 1> = {};
    if (update.latitude != null && update.longitude != null) {
      update.geo = { type: 'Point', coordinates: [update.longitude, update.latitude] };
    } else if (update.latitude === null) {
      unset.geo = 1;
    }
    for (const [k, v] of Object.entries(update)) {
      if (v === null) { unset[k] = 1; delete update[k]; }
    }

    const dbUser = await UserModel.findByIdAndUpdate(
      req.user!.id,
      { $set: update, ...(Object.keys(unset).length && { $unset: unset }) },
      { returnDocument: 'after', runValidators: true }
    );
    if (!dbUser) throw new HttpError(404, 'User not found.');

    // Businesses: show the new photo on their gig cards too
    if (role === 'business' && 'photoUrl' in req.body) {
      await GigModel.updateMany({ businessId: dbUser._id }, dbUser.photoUrl
        ? { businessPhotoUrl: dbUser.photoUrl }
        : { $unset: { businessPhotoUrl: 1 } });
    }
    res.json({ user: serializeSelf(dbUser) });
  })
);

// ── PUT /api/auth/password ────────────────────────────────────────────────────
router.put(
  '/password',
  requireAuth,
  [
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    body('newPassword').isString().isLength({ min: 8, max: 128 }).withMessage('New password must be at least 8 characters'),
  ],
  ah(async (req, res) => {
    if (sendValidationError(req, res)) return;
    const dbUser = await UserModel.findById(req.user!.id).select('+passwordHash');
    if (!dbUser?.passwordHash) throw new HttpError(404, 'User not found.');
    const ok = await bcrypt.compare(req.body.currentPassword, dbUser.passwordHash);
    if (!ok) throw new HttpError(400, 'Current password is incorrect.');
    dbUser.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await dbUser.save();
    res.json({ success: true });
  })
);

// ── Forgot password (email code) ──────────────────────────────────────────────
// Always answers the same way whether or not the email has an account, so the
// endpoint can't be used to find out who is registered.
router.post(
  '/forgot-password',
  [body('email').isString().trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail()],
  ah(async (req, res) => {
    if (sendValidationError(req, res)) return;
    const { email } = req.body;
    const user = await UserModel.findOne({ email }).select('_id').lean();
    if (user) await issueCode(email, 'reset', req.body.lang);
    res.json({ success: true, message: 'If an account exists for this email, we have sent a 6-digit code to it.' });
  })
);

// Reset the password with the emailed code; signs the user in.
router.post(
  '/reset-password',
  [
    body('email').isString().trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
    body('code').isString().trim(),
    body('newPassword').isString().isLength({ min: 8, max: 128 }).withMessage('New password must be at least 8 characters'),
  ],
  ah(async (req, res) => {
    if (sendValidationError(req, res)) return;
    const { email, code, newPassword } = req.body;
    await consumeCode(email, 'reset', String(code).trim());
    const dbUser = await UserModel.findOne({ email }).select('+passwordHash');
    if (!dbUser) throw new HttpError(400, 'This code has expired. Please ask for a new one.');
    dbUser.passwordHash = await bcrypt.hash(newPassword, 12);
    dbUser.emailVerified = true; // they proved they own the inbox
    await dbUser.save();
    res.json({ token: issueToken(dbUser.id, dbUser.role), user: serializeSelf(dbUser) });
  })
);

// ── Verify your email (signed in) ─────────────────────────────────────────────
router.post('/email/send-code', requireAuth, ah(async (req, res) => {
  const dbUser = await UserModel.findById(req.user!.id);
  if (!dbUser) throw new HttpError(401, 'Account not found. Please sign in again.');
  if (dbUser.emailVerified) return res.json({ success: true, alreadyVerified: true });
  await issueCode(dbUser.email, 'verify', req.body?.lang);
  res.json({ success: true });
}));

router.post('/email/verify', requireAuth, ah(async (req, res) => {
  const dbUser = await UserModel.findById(req.user!.id);
  if (!dbUser) throw new HttpError(401, 'Account not found. Please sign in again.');
  if (!dbUser.emailVerified) {
    await consumeCode(dbUser.email, 'verify', String(req.body?.code ?? '').trim());
    dbUser.emailVerified = true;
    await dbUser.save();
  }
  res.json({ user: serializeSelf(dbUser) });
}));

export default router;
