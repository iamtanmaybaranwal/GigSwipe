// ─────────────────────────────────────────────────────────────────────────────
// In-memory data store for applications/chat — resets on server restart
// (expected for this phase). Gigs and users are real MongoDB collections;
// see models/Gig.ts and models/User.ts. No demo/seed data — production
// databases start clean and are populated only by real signups.
// ─────────────────────────────────────────────────────────────────────────────

import type { User, Application, Message } from './types';

export const users        = new Map<string, User>();
export const applications = new Map<string, Application>();
export const messages     = new Map<string, Message[]>(); // key = applicationId
