import { timeAgo } from './time';
import { MILES_TO_METERS } from './geo';

const iso = (d: any): string | undefined => (d ? new Date(d).toISOString() : undefined);

/** True once a dated gig is over (its end time, or its start time if there is no end, has passed). */
export function isGigExpired(doc: { startAt?: Date | null; endAt?: Date | null }, now = new Date()): boolean {
  const end = doc.endAt ?? doc.startAt;
  return !!end && new Date(end) < now;
}

// Accepts either a Mongoose Gig document (.lean()'d or .toObject()'d) or a
// plain object from a $geoNear aggregation — both have the same raw shape,
// this just normalizes them into what the app's Gig type expects.
export function serializeGig(doc: any) {
  const openings = doc.openings ?? 1;
  const hiredCount = doc.hiredCount ?? 0;
  const json: Record<string, any> = {
    id:            doc._id.toString(),
    businessId:    doc.businessId.toString(),
    title:         doc.title,
    businessName:  doc.businessName,
    businessColor: doc.businessColor,
    businessPhotoUrl: doc.businessPhotoUrl || undefined,
    pay:           doc.pay,
    payAmount:     doc.payAmount ?? undefined,
    payUnit:       doc.payUnit ?? undefined,
    hours:         doc.hours ?? '',
    startAt:       iso(doc.startAt),
    endAt:         iso(doc.endAt),
    openings,
    hiredCount,
    spotsLeft:     Math.max(0, openings - hiredCount),
    status:        doc.status ?? 'open',
    expired:       isGigExpired(doc),
    description:   doc.description,
    category:      doc.category,
    workMode:      doc.workMode,
    location:      doc.location,
    photos:        doc.photos ?? [],
    createdAt:     new Date(doc.createdAt).toISOString(),
  };
  json.postedAt = timeAgo(json.createdAt);

  if (doc.geo?.coordinates) {
    json.longitude = doc.geo.coordinates[0];
    json.latitude  = doc.geo.coordinates[1];
  }
  if (doc.distanceMeters != null) {
    json.distanceMiles = doc.distanceMeters / MILES_TO_METERS;
  }

  return json;
}
