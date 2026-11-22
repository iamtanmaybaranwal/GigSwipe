// Haversine distance between two lat/lng points, in miles.
const EARTH_RADIUS_MILES = 3958.8;
export const MILES_TO_METERS = 1609.34;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function milesBetween(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}
