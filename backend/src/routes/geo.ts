// GET /api/geo/reverse?lat=..&lng=.. → { label: "Seattle, WA" }
//
// Turns GPS coordinates into a human-readable area name for profiles.
// Uses Google Geocoding when GOOGLE_GEOCODING_API_KEY is set (recommended for
// production), otherwise OpenStreetMap Nominatim (free, low volume only).
// Results are cached by ~1 km grid cell so repeat lookups are instant.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { ah, HttpError } from '../utils/http';

const router = Router();
const cache = new Map<string, { label: string; at: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 5000;

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function viaGoogle(lat: number, lng: number, key: string): Promise<string | null> {
  const data: any = await fetchJson(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=locality|sublocality|administrative_area_level_2&key=${key}`
  );
  const comps: any[] = data?.results?.[0]?.address_components ?? [];
  const find = (t: string) => comps.find(c => c.types?.includes(t));
  const city = find('locality') ?? find('sublocality') ?? find('administrative_area_level_2');
  const region = find('administrative_area_level_1');
  const parts = [city?.long_name, region?.short_name].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

async function viaNominatim(lat: number, lng: number): Promise<string | null> {
  const data: any = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&lat=${lat}&lon=${lng}`,
    { 'User-Agent': 'GigSwipe-Backend/1.0', 'Accept-Language': 'en' }
  );
  const a = data?.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.suburb ?? a.county;
  const region = a.state ?? a.region;
  const parts = [city, region].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

router.get('/reverse', requireAuth, ah(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new HttpError(400, 'Valid lat and lng are required');
  }

  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return res.json({ label: hit.label });

  let label: string | null = null;
  try {
    const gKey = process.env.GOOGLE_GEOCODING_API_KEY;
    label = gKey ? await viaGoogle(lat, lng, gKey) : await viaNominatim(lat, lng);
  } catch (err) {
    console.warn('[geo/reverse] lookup failed:', (err as Error).message);
  }
  if (!label) return res.json({ label: null });

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { label, at: Date.now() });
  res.json({ label });
}));

export default router;
