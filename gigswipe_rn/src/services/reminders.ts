// Builds the list of "your gig starts soon" reminders from the user's
// accepted / hired gigs and hands it to the native scheduler.
import { PermissionsAndroid, Platform } from 'react-native';
import type { Conversation } from '../api';
import { t } from '../i18n';
import { formatTime } from '../utils/format';
import { prefs, setReminders, type Reminder } from './device';

const HOUR = 3600_000;

export const remindersEnabled = () => prefs.get('reminders') !== 'off';
export const setRemindersEnabled = (on: boolean) => prefs.set('reminders', on ? 'on' : 'off');

/** Asks for notification permission once (Android 13+), the first time a reminder is needed. */
async function ensurePermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true; // web/iOS: nothing to ask here
  const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(perm)) return true;
  if (prefs.get('notif_asked') === '1') return false;
  prefs.set('notif_asked', '1');
  return (await PermissionsAndroid.request(perm)) === PermissionsAndroid.RESULTS.GRANTED;
}

export function buildReminders(conversations: Conversation[], role: 'worker' | 'business', now = Date.now()): Reminder[] {
  const list: Reminder[] = [];
  const seenGigs = new Set<string>();
  for (const c of conversations) {
    if (!c.gigStartAt || (c.status !== 'accepted' && c.status !== 'hired')) continue;
    const start = new Date(c.gigStartAt).getTime();
    if (start <= now) continue;
    // A job giver with several people on one gig gets one reminder for the gig
    if (role === 'business') {
      if (seenGigs.has(c.gigId)) continue;
      seenGigs.add(c.gigId);
    }
    const where = c.gigLocation && c.gigLocation !== 'Remote' ? ` · ${c.gigLocation}` : '';
    const time = formatTime(c.gigStartAt);
    const body = role === 'worker'
      ? t('{gig} with {business} at {time}{where}', { gig: c.gigTitle, business: c.businessName, time, where })
      : t('{gig} starts at {time}{where}', { gig: c.gigTitle, time, where });

    if (start - HOUR > now) list.push({ id: `${c.gigId}:1h`, at: start - HOUR, title: t('Your gig starts in 1 hour'), body });
    if (start - 24 * HOUR > now) list.push({ id: `${c.gigId}:1d`, at: start - 24 * HOUR, title: t('Your gig is tomorrow'), body });
  }
  return list.sort((a, b) => a.at - b.at);
}

let lastSignature = '';

/** Re-schedules reminders if anything changed. Safe to call often. */
export async function syncReminders(conversations: Conversation[], role: 'worker' | 'business') {
  const list = remindersEnabled() ? buildReminders(conversations, role) : [];
  const signature = JSON.stringify(list);
  if (signature === lastSignature) return;
  // Schedule even if permission is refused: if they allow notifications later
  // in Settings, the reminders still show up.
  if (list.length) await ensurePermission();
  lastSignature = signature;
  setReminders(list);
}

let refresher: (() => void) | null = null;
/** The navigator registers how to rebuild reminders (it has the data). */
export const registerReminderRefresher = (fn: (() => void) | null) => { refresher = fn; };
/** Rebuild reminders now (e.g. after the setting was toggled). */
export const refreshReminders = () => { refresher?.(); };

/** On sign-out: nothing should fire for the previous account. */
export function clearReminders() {
  lastSignature = '';
  setReminders([]);
}
