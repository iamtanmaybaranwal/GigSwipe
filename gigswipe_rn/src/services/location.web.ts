// Web version of device location, using the browser's Geolocation API.
// Browsers only allow location on HTTPS sites (and localhost).
import { api } from '../api';

export type PermissionResult = 'granted' | 'denied' | 'blocked';
export class LocationError extends Error {}

async function permissionState(): Promise<PermissionState | 'unsupported'> {
  try {
    const st = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return st.state;
  } catch {
    return 'unsupported'; // e.g. older Safari
  }
}

export async function hasLocationPermission(): Promise<boolean> {
  return (await permissionState()) === 'granted';
}

/** Browsers ask when we first read the position, so "request" = try once. */
export async function requestLocationPermission(): Promise<PermissionResult> {
  const st = await permissionState();
  if (st === 'granted') return 'granted';
  if (st === 'denied') return 'blocked';
  try {
    await getPosition(false);
    return 'granted';
  } catch (e: any) {
    return e?.code === 1 ? 'blocked' : 'granted'; // other errors: let getCurrentCoords explain
  }
}

function getPosition(highAccuracy: boolean): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject({ code: 2 }); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      timeout: highAccuracy ? 20000 : 12000,
      maximumAge: 5 * 60 * 1000,
    });
  });
}

export async function getCurrentCoords(): Promise<{ latitude: number; longitude: number }> {
  try {
    const p = await getPosition(false);
    return { latitude: p.coords.latitude, longitude: p.coords.longitude };
  } catch {
    try {
      const p = await getPosition(true);
      return { latitude: p.coords.latitude, longitude: p.coords.longitude };
    } catch (e: any) {
      if (e?.code === 1) throw new LocationError('Location permission was denied.');
      if (e?.code === 2) throw new LocationError('Location is turned off. Turn on location in your phone settings and try again.');
      throw new LocationError('Could not get your location. Move to an open area or try again.');
    }
  }
}

export async function describeLocation(latitude: number, longitude: number): Promise<string> {
  try {
    const { label } = await api.geo.reverse(latitude, longitude);
    if (label) return label;
  } catch {
    // best effort
  }
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

export function metersBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
