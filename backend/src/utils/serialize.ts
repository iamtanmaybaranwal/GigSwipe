// Converts database documents into the exact JSON shapes the mobile apps expect.
// Every response that contains another person's data goes through here, so
// private fields (email, password hash, hire codes) are removed in ONE place.

import type { IApplication } from '../models/Application';
import type { IMessage } from '../models/Message';

const idOf = (v: any): string => (v == null ? '' : v._id ? v._id.toString() : v.toString());
const iso = (d: any): string | undefined => (d ? new Date(d).toISOString() : undefined);

/** A user's own account (includes email). */
export function serializeSelf(u: any) {
  if (!u) return null;
  const o = typeof u.toObject === 'function' ? u.toObject() : { ...u };
  const out: Record<string, any> = { ...o, id: idOf(o._id) };
  delete out._id;
  delete out.__v;
  delete out.passwordHash;
  delete out.geo;
  delete out.gigAlerts;
  out.createdAt = iso(o.createdAt);
  out.updatedAt = iso(o.updatedAt);
  out.availableUntil = iso(o.availableUntil);
  out.emailVerified = !!o.emailVerified;
  out.availableNow = !!o.availableUntil && new Date(o.availableUntil) > new Date();
  if (out.discoverable === undefined && o.role === 'worker') out.discoverable = true;
  return out;
}

/**
 * Someone else's profile: same as self but without email or exact home
 * coordinates (a distance is added by the routes that need one).
 */
export function serializePublicUser(u: any) {
  const out = serializeSelf(u);
  if (!out) return null;
  delete out.email;
  delete out.latitude;
  delete out.longitude;
  delete out.radiusMiles;
  delete out.discoverable;
  delete out.notifyNewGigs;
  return out;
}

/**
 * An application as seen by `viewerId`.
 * The hire code is only ever sent to the worker; the business just learns
 * whether a code is currently active (`hireCodeActive`).
 */
export function serializeApplication(a: IApplication | any, viewerId: string) {
  const workerId = idOf(a.workerId);
  const isWorker = viewerId === workerId;
  const codeActive = !!a.hireCode && !!a.hireCodeExpiry && new Date(a.hireCodeExpiry) > new Date()
    && a.status === 'accepted';

  return {
    id:            idOf(a._id),
    gigId:         idOf(a.gigId),
    gigTitle:      a.gigTitle,
    workerId,
    businessId:    idOf(a.businessId),
    businessName:  a.businessName,
    businessColor: a.businessColor,
    status:        a.status,
    createdAt:     iso(a.createdAt) as string,
    hiredAt:       iso(a.hiredAt),
    hireCodeActive: codeActive,
    ...(isWorker && codeActive && {
      hireCode:       a.hireCode,
      hireCodeExpiry: iso(a.hireCodeExpiry),
    }),
  };
}

export function serializeMessage(m: IMessage | any) {
  return {
    id:            idOf(m._id),
    applicationId: idOf(m.applicationId),
    senderId:      idOf(m.senderId),
    senderName:    m.senderName,
    senderRole:    m.senderRole,
    text:          m.text,
    timestamp:     iso(m.createdAt) as string,
  };
}
