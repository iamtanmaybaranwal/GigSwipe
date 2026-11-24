// Device location: permission, current position and a readable area name.
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation, { type GeolocationResponse } from '@react-native-community/geolocation';
import { api } from '../api';

Geolocation.setRNConfiguration({
  skipPermissionRequests: true, // we ask ourselves, with an explanation
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',      // Google Play services when available, else Android's provider
});

export type PermissionResult = 'granted' | 'denied' | 'blocked';

export async function hasLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const fine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  const coarse = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
  return fine || coarse;
}

export async function requestLocationPermission(): Promise<PermissionResult> {
  if (Platform.OS !== 'android') return 'granted';
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);
  const values = Object.values(result);
  if (values.includes(PermissionsAndroid.RESULTS.GRANTED)) return 'granted';
  if (values.includes(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) return 'blocked';
  return 'denied';
}

export class LocationError extends Error {}

function getPosition(highAccuracy: boolean): Promise<GeolocationResponse> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      timeout: highAccuracy ? 20000 : 12000,
      maximumAge: 5 * 60 * 1000,
    });
  });
}

/** Current coordinates. Tries a fast network fix first, then GPS. */
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

/** "Seattle, WA" — falls back to rounded coordinates if lookup fails. */
export async function describeLocation(latitude: number, longitude: number): Promise<string> {
  try {
    const { label } = await api.geo.reverse(latitude, longitude);
    if (label) return label;
  } catch {
    // best effort
  }
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

/** Rough distance in metres, used to skip tiny location updates. */
export function metersBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
