import { timeAgo } from './time';
import { MILES_TO_METERS } from './geo';

// Accepts either a Mongoose Gig document (.lean()'d or .toObject()'d) or a
// plain object from a $geoNear aggregation — both have the same raw shape,
// this just normalizes them into what the frontend's Gig type expects.
export function serializeGig(doc: any) {
  const json: Record<string, any> = {
    id:            doc._id.toString(),
    businessId:    doc.businessId.toString(),
    title:         doc.title,
    businessName:  doc.businessName,
    businessColor: doc.businessColor,
    pay:           doc.pay,
    hours:         doc.hours,
    description:   doc.description,
    category:      doc.category,
    workMode:      doc.workMode,
    location:      doc.location,
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
