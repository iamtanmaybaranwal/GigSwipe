import { BASE_URL, REQUEST_TIMEOUT_MS } from '../config';

/** An error with a message that is safe to show to the user. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork() { return this.status === 0; }
  get isUnauthorized() { return this.status === 401; }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAuthToken = (t: string | null) => { token = t; };
export const getAuthToken = () => token;

/** Called when the server rejects our session, so the app can sign out cleanly. */
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const sentWithToken = !!token;

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    const timedOut = e?.name === 'AbortError';
    throw new ApiError(
      timedOut
        ? 'The server is taking too long to respond. Please try again.'
        : "Can't reach GigSwipe. Check your internet connection and try again.",
      0
    );
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  const text = await resp.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!resp.ok) {
    if (resp.status === 401 && sentWithToken && onUnauthorized) onUnauthorized();
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      (resp.status === 429 ? 'Too many requests. Please wait a moment and try again.' :
       resp.status >= 500 ? 'Something went wrong on our side. Please try again.' :
       `Request failed (${resp.status})`);
    throw new ApiError(message, resp.status, data);
  }
  return data as T;
}

/** Human-friendly message from anything thrown. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
