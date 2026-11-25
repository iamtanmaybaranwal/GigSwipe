// "Update required" / "update available" state, like banking apps.
//
// - On launch and whenever the app comes back to the foreground, we ask the
//   server which versions are allowed (GET /api/app/version).
// - Every API call also carries X-App-Version; if the server answers 426,
//   the app is blocked immediately (see api/client.ts).
// Offline or server errors never block the app.
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { BASE_URL } from '../config';
import pkg from '../../package.json';

export const APP_VERSION: string = pkg.version;
export const APP_PLATFORM: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';

export interface UpdateState {
  required: boolean;
  available: boolean;
  latest?: string;
  url?: string;
  message?: string;
  dismissed: boolean;
}

let state: UpdateState = { required: false, available: false, dismissed: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<UpdateState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };

export const useUpdateState = () =>
  useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);

/** Called by the API client when the server rejects this version (HTTP 426). */
export function markUpdateRequired(info: { updateUrl?: string; latest?: string; message?: string }) {
  set({ required: true, url: info.updateUrl || state.url, latest: info.latest || state.latest, message: info.message || state.message });
}

export const dismissUpdateBanner = () => set({ dismissed: true });

let inFlight: Promise<void> | null = null;

export function checkForUpdate(): Promise<void> {
  if (inFlight) return inFlight;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  inFlight = fetch(`${BASE_URL}/api/app/version?platform=${APP_PLATFORM}&version=${encodeURIComponent(APP_VERSION)}`, {
    headers: { Accept: 'application/json' },
    signal: controller.signal,
  })
    .then(r => (r.ok ? r.json() : null))
    .then((d: null | { updateRequired: boolean; updateAvailable: boolean; latest: string; updateUrl: string; message: string }) => {
      if (!d) return;
      set({
        required: !!d.updateRequired,
        available: !!d.updateAvailable,
        latest: d.latest,
        url: d.updateUrl,
        message: d.message,
      });
    })
    .catch(() => { /* offline: never block the app on a failed check */ })
    .finally(() => { clearTimeout(timer); inFlight = null; });
  return inFlight;
}
