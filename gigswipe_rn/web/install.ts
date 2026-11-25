// "Install GigSwipe" prompt for the web app.
// - Android (Chrome/Edge/Samsung) and Windows/Mac (Chrome/Edge): one-tap install
//   via the browser's beforeinstallprompt event.
// - iPhone/iPad Safari has no install button for websites, so we show a short
//   hint that links to the illustrated guide (install-ios.html).
// Nothing is shown when the app is already installed (standalone mode).

const DISMISS_KEY = 'gigswipe.installDismissedAt';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const snoozed = () => {
  try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < SNOOZE_MS; } catch { return false; }
};
const snooze = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ } };

function showBar(text: string, action: string, onAction: () => void) {
  if (document.getElementById('gs-install')) return;
  const bar = document.createElement('div');
  bar.id = 'gs-install';
  bar.style.cssText =
    'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom));width:min(480px,calc(100vw - 24px));' +
    'display:flex;align-items:center;gap:12px;background:#0F172A;color:#fff;border-radius:16px;padding:12px 12px 12px 14px;' +
    'box-shadow:0 12px 30px rgba(15,23,42,.35);z-index:99999;font:600 14px/19px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  const logo = document.createElement('div');
  logo.textContent = 'G';
  logo.style.cssText = 'flex:none;width:36px;height:36px;border-radius:10px;background:#FF5864;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px';
  const msg = document.createElement('div');
  msg.textContent = text;
  msg.style.cssText = 'flex:1';
  const btn = document.createElement('button');
  btn.textContent = action;
  btn.style.cssText = 'flex:none;border:0;background:#FF5864;color:#fff;font:800 14px system-ui,sans-serif;padding:9px 14px;border-radius:10px;cursor:pointer';
  btn.onclick = () => { bar.remove(); onAction(); };
  const close = document.createElement('button');
  close.setAttribute('aria-label', 'Close');
  close.textContent = '✕';
  close.style.cssText = 'flex:none;border:0;background:transparent;color:#94A3B8;font-size:16px;cursor:pointer;padding:4px 6px';
  close.onclick = () => { bar.remove(); snooze(); };
  bar.append(logo, msg, btn, close);
  document.body.appendChild(bar);
}

export function setupInstallPrompt() {
  if (isStandalone() || snoozed()) return;
  const hindi = (() => { try { return localStorage.getItem('gigswipe.pref.lang') === 'hi'; } catch { return false; } })();

  if (isIOS()) {
    setTimeout(() => showBar(
      hindi ? 'GigSwipe को होम स्क्रीन पर जोड़ें — ऐप की तरह खुलेगा।' : 'Add GigSwipe to your Home Screen. It opens like an app.',
      hindi ? 'कैसे?' : 'How?',
      () => { window.location.href = '/install-ios.html'; },
    ), 4000);
    return;
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    const evt = e as BeforeInstallPromptEvent;
    setTimeout(() => showBar(
      hindi ? 'GigSwipe ऐप इंस्टॉल करें — तेज़ और आसान।' : 'Install the GigSwipe app for quick access.',
      hindi ? 'इंस्टॉल' : 'Install',
      async () => {
        await evt.prompt();
        const { outcome } = await evt.userChoice;
        if (outcome === 'dismissed') snooze();
      },
    ), 3000);
  });
}
