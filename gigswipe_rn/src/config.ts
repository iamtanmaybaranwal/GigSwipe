import { API_URL, API_URL_PRODUCTION, MAPS_API_KEY } from '@env';

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

/** The map screen needs a Google Maps key; without one we show a list instead. */
export const MAPS_ENABLED = !!MAPS_API_KEY && MAPS_API_KEY.trim().length > 10;

export const REQUEST_TIMEOUT_MS = 15000;

export const RADIUS_OPTIONS = [2, 5, 10, 25, 50, 100] as const;
export const DEFAULT_RADIUS = 10;

export const GIG_CATEGORIES = [
  { label: 'Food & Beverage', icon: 'cafe-outline' },
  { label: 'Marketing', icon: 'megaphone-outline' },
  { label: 'Events', icon: 'calendar-outline' },
  { label: 'Creative', icon: 'color-palette-outline' },
  { label: 'Retail', icon: 'bag-outline' },
  { label: 'Admin', icon: 'document-outline' },
  { label: 'Tech', icon: 'code-slash-outline' },
  { label: 'Other', icon: 'ellipsis-horizontal-outline' },
] as const;

export const INDUSTRIES = [
  'Food & Beverage', 'Retail', 'Events & Entertainment',
  'Marketing & Media', 'Technology', 'Healthcare',
  'Education', 'Non-profit', 'Real Estate', 'Construction & Trades',
  'Logistics & Delivery', 'Hospitality', 'Household / Individual', 'Other',
] as const;
