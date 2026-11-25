// "A new gig was posted near you" — live in the app (socket) and as a push
// notification for job seekers whose working range covers the gig.
import UserModel from '../models/User';
import type { IGig } from '../models/Gig';
import { MILES_TO_METERS } from '../utils/geo';
import { emitToRole, emitToUser } from '../realtime';
import { sendPush } from './push';

const DEFAULT_RANGE_MILES = 10;
const MAX_RANGE_MILES = 500;
const MAX_RECIPIENTS = 2000;
// Spam guard: at most this many gig alerts per person per hour
const ALERTS_PER_HOUR = 6;
const HOUR = 60 * 60 * 1000;

const CURRENCY = () => process.env.CURRENCY_SYMBOL || '₹';

function alertText(gig: IGig, km: number, lang: 'en' | 'hi') {
  const pay = gig.pay || (gig.payAmount ? `${CURRENCY()}${gig.payAmount}` : '');
  const dist = km < 1 ? (lang === 'hi' ? '1 किमी से कम दूर' : 'under 1 km away') : `${km.toFixed(km < 10 ? 1 : 0)} ${lang === 'hi' ? 'किमी दूर' : 'km away'}`;
  return {
    title: lang === 'hi' ? `आपके पास नया काम: ${gig.title}` : `New gig near you: ${gig.title}`,
    body: [pay, dist, gig.businessName].filter(Boolean).join(' · '),
  };
}

/**
 * Called after a gig is posted (or reopened). Finds job seekers whose own
 * working range includes the gig, tells the ones online right away, and sends
 * a push notification to the rest (respecting their setting and the hourly cap).
 * Runs in the background; never throws.
 */
export async function announceNewGig(gig: IGig) {
  try {
    if (gig.workMode === 'remote' || !gig.geo?.coordinates?.length) {
      // Remote gigs have no "near you"; just refresh open feeds
      emitToRole('worker', 'gig_new', { gigId: String(gig._id), remote: true });
      return;
    }
    const [lng, lat] = gig.geo.coordinates;
    const nearby: { _id: any; radiusMiles?: number; distanceMeters: number; notifyNewGigs?: boolean; gigAlerts?: { windowStart?: Date; count?: number } }[] =
      await UserModel.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            distanceField: 'distanceMeters',
            spherical: true,
            maxDistance: MAX_RANGE_MILES * MILES_TO_METERS,
            query: { role: 'worker' },
          },
        },
        { $limit: MAX_RECIPIENTS * 3 },
        { $project: { radiusMiles: 1, distanceMeters: 1, notifyNewGigs: 1, gigAlerts: 1 } },
      ]);

    // Only people whose own range reaches the gig
    const inRange = nearby
      .filter(u => u.distanceMeters <= (u.radiusMiles ?? DEFAULT_RANGE_MILES) * MILES_TO_METERS)
      .slice(0, MAX_RECIPIENTS);

    for (const u of inRange) emitToUser(String(u._id), 'gig_new', { gigId: String(gig._id) });

    const now = Date.now();
    const toNotify = inRange.filter(u => {
      if (u.notifyNewGigs === false) return false;
      const start = u.gigAlerts?.windowStart ? new Date(u.gigAlerts.windowStart).getTime() : 0;
      return now - start > HOUR || (u.gigAlerts?.count ?? 0) < ALERTS_PER_HOUR;
    });
    if (!toNotify.length) return;

    // Count this alert against each person's hourly budget
    await UserModel.bulkWrite(toNotify.map(u => {
      const start = u.gigAlerts?.windowStart ? new Date(u.gigAlerts.windowStart).getTime() : 0;
      const fresh = now - start > HOUR;
      return {
        updateOne: {
          filter: { _id: u._id },
          update: fresh
            ? { $set: { 'gigAlerts.windowStart': new Date(now), 'gigAlerts.count': 1 } }
            : { $inc: { 'gigAlerts.count': 1 } },
        },
      };
    }));

    const kmById = new Map(toNotify.map(u => [String(u._id), u.distanceMeters / 1000]));
    // Group by distance band so each person sees their own distance
    const byKm = new Map<string, string[]>();
    for (const [id, km] of kmById) {
      const key = km < 1 ? '0' : km < 10 ? km.toFixed(1) : km.toFixed(0);
      byKm.set(key, [...(byKm.get(key) ?? []), id]);
    }
    for (const [key, ids] of byKm) {
      const km = Number(key);
      await sendPush(ids, lang => ({
        ...alertText(gig, km, lang),
        tag: `gig-${gig._id}`,
        data: { type: 'gig_new', gigId: String(gig._id) },
      }));
    }
  } catch (e) {
    console.error('[gig alerts]', (e as Error).message);
  }
}

/** A gig stopped taking applications (closed, filled, ended or deleted): drop it from open feeds. */
export function announceGigClosed(gigId: string) {
  emitToRole('worker', 'gig_closed', { gigId });
}
