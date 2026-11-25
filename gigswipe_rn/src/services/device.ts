// Wrapper around GigSwipe's native module: small persistent settings and
// on-device gig reminders. Falls back to memory when the module isn't there
// (unit tests), so callers never need to check.
import NativeGigSwipe from '../specs/NativeGigSwipe';

const memory = new Map<string, string>();

export const prefs = {
  get(key: string): string {
    try { return NativeGigSwipe ? NativeGigSwipe.getPref(key) : memory.get(key) ?? ''; } catch { return memory.get(key) ?? ''; }
  },
  set(key: string, value: string) {
    memory.set(key, value);
    try { NativeGigSwipe?.setPref(key, value); } catch { /* ignore */ }
  },
};

export interface Reminder {
  id: string;
  at: number; // ms since epoch
  title: string;
  body: string;
}

/** Replaces every scheduled reminder with `list` (an empty list cancels them all). */
export function setReminders(list: Reminder[]) {
  try { NativeGigSwipe?.setReminders(JSON.stringify(list)); } catch { /* ignore */ }
}

/** Firebase push token for this device ('' when push isn't set up in this build). */
export async function getPushToken(): Promise<string> {
  try { return NativeGigSwipe ? await NativeGigSwipe.getPushToken() : ''; } catch { return ''; }
}

/** Gig id from a tapped "new gig" notification (returned once), or ''. */
export function consumePendingGigId(): string {
  try { return NativeGigSwipe ? NativeGigSwipe.consumePendingGigId() : ''; } catch { return ''; }
}
