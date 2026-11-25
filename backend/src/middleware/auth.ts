import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: 'worker' | 'business' };
    }
  }
}

interface JwtPayload {
  sub: string;
  role: 'worker' | 'business';
}

export function verifyToken(token: string): { id: string; role: 'worker' | 'business' } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret) as unknown as JwtPayload;
    if (!payload?.sub || (payload.role !== 'worker' && payload.role !== 'business')) return null;
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function issueToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET!, { expiresIn: '30d' });
}

const bearer = (req: Request) => {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
};

// Best-effort auth for public routes (like the gig feed) that personalise
// results for signed-in users without requiring a session.
export function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  const user = token ? verifyToken(token) : null;
  if (user) req.user = user;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Authorization header required. Please sign in.' });
  }
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
  req.user = user;
  next();
}

export function requireRole(role: 'worker' | 'business') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return res.status(403).json({
        error: role === 'business' ? 'Only job givers can do this' : 'Only job seekers can do this',
      });
    }
    next();
  };
}
