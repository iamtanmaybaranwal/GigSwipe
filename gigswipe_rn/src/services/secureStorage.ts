// Session storage backed by the Android Keystore (encrypted at rest) via react-native-keychain.
import * as Keychain from 'react-native-keychain';
import type { User } from '../api/types';

const TOKEN_SERVICE = 'com.gigswipe.app.token';
const USER_SERVICE = 'com.gigswipe.app.user';

export async function saveSession(token: string, user: User): Promise<void> {
  await Keychain.setGenericPassword('token', token, { service: TOKEN_SERVICE });
  await saveCachedUser(user);
}

export async function saveCachedUser(user: User): Promise<void> {
  try {
    await Keychain.setGenericPassword('user', JSON.stringify(user), { service: USER_SERVICE });
  } catch {
    // The cached profile is only a convenience for offline start-up.
  }
}

export async function loadSession(): Promise<{ token: string; user: User | null } | null> {
  try {
    const t = await Keychain.getGenericPassword({ service: TOKEN_SERVICE });
    if (!t || !t.password) return null;
    let user: User | null = null;
    try {
      const u = await Keychain.getGenericPassword({ service: USER_SERVICE });
      if (u && u.password) user = JSON.parse(u.password);
    } catch {
      user = null;
    }
    return { token: t.password, user };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.allSettled([
    Keychain.resetGenericPassword({ service: TOKEN_SERVICE }),
    Keychain.resetGenericPassword({ service: USER_SERVICE }),
  ]);
}
