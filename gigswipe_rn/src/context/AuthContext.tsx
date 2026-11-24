// Holds the signed-in user and session token.
// Start-up: token from the encrypted keychain → validate with /api/auth/me.
// If the server can't be reached we keep the cached profile, so opening the
// app offline doesn't sign people out. A real 401 signs them out.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler, ApiError, type User } from '../api';
import { clearSession, loadSession, saveCachedUser, saveSession } from '../services/secureStorage';
import { connectSocket, disconnectSocket } from '../services/socket';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: Status;
  user: User | null;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  /** Replace the stored user after a profile change. */
  setUser: (user: User) => void;
  /** Re-fetch the user from the server. */
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<User | null>(null);
  const signingOut = useRef(false);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      disconnectSocket();
      setAuthToken(null);
      await clearSession();
      setUserState(null);
      setStatus('signedOut');
    } finally {
      signingOut.current = false;
    }
  }, []);

  // Any 401 on an authenticated request = session is no longer valid
  useEffect(() => {
    setUnauthorizedHandler(() => { signOut(); });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await loadSession();
      if (!session) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      setAuthToken(session.token);
      try {
        const { user: fresh } = await api.auth.me();
        if (cancelled) return;
        setUserState(fresh);
        saveCachedUser(fresh);
        connectSocket(session.token);
        setStatus('signedIn');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
          await signOut();
        } else if (session.user) {
          // Offline or server down: continue with the cached profile
          setUserState(session.user);
          connectSocket(session.token);
          setStatus('signedIn');
        } else {
          await signOut();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [signOut]);

  const signIn = useCallback(async (token: string, u: User) => {
    setAuthToken(token);
    await saveSession(token, u);
    connectSocket(token);
    setUserState(u);
    setStatus('signedIn');
  }, []);

  const setUser = useCallback((u: User) => {
    setUserState(u);
    saveCachedUser(u);
  }, []);

  const reloadUser = useCallback(async () => {
    const { user: fresh } = await api.auth.me();
    setUser(fresh);
  }, [setUser]);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, setUser, reloadUser }),
    [status, user, signIn, signOut, setUser, reloadUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

const SIGNED_OUT_USER: User = { id: '', name: '', role: 'worker' };

/**
 * For screens that only render when signed in. During the single render in
 * which a sign-out happens, returns an empty placeholder instead of crashing.
 */
export function useCurrentUser(): User {
  const { user } = useAuth();
  return user ?? SIGNED_OUT_USER;
}
