import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { users } from '../store';
import UserModel from '../models/User';
import type { User } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Ensure the user object is in the in-memory store.
// Runs silently — never blocks a request.
async function ensureInStore(userId: string): Promise<void> {
  if (users.has(userId)) return;
  try {
    const dbUser = await UserModel.findById(userId);
    if (!dbUser) return;
    const storeUser: User = {
      id:           dbUser.id,
      name:         dbUser.name,
      email:        dbUser.email,
      role:         dbUser.role,
      avatarColor:  dbUser.avatarColor ?? '#ff5864',
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
    users.set(userId, storeUser);
  } catch {
    // Non-fatal — gig routes will handle missing users gracefully
  }
}

// Best-effort auth: if a valid Bearer token is present, attaches req.user;
// otherwise continues as an anonymous request. Used by public routes (like
// the gig feed) that personalize results for logged-in users without
// requiring a session.
export async function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const secret = process.env.JWT_SECRET;
  if (!header?.startsWith('Bearer ') || !secret) return next();

  try {
    const payload = jwt.verify(header.slice(7), secret) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
    await ensureInStore(payload.sub);
  } catch {
    // Invalid/expired token on a public route — just proceed anonymously
  }
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required. Please sign in.' });
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[auth] JWT_SECRET is not set in .env');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
    // Re-sync user to in-memory store after a backend restart
    await ensureInStore(payload.sub);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}
