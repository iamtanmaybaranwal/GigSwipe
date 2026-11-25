// Sends push notifications to phones and browsers, even when the app is closed.
//
// Web Push (the PWA: Android/iPhone/Windows/Mac) — set in the environment:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY      (generate once: npx web-push generate-vapid-keys)
//   VAPID_SUBJECT=mailto:you@example.com     (optional; defaults to SMTP_USER)
// Android app (Firebase Cloud Messaging):
//   FIREBASE_SERVICE_ACCOUNT=<service-account JSON, or the same JSON base64-encoded>
// Anything not configured is skipped silently, so the app works without it.
import webpush from 'web-push';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import PushTokenModel, { type IPushToken } from '../models/PushToken';

export interface PushMessage {
  title: string;
  body: string;
  /** Extra fields handed to the app when the notification is tapped */
  data?: Record<string, string>;
  /** Notifications with the same tag replace each other instead of stacking */
  tag?: string;
}

let webReady: boolean | undefined;
let fcm: Messaging | null | undefined;

function webPushReady(): boolean {
  if (webReady !== undefined) return webReady;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) return (webReady = false);
  try {
    const subject = process.env.VAPID_SUBJECT?.trim() || `mailto:${process.env.SMTP_USER?.trim() || 'admin@gigswipe.app'}`;
    webpush.setVapidDetails(subject, pub, priv);
    return (webReady = true);
  } catch (e) {
    console.error('[push] invalid VAPID keys:', (e as Error).message);
    return (webReady = false);
  }
}

function fcmClient(): Messaging | null {
  if (fcm !== undefined) return fcm;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return (fcm = null);
  try {
    const json = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    const app = getApps()[0] ?? initializeApp({ credential: cert(json) });
    return (fcm = getMessaging(app));
  } catch (e) {
    console.error('[push] FIREBASE_SERVICE_ACCOUNT is not valid:', (e as Error).message);
    return (fcm = null);
  }
}

export const pushStatus = () => ({
  web: webPushReady(),
  android: !!fcmClient(),
  webPublicKey: webPushReady() ? process.env.VAPID_PUBLIC_KEY!.trim() : null,
});

async function sendWeb(tokens: IPushToken[], build: (lang: 'en' | 'hi') => PushMessage, dead: string[]) {
  if (!webPushReady()) return 0;
  let sent = 0;
  await Promise.all(tokens.map(async t => {
    if (!t.keys?.p256dh || !t.keys.auth) { dead.push(t.token); return; }
    const m = build(t.lang);
    try {
      await webpush.sendNotification(
        { endpoint: t.token, keys: { p256dh: t.keys.p256dh, auth: t.keys.auth } },
        JSON.stringify({ title: m.title, body: m.body, tag: m.tag, data: m.data ?? {} }),
        { TTL: 6 * 60 * 60, urgency: 'high' }
      );
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(t.token); // unsubscribed / expired
      else console.error('[push/web]', e?.statusCode ?? '', e?.body ?? e?.message);
    }
  }));
  return sent;
}

async function sendAndroid(tokens: IPushToken[], build: (lang: 'en' | 'hi') => PushMessage, dead: string[]) {
  const client = fcmClient();
  if (!client || !tokens.length) return 0;
  let sent = 0;
  // Data-only messages: the app shows them itself (works in the background and when closed)
  for (const lang of ['en', 'hi'] as const) {
    const group = tokens.filter(t => t.lang === lang);
    const m = build(lang);
    for (let i = 0; i < group.length; i += 500) {
      const batch = group.slice(i, i + 500);
      try {
        const r = await client.sendEachForMulticast({
          tokens: batch.map(t => t.token),
          data: { title: m.title, body: m.body, tag: m.tag ?? '', ...(m.data ?? {}) },
          android: { priority: 'high', ttl: 6 * 60 * 60 * 1000 },
        });
        sent += r.successCount;
        r.responses.forEach((res, j) => {
          const code = res.error?.code ?? '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') ||
              code.includes('invalid-argument')) dead.push(batch[j]!.token);
        });
      } catch (e) {
        console.error('[push/fcm]', (e as Error).message);
      }
    }
  }
  return sent;
}

/** Sends to every registered device of these users. Never throws. */
export async function sendPush(userIds: string[], build: (lang: 'en' | 'hi') => PushMessage): Promise<number> {
  if (!userIds.length) return 0;
  try {
    const tokens = await PushTokenModel.find({ userId: { $in: userIds } });
    const dead: string[] = [];
    const [w, a] = await Promise.all([
      sendWeb(tokens.filter(t => t.platform === 'web'), build, dead),
      sendAndroid(tokens.filter(t => t.platform === 'android'), build, dead),
    ]);
    if (dead.length) await PushTokenModel.deleteMany({ token: { $in: dead } });
    return w + a;
  } catch (e) {
    console.error('[push]', (e as Error).message);
    return 0;
  }
}
