// Push notifications on the Android app (Firebase Cloud Messaging).
// The web app has its own version in push.web.ts with the same functions.
import { PermissionsAndroid, Platform } from 'react-native';
import { api } from '../api';
import { getLanguage } from '../i18n';
import { consumePendingGigId as nativePendingGig, getPushToken, prefs } from './device';

export type PushState = 'ready' | 'needs-permission' | 'denied' | 'unsupported' | 'needs-install';

const NEEDS_RUNTIME_PERMISSION = Platform.OS === 'android' && Number(Platform.Version) >= 33;
const PERM = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;

async function permissionGranted(): Promise<boolean> {
  if (!NEEDS_RUNTIME_PERMISSION) return true;
  try { return await PermissionsAndroid.check(PERM); } catch { return false; }
}

export async function pushState(): Promise<PushState> {
  if (!(await getPushToken())) return 'unsupported'; // Firebase not set up in this build
  if (await permissionGranted()) return 'ready';
  return prefs.get('push_denied') === '1' ? 'denied' : 'needs-permission';
}

async function register(): Promise<boolean> {
  const token = await getPushToken();
  if (!token) return false;
  await api.push.register({ platform: 'android', token, lang: getLanguage() });
  prefs.set('push_token', token);
  return true;
}

/** Ask for permission (Android 13+) and register this phone. */
export async function enablePush(): Promise<boolean> {
  if (NEEDS_RUNTIME_PERMISSION && !(await permissionGranted())) {
    const res = await PermissionsAndroid.request(PERM);
    if (res !== PermissionsAndroid.RESULTS.GRANTED) {
      if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) prefs.set('push_denied', '1');
      return false;
    }
  }
  try { return await register(); } catch { return false; }
}

/** After sign-in / app start: keep this phone registered if permission was already given. */
export async function syncPushRegistration(): Promise<void> {
  try {
    if (await permissionGranted()) await register();
  } catch { /* offline: try next time */ }
}

/** On sign-out: stop sending this account's notifications to this phone. */
export async function unregisterPush(): Promise<void> {
  const token = prefs.get('push_token');
  if (!token) return;
  try { await api.push.unregister(token); } catch { /* best effort */ }
  prefs.set('push_token', '');
}

export function consumePendingGigId(): string | null {
  return nativePendingGig() || null;
}

/** Web-only (service worker messages); nothing to do on the phone. */
export function onOpenGig(_cb: (gigId: string) => void): () => void {
  return () => {};
}
