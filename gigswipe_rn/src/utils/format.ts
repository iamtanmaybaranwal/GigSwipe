import { Alert, Linking, Platform, ToastAndroid } from 'react-native';
import { t } from '../i18n';
import { CURRENCY, PAY_UNITS } from '../config';

export function initials(name?: string | null, fallback = '?'): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts.slice(0, 2).map(p => p[0]!.toUpperCase()).join('');
}

/** plural(3, 'gig') → "3 gigs" (translated via the "{n} gigs" key). */
export const plural = (n: number, word: string, pluralWord = `${word}s`) =>
  t(`{n} ${n === 1 ? word : pluralWord}`, { n });

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return t('Just now');
  const min = Math.floor(sec / 60);
  if (min < 60) return t('{n}m ago', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('{n}h ago', { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return t('{n}d ago', { n: day });
  return formatDate(iso);
}

export function formatTime(iso?: string | Date): string {
  if (!iso) return '';
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? t('PM') : t('AM');
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const weekday = (d: Date) => t(WEEKDAYS[d.getDay()]!);
export const monthName = (d: Date) => t(MONTHS[d.getMonth()]!);

export function formatDate(iso?: string | Date): string {
  if (!iso) return '';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${monthName(d)}${sameYear ? '' : ` ${d.getFullYear()}`}`;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "Today", "Tomorrow", "Sat 14 Dec" */
export function dayName(iso: string | Date): string {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return t('Today');
  if (sameDay(d, new Date(now.getTime() + 86400000))) return t('Tomorrow');
  if (sameDay(d, new Date(now.getTime() - 86400000))) return t('Yesterday');
  return `${weekday(d)} ${formatDate(d)}`;
}

/** "Sat 14 Dec · 9:00 AM – 5:00 PM", or "14 Dec 9:00 AM – 16 Dec 6:00 PM" for multi-day. */
export function formatSchedule(startAt?: string, endAt?: string): string {
  if (!startAt) return '';
  const s = new Date(startAt);
  if (!endAt) return `${dayName(s)} · ${formatTime(s)}`;
  const e = new Date(endAt);
  if (sameDay(s, e)) return `${dayName(s)} · ${formatTime(s)} – ${formatTime(e)}`;
  return `${dayName(s)} ${formatTime(s)} – ${dayName(e)} ${formatTime(e)}`;
}

/** "Starts in 45 min", "Starts in 3 h", "Happening now", "Ended" */
export function startsIn(startAt?: string, endAt?: string): string {
  if (!startAt) return '';
  const now = Date.now();
  const s = new Date(startAt).getTime();
  const e = endAt ? new Date(endAt).getTime() : s;
  if (now > e) return t('Ended');
  if (now >= s) return t('Happening now');
  const min = Math.round((s - now) / 60000);
  if (min < 60) return t('Starts in {n} min', { n: Math.max(1, min) });
  const hr = Math.round(min / 60);
  if (hr < 24) return t('Starts in {n} h', { n: hr });
  return t('Starts {day}', { day: dayName(startAt) });
}

/** Hours between two ISO times, e.g. 7.5 */
export const durationHours = (startAt?: string, endAt?: string) =>
  startAt && endAt ? Math.max(0, (new Date(endAt).getTime() - new Date(startAt).getTime()) / 3600000) : 0;

/** Conversation list timestamp: time today, weekday this week, else date. */
export function listTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return formatTime(iso);
  const days = (now.getTime() - d.getTime()) / 86400000;
  if (days < 7) return weekday(d);
  return formatDate(iso);
}

export const distanceLabel = (miles?: number) =>
  miles == null ? '' : miles < 0.1 ? t('Nearby') : t('{n} mi', { n: miles < 10 ? miles.toFixed(1) : Math.round(miles) });

/** 1500 → "₹1,500" (Indian digit grouping for ₹, international otherwise) */
export function money(amount: number): string {
  const locale = CURRENCY === '₹' ? 'en-IN' : 'en-US';
  const n = Number.isInteger(amount) ? amount : Math.round(amount * 100) / 100;
  try { return `${CURRENCY}${n.toLocaleString(locale)}`; } catch { return `${CURRENCY}${n}`; }
}

/** "₹800/day" built from amount + unit (falls back to the server's text). */
export function payText(g: { pay?: string; payAmount?: number; payUnit?: string }): string {
  if (g.payAmount == null || !g.payUnit) return g.pay ?? '';
  const unit = PAY_UNITS.find(u => u.key === g.payUnit);
  return `${money(g.payAmount)}${unit ? t(unit.short) : ''}`;
}

/** Short confirmation message (native toast on Android). */
export function toast(message: string) {
  // Android: native toast. Web: a small snackbar (see web/shims). iOS: an alert.
  if (Platform.OS === 'ios') Alert.alert(message);
  else ToastAndroid.show(message, ToastAndroid.SHORT);
}

/** Opens turn-by-turn directions in Google Maps (app if installed, otherwise browser). */
export async function openDirections(latitude: number, longitude: number) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(t('Could not open maps'), t('Please install Google Maps or a web browser.'));
  }
}

export async function openUrl(raw: string) {
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try { await Linking.openURL(url); } catch { Alert.alert(t('Could not open link'), url); }
}

export async function callPhone(phone: string) {
  try { await Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`); } catch { Alert.alert(t('Could not start a call')); }
}

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Random id for optimistic UI items. */
export const clientId = () => `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ── Date ranges for the feed's date filter (computed on the phone = local time zone)
export type DateRange = 'any' | 'today' | 'tomorrow' | 'weekend' | 'week';

export function rangeFor(r: DateRange, now = new Date()): { from: string; to: string } | null {
  if (r === 'any') return null;
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
  let from = start, to = addDays(start, 1);
  if (r === 'tomorrow') { from = addDays(start, 1); to = addDays(start, 2); }
  if (r === 'week') { from = now; to = addDays(start, 7); }
  if (r === 'weekend') {
    const day = start.getDay(); // 0 Sun … 6 Sat
    const toSat = day === 0 ? -1 : 6 - day;
    from = day === 0 || day === 6 ? now : addDays(start, toSat);
    to = addDays(addDays(start, toSat), 2);
  }
  if (r === 'today') from = now;
  return { from: from.toISOString(), to: to.toISOString() };
}
