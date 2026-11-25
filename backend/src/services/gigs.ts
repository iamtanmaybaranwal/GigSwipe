// Business rules shared by the gig, application and invite routes.
import mongoose from 'mongoose';
import GigModel, { type IGig } from '../models/Gig';
import ApplicationModel, { type IApplication } from '../models/Application';
import UploadModel from '../models/Upload';
import { HttpError } from '../utils/http';
import { isGigExpired } from '../utils/serializeGig';
import { emitToRole, emitToUser } from '../realtime';

export const UPLOAD_PATH = /^\/api\/uploads\/([a-f0-9]{24})$/;

/** Throws unless every path is an /api/uploads/<id> image uploaded by `userId`. */
export async function assertOwnUploads(userId: string, paths: string[]) {
  const ids = paths.map(p => {
    const m = UPLOAD_PATH.exec(p);
    if (!m) throw new HttpError(400, 'Invalid photo. Please upload it again.');
    return m[1];
  });
  if (!ids.length) return;
  const count = await UploadModel.countDocuments({ _id: { $in: ids }, ownerId: userId });
  if (count !== new Set(ids).size) throw new HttpError(400, 'Invalid photo. Please upload it again.');
}

/** Why a gig can't take new applications, or null if it can. */
export function closedReason(gig: Pick<IGig, 'status' | 'startAt' | 'endAt'>): string | null {
  if (gig.status === 'filled') return 'This gig has been filled.';
  if (gig.status === 'closed') return 'This gig is no longer taking applications.';
  if (isGigExpired(gig)) return 'This gig has already ended.';
  return null;
}

/**
 * Creates (or returns the existing) application from `workerId` to `gig`.
 * Used by swipe-right, "Apply now" and accepting an invite.
 */
export async function applyToGig(workerId: string, gig: IGig): Promise<{ app: IApplication; alreadyApplied: boolean }> {
  const existing = await ApplicationModel.findOne({ gigId: gig._id, workerId });
  if (existing) return { app: existing, alreadyApplied: true };

  const reason = closedReason(gig);
  if (reason) throw new HttpError(409, reason);

  try {
    const app = await ApplicationModel.create({
      gigId:         gig._id,
      gigTitle:      gig.title,
      workerId,
      businessId:    gig.businessId,
      businessName:  gig.businessName,
      businessColor: gig.businessColor,
      status:        'pending',
    });
    emitToUser(gig.businessId.toString(), 'application_update', {
      applicationId: String(app._id), status: app.status, gigId: String(gig._id),
    });
    return { app, alreadyApplied: false };
  } catch (err: any) {
    // Two quick taps can race past the findOne above — the unique index catches it
    if (err?.code === 11000) {
      const app = await ApplicationModel.findOne({ gigId: gig._id, workerId });
      if (app) return { app, alreadyApplied: true };
    }
    throw err;
  }
}

/**
 * Called after a hire is confirmed. Counts the hire against the gig's openings;
 * once every opening is filled the gig closes and remaining pending applicants
 * are told the position was filled.
 */
export async function recordHire(gigId: mongoose.Types.ObjectId | string) {
  const gig = await GigModel.findByIdAndUpdate(gigId, { $inc: { hiredCount: 1 } }, { returnDocument: 'after' });
  if (!gig || gig.hiredCount < gig.openings || gig.status !== 'open') return gig;

  gig.status = 'filled';
  await gig.save();
  emitToRole('worker', 'gig_closed', { gigId: String(gig._id) });
  const pending = await ApplicationModel.find({ gigId: gig._id, status: 'pending' });
  if (pending.length) {
    await ApplicationModel.updateMany({ _id: { $in: pending.map(a => a._id) } }, { status: 'rejected' });
    for (const a of pending) {
      const payload = { applicationId: String(a._id), status: 'rejected' };
      emitToUser(a.workerId.toString(), 'application_update', payload);
      emitToUser(a.businessId.toString(), 'application_update', payload);
    }
  }
  return gig;
}

/** Status a gig should have after its openings change. */
export function statusForOpenings(gig: Pick<IGig, 'status' | 'openings' | 'hiredCount'>): IGig['status'] {
  if (gig.status === 'closed') return 'closed';
  return gig.hiredCount >= gig.openings ? 'filled' : 'open';
}
