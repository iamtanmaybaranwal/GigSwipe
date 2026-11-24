import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { describeLocation, getCurrentCoords, hasLocationPermission, metersBetween } from '../services/location';
import { onSocketEvent } from '../services/socket';

/**
 * Loads data when the screen gains focus (and on pull-to-refresh).
 * - First load shows a spinner; later reloads keep the old data on screen.
 * - Ignores results from stale requests.
 */
export function useFocusData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const reqId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
    const id = ++reqId.current;
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await loaderRef.current();
      if (id !== reqId.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (id !== reqId.current) return;
      setError(errorMessage(e));
    } finally {
      if (id === reqId.current) { setLoading(false); setRefreshing(false); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(useCallback(() => { load('silent'); }, [load]));

  return {
    data, setData, error, loading, refreshing,
    refresh: () => load('refresh'),
    reload: () => load('silent'),
    retry: () => { setLoading(true); setError(null); load('initial'); },
  };
}

/** Run `handler` whenever the server pushes `event` (while mounted). */
export function useSocketEvent<T = any>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => onSocketEvent<T>(event, p => ref.current(p)), [event]);
}

const MIN_INTERVAL_MS = 5 * 60 * 1000;
const MIN_MOVE_METERS = 300;
let lastAutoUpdate = 0;

/**
 * Keeps the signed-in user's location current — silently, only if permission
 * was already granted (the profile screen is where we ask). Runs on app open
 * and whenever the app returns to the foreground, at most every 5 minutes.
 */
export function useAutoLocation() {
  const { user, setUser } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const run = useCallback(async () => {
    const u = userRef.current;
    if (!u?.id || Date.now() - lastAutoUpdate < MIN_INTERVAL_MS) return;
    lastAutoUpdate = Date.now();
    try {
      if (!(await hasLocationPermission())) return;
      const { latitude, longitude } = await getCurrentCoords();
      if (u.latitude != null && u.longitude != null &&
          metersBetween(u.latitude, u.longitude, latitude, longitude) < MIN_MOVE_METERS) return;
      const locationLabel = await describeLocation(latitude, longitude);
      const { user: updated } = await api.auth.updateProfile({
        latitude, longitude, locationLabel,
        ...(u.radiusMiles == null && { radiusMiles: 10 }),
      });
      setUser(updated);
    } catch {
      // Background convenience only — never bother the user about it
    }
  }, [setUser]);

  useEffect(() => {
    run();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') run(); });
    return () => sub.remove();
  }, [run]);
}
