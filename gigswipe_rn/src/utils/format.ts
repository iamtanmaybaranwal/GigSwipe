import { Alert, Linking, Platform, ToastAndroid } from 'react-native';

export function initials(name?: string | null, fallback = '?'): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts.slice(0, 2).map(p => p[0]!.toUpperCase()).join('');
}

export const plural = (n: number, word: string, pluralWord = `${word}s`) =>
  `${n} ${n === 1 ? word : pluralWord}`;

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatDate(iso);
}

export function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? '' : `, ${d.getFullYear()}`}`;
}

/** Conversation list timestamp: time today, weekday this week, else date. */
export function listTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return formatTime(iso);
  const days = (now.getTime() - d.getTime()) / 86400000;
  if (days < 7) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]!;
  return formatDate(iso);
}

export const distanceLabel = (miles?: number) =>
  miles == null ? '' : miles < 0.1 ? 'Nearby' : `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;

/** Short confirmation message (native toast on Android). */
export function toast(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(message);
}

/** Opens turn-by-turn directions in Google Maps (app if installed, otherwise browser). */
export async function openDirections(latitude: number, longitude: number) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open maps', 'Please install Google Maps or a web browser.');
  }
}

export async function openUrl(raw: string) {
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try { await Linking.openURL(url); } catch { Alert.alert('Could not open link', url); }
}

export async function callPhone(phone: string) {
  try { await Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`); } catch { Alert.alert('Could not start a call'); }
}

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Random id for optimistic UI items. */
export const clientId = () => `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
