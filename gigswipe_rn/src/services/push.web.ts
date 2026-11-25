// Push notifications for the web app (Web Push via the service worker).
// Works in Chrome/Edge/Firefox on Android, Windows and Mac, and on iPhone/iPad
// once GigSwipe is added to the Home Screen (iOS 16.4+).
import { api } from '../api';
import { getLanguage } from '../i18n';
import { prefs } from './device';

export type PushState = 'ready' | 'needs-permission' | 'denied' | 'unsupported' | 'needs-install';

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function base64UrlToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

let publicKey: string | null | undefined;
async function serverKey(): Promise<string | null> {
  if (publicKey !== undefined) return publicKey;
  try { publicKey = (await api.push.config()).webPushPublicKey; } catch { publicKey = undefined; return null; }
  return publicKey;
}

export async function pushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'needs-install'; // iPhone: only Home Screen apps get push
  if (!supported() || !(await serverKey())) return 'unsupported';
  if (Notification.permission === 'granted') return 'ready';
  if (Notification.permission === 'denied') return 'denied';
  return 'needs-permission';
}

async function register(): Promise<boolean> {
  const key = await serverKey();
  if (!key) return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key) as BufferSource });
  await api.push.register({ platform: 'web', subscription: sub.toJSON(), lang: getLanguage() });
  prefs.set('push_token', sub.endpoint);
  return true;
}

/** Must run from a tap (browsers, especially Safari, require a user gesture). */
export async function enablePush(): Promise<boolean> {
  if (!supported()) return false;
  try {
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') return false;
    return await register();
  } catch {
    return false;
  }
}

export async function syncPushRegistration(): Promise<void> {
  try {
    if (supported() && Notification.permission === 'granted' && (!isIOS() || isStandalone())) await register();
  } catch { /* try next time */ }
}

export async function unregisterPush(): Promise<void> {
  const token = prefs.get('push_token');
  try {
    if (token) await api.push.unregister(token);
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch { /* best effort */ }
  prefs.set('push_token', '');
}

/** ?gig=<id> in the address (from a tapped notification), once. */
export function consumePendingGigId(): string | null {
  const url = new URL(window.location.href);
  const id = url.searchParams.get('gig');
  if (!id) return null;
  url.searchParams.delete('gig');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return /^[a-f0-9]{24}$/.test(id) ? id : null;
}

/** The service worker tells an already-open app which gig was tapped. */
export function onOpenGig(cb: (gigId: string) => void): () => void {
  if (!('serviceWorker' in navigator)) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'open-gig' && typeof e.data.gigId === 'string') cb(e.data.gigId);
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
