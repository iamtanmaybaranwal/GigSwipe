// Web version of the session store: the browser's localStorage.
// (The Android app uses the encrypted Keystore; browsers have no equivalent,
// so on shared computers people should sign out when they're done.)
import type { User } from '../api/types';

const TOKEN_KEY = 'gigswipe.token';
const USER_KEY = 'gigswipe.user';

const get = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* private mode */ } };
const del = (k: string) => { try { window.localStorage.removeItem(k); } catch { /* ignore */ } };

export async function saveSession(token: string, user: User): Promise<void> {
  put(TOKEN_KEY, token);
  await saveCachedUser(user);
}

export async function saveCachedUser(user: User): Promise<void> {
  put(USER_KEY, JSON.stringify(user));
}

export async function loadSession(): Promise<{ token: string; user: User | null } | null> {
  const token = get(TOKEN_KEY);
  if (!token) return null;
  let user: User | null = null;
  try { user = JSON.parse(get(USER_KEY) ?? 'null'); } catch { user = null; }
  return { token, user };
}

export async function clearSession(): Promise<void> {
  del(TOKEN_KEY);
  del(USER_KEY);
}
