import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { users } from '../store';
import UserModel from '../models/User';
import { requireAuth } from '../middleware/auth';
import type { User } from '../types';

const router = Router();

const COLORS = ['#ff5864', '#7B61FF', '#FF9500', '#34C759', '#FF2D55', '#5AC8FA'];

// Helper: sync a MongoDB user into the in-memory store so gig/application routes
// can look up user info without hitting the DB on every request.
function syncToStore(dbUser: InstanceType<typeof UserModel>) {
  const storeUser: User = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    avatarColor: dbUser.avatarColor ?? COLORS[0],
    businessName: dbUser.businessName,
    industry:     dbUser.industry,
    location:     dbUser.location,
    website:      dbUser.website,
    phone:        dbUser.phone,
    university:   dbUser.university,
    major:        dbUser.major,
    year:         dbUser.year,
    skills:       dbUser.skills,
    bio:          dbUser.bio,
    sampleWork:   dbUser.sampleWork,
    locationLabel: dbUser.locationLabel,
    latitude:      dbUser.latitude,
    longitude:     dbUser.longitude,
    radiusMiles:   dbUser.radiusMiles,
  };
  users.set(dbUser.id, storeUser);
}

function issueToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: '30d' });
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Please enter a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['worker', 'business']).withMessage('Role must be "job seeker" or "job giver"'),
  ],
  async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, email, password, role, businessName, university, major, year } = req.body;

    try {
      const existing = await UserModel.findOne({ email });
      if (existing) {
        return res.status(409).json({
          error: 'An account with this email already exists. Please sign in instead.',
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];

      const dbUser = await UserModel.create({
        name: name.trim(),
        email,
        role,
        passwordHash,
        avatarColor: color,
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

      syncToStore(dbUser);

      const token = issueToken(dbUser.id, dbUser.role);
      return res.status(201).json({ token, user: dbUser.toJSON() });
    } catch (err) {
      console.error('[auth/register]', err);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  }
);

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Please enter a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    try {
      // Select passwordHash explicitly (it has select:false in the schema)
      const dbUser = await UserModel.findOne({ email }).select('+passwordHash');
      if (!dbUser || !dbUser.passwordHash) {
        return res.status(401).json({ error: 'No account found for that email. Please register first.' });
      }

      const valid = await bcrypt.compare(password, dbUser.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }

      syncToStore(dbUser);

      const token = issueToken(dbUser.id, dbUser.role);
      return res.json({ token, user: dbUser.toJSON() });
    } catch (err) {
      console.error('[auth/login]', err);
      return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: any, res: any) => {
  try {
    const dbUser = await UserModel.findById(req.user!.id);
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found. Please sign in again.' });
    }
    syncToStore(dbUser);
    return res.json({ user: dbUser.toJSON() });
  } catch (err) {
    console.error('[auth/me]', err);
    return res.status(500).json({ error: 'Could not fetch user.' });
  }
});

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put(
  '/profile',
  requireAuth,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').not().exists().withMessage('Email cannot be changed here'),
  ],
  async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const {
      name, bio, skills, university, major, year, sampleWork,
      businessName, industry, location, website, phone,
      locationLabel, latitude, longitude, radiusMiles,
    } = req.body;

    try {
      const dbUser = await UserModel.findByIdAndUpdate(
        req.user!.id,
        {
          ...(name !== undefined         && { name }),
          ...(bio !== undefined          && { bio }),
          ...(skills !== undefined       && { skills }),
          ...(university !== undefined   && { university }),
          ...(major !== undefined        && { major }),
          ...(year !== undefined         && { year }),
          ...(sampleWork !== undefined   && { sampleWork }),
          ...(businessName !== undefined && { businessName }),
          ...(industry !== undefined     && { industry }),
          ...(location !== undefined     && { location }),
          ...(website !== undefined      && { website }),
          ...(phone !== undefined        && { phone }),
          ...(locationLabel !== undefined && { locationLabel }),
          ...(latitude !== undefined      && { latitude }),
          ...(longitude !== undefined     && { longitude }),
          ...(radiusMiles !== undefined   && { radiusMiles }),
        },
        { new: true }
      );

      if (!dbUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      syncToStore(dbUser);
      return res.json({ user: dbUser.toJSON() });
    } catch (err) {
      console.error('[auth/profile]', err);
      return res.status(500).json({ error: 'Profile update failed. Please try again.' });
    }
  }
);

export default router;
