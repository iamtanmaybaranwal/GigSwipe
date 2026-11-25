// App version control ("update required" like banking apps).
//
// Set in the server environment (Render → Environment), per platform:
//   ANDROID_LATEST_VERSION=1.2.0   newest version (older apps see "update available")
//   ANDROID_MIN_VERSION=1.1.0      oldest version still allowed (older apps are blocked)
//   ANDROID_UPDATE_URL=https://your-site.com/download   where the new APK is
//   (same with IOS_… for the iPhone app; APP_DOWNLOAD_URL is the fallback link)
//
// The app sends X-App-Version / X-App-Platform on every request. Requests from a
// version below the minimum get HTTP 426, which the app turns into a full-screen
// "Update required" page.
import { Router, type NextFunction, type Request, type Response } from 'express';

type Platform = 'android' | 'ios';

/** Compares dotted versions: -1, 0 or 1. "1.10.0" > "1.9.3". */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

const VERSION_RE = /^\d+(\.\d+){0,3}$/;

export function versionPolicy(platform: Platform) {
  const P = platform.toUpperCase();
  const env = (k: string) => process.env[`${P}_${k}`]?.trim();
  const minimum = env('MIN_VERSION') || '0.0.0';
  const latest = env('LATEST_VERSION') || minimum;
  return {
    platform,
    latest,
    minimum,
    updateUrl: env('UPDATE_URL') || process.env.APP_DOWNLOAD_URL?.trim() || '',
    message: env('UPDATE_MESSAGE') || '',
  };
}

const platformOf = (v: unknown): Platform => (String(v).toLowerCase() === 'ios' ? 'ios' : 'android');

const router = Router();

// GET /api/app/version?platform=android&version=1.0.0
router.get('/version', (req, res) => {
  const policy = versionPolicy(platformOf(req.query.platform));
  const current = String(req.query.version ?? '');
  const known = VERSION_RE.test(current);
  res.set('Cache-Control', 'no-store');
  res.json({
    ...policy,
    updateRequired: known && compareVersions(current, policy.minimum) < 0,
    updateAvailable: known && compareVersions(current, policy.latest) < 0,
  });
});

export default router;

/** Blocks API calls from app versions older than the minimum (HTTP 426). */
export function requireSupportedApp(req: Request, res: Response, next: NextFunction) {
  const version = req.get('x-app-version');
  if (!version || !VERSION_RE.test(version)) return next(); // tools, tests
  // The web app (PWA) is always served fresh from the website, so it's never "too old"
  if (String(req.get('x-app-platform')).toLowerCase() === 'web') return next();
  const policy = versionPolicy(platformOf(req.get('x-app-platform')));
  if (compareVersions(version, policy.minimum) < 0) {
    return res.status(426).json({
      error: 'Please update GigSwipe to keep using it.',
      updateRequired: true,
      updateUrl: policy.updateUrl,
      latest: policy.latest,
      minimum: policy.minimum,
    });
  }
  next();
}
