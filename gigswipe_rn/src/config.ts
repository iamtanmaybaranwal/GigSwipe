import { API_URL, API_URL_PRODUCTION, CURRENCY_SYMBOL, MAP_TILE_URL as ENV_TILE_URL, MAP_TILE_ATTRIBUTION as ENV_TILE_ATTRIBUTION } from '@env';

const stripSlash = (u: string) => u.replace(/\/+$/, '');

/**
 * Backend address.
 * - Debug builds use API_URL (default http://localhost:3001 — works over USB
 *   because `npm run android` runs `adb reverse tcp:3001 tcp:3001`).
 * - Release builds use API_URL_PRODUCTION (must be https).
 */
export const BASE_URL = stripSlash(
  (__DEV__ ? API_URL : API_URL_PRODUCTION) || 'http://localhost:3001'
);

/**
 * Map tiles for the Leaflet map (free, no API key). Defaults to OpenStreetMap's
 * public tiles, which are fine while testing. Before a big launch, switch to a
 * tile provider (MapTiler, Stadia, Thunderforest…) by setting MAP_TILE_URL and
 * MAP_TILE_ATTRIBUTION in .env — nothing else changes.
 */
export const MAP_TILE_URL = (ENV_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png').trim();
export const MAP_TILE_ATTRIBUTION = (ENV_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors').trim();

// Release builds wait longer: a free-plan server that was asleep needs ~50 s to wake up.
export const REQUEST_TIMEOUT_MS = __DEV__ ? 15000 : 45000;

export const RADIUS_OPTIONS = [2, 5, 10, 25, 50, 100] as const;
export const DEFAULT_RADIUS = 10;

// Must match GIG_CATEGORIES in backend/src/routes/gigs.ts
export const GIG_CATEGORIES = [
  { label: 'Food & Beverage', icon: 'cafe-outline' },
  { label: 'Retail', icon: 'bag-outline' },
  { label: 'Events', icon: 'calendar-outline' },
  { label: 'Delivery & Driving', icon: 'bicycle-outline' },
  { label: 'Cleaning & Household', icon: 'sparkles-outline' },
  { label: 'Construction & Repair', icon: 'hammer-outline' },
  { label: 'Care & Tutoring', icon: 'heart-outline' },
  { label: 'Marketing', icon: 'megaphone-outline' },
  { label: 'Creative', icon: 'color-palette-outline' },
  { label: 'Admin', icon: 'document-outline' },
  { label: 'Tech', icon: 'code-slash-outline' },
  { label: 'Other', icon: 'ellipsis-horizontal-outline' },
] as const;

/** Shown before pay amounts. Set CURRENCY_SYMBOL in .env (and in backend/.env). */
export const CURRENCY = (CURRENCY_SYMBOL || '₹').trim();

export const PAY_UNITS = [
  { key: 'hour', label: 'per hour', short: '/hr' },
  { key: 'day', label: 'per day', short: '/day' },
  { key: 'week', label: 'per week', short: '/week' },
  { key: 'month', label: 'per month', short: '/month' },
  { key: 'fixed', label: 'fixed total', short: ' total' },
] as const;

/** When a job seeker is usually free. Keys must match AVAILABILITY_SLOTS in backend/src/models/User.ts */
export const AVAILABILITY_SLOTS = [
  { key: 'weekday_mornings', label: 'Weekday mornings', icon: 'sunny-outline' },
  { key: 'weekday_afternoons', label: 'Weekday afternoons', icon: 'partly-sunny-outline' },
  { key: 'weekday_evenings', label: 'Weekday evenings', icon: 'moon-outline' },
  { key: 'weekends', label: 'Weekends', icon: 'calendar-outline' },
  { key: 'nights', label: 'Night shifts', icon: 'cloudy-night-outline' },
  { key: 'flexible', label: 'Flexible / any time', icon: 'infinite-outline' },
] as const;

export const MAX_GIG_PHOTOS = 6;

export const INDUSTRIES = [
  'Food & Beverage', 'Retail', 'Events & Entertainment',
  'Marketing & Media', 'Technology', 'Healthcare',
  'Education', 'Non-profit', 'Real Estate', 'Construction & Trades',
  'Logistics & Delivery', 'Hospitality', 'Household / Individual', 'Other',
] as const;
