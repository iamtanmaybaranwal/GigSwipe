import { BASE_URL, REQUEST_TIMEOUT_MS } from '../config';
import { t } from '../i18n';
import { APP_PLATFORM, APP_VERSION, markUpdateRequired } from '../services/appUpdate';

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

export const setAuthToken = (value: string | null) => { token = value; };
export const getAuthToken = () => token;

/** Called when the server rejects our session, so the app can sign out cleanly. */
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function request<T>(
  method: Method, path: string, body?: unknown, opts?: { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const sentWithToken = !!token;

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'X-App-Version': APP_VERSION,
        'X-App-Platform': APP_PLATFORM,
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    const timedOut = e?.name === 'AbortError';
    throw new ApiError(
      t(timedOut
        ? 'The server is taking too long to respond. Please try again.'
        : "Can't reach GigSwipe. Check your internet connection and try again."),
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
    // This app version is too old: block the app until it's updated
    if (resp.status === 426) markUpdateRequired(data ?? {});
    if (resp.status === 401 && sentWithToken && onUnauthorized) onUnauthorized();
    // Server messages are English; t() translates the ones we know
    const message = t(
      (data && typeof data.error === 'string' && data.error) ||
      (resp.status === 429 ? 'Too many requests. Please wait a moment and try again.' :
       resp.status >= 500 ? 'Something went wrong on our side. Please try again.' :
       `Request failed (${resp.status})`));
    throw new ApiError(message, resp.status, data);
  }
  return data as T;
}

/** Full URL for an uploaded image path (/api/uploads/<id>). */
export const mediaUrl = (path?: string | null) =>
  !path ? undefined : /^https?:\/\//.test(path) ? path : `${BASE_URL}${path}`;

/** Human-friendly message from anything thrown. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return t(e.message);
  return t(fallback);
}
