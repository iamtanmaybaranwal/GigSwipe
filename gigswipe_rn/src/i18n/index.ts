// Tiny translation layer.
//
//   t('Apply now')                        → "अभी आवेदन करें" in Hindi
//   t('{n} applicants', { n: 3 })         → placeholders are filled in
//
// The English text IS the key, so screens stay readable and any string that
// hasn't been translated yet simply shows in English. To add a language,
// add a dictionary next to hi.ts and list it in LANGUAGES.
import { useSyncExternalStore } from 'react';
import { prefs } from '../services/device';
import hi from './hi';

export type Lang = 'en' | 'hi';

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
];

const dictionaries: Record<Lang, Record<string, string>> = { en: {}, hi };

const stored = prefs.get('lang');
let current: Lang = stored === 'hi' || stored === 'en' ? stored : 'en';
const listeners = new Set<() => void>();

export function t(text: string, vars?: Record<string, string | number | undefined | null>): string {
  let out = dictionaries[current][text] ?? text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return out;
}

export const getLanguage = () => current;

export function setLanguage(lang: Lang) {
  if (lang === current) return;
  current = lang;
  prefs.set('lang', lang);
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Re-renders when the language changes. App.tsx remounts the screens with it. */
export function useLanguage(): Lang {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}
