// `react-native` for the web build: everything from react-native-web, plus
// working versions of the pieces it leaves empty (Alert dialogs, Android toasts).
export * from 'react-native-web';

type AlertButton = { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };

const ACCENT = '#FF5864';

/** Alert.alert(title, message, buttons) as an accessible in-page dialog. */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean; onDismiss?: () => void }) {
    const list: AlertButton[] = buttons?.length ? buttons : [{ text: 'OK' }];
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:100000;padding:24px';
    const box = document.createElement('div');
    box.style.cssText =
      'background:#fff;border-radius:18px;max-width:360px;width:100%;padding:22px 20px 14px;box-shadow:0 20px 50px rgba(15,23,42,.3);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    const h = document.createElement('div');
    h.textContent = title ?? '';
    h.style.cssText = 'font-size:17px;font-weight:800;color:#0F172A;margin-bottom:6px';
    box.appendChild(h);
    if (message) {
      const p = document.createElement('div');
      p.textContent = message;
      p.style.cssText = 'font-size:14px;line-height:20px;color:#475569;margin-bottom:10px;white-space:pre-line';
      box.appendChild(p);
    }
    const row = document.createElement('div');
    const stacked = list.length > 2;
    row.style.cssText = `display:flex;${stacked ? 'flex-direction:column;' : 'justify-content:flex-end;'}gap:6px;margin-top:10px`;
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const cancelBtn = list.find(b => b.style === 'cancel');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (cancelBtn || options?.cancelable)) { close(); cancelBtn?.onPress?.(); options?.onDismiss?.(); }
    };
    // Cancel goes last when stacked (like a phone action sheet)
    const ordered = stacked ? [...list.filter(b => b.style !== 'cancel'), ...list.filter(b => b.style === 'cancel')] : list;
    ordered.forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b.text ?? 'OK';
      const color = b.style === 'destructive' ? '#EF4444' : b.style === 'cancel' ? '#64748B' : ACCENT;
      btn.style.cssText =
        `border:0;background:${stacked ? '#F8FAFC' : 'transparent'};color:${color};font-size:15px;font-weight:700;` +
        `padding:11px 14px;border-radius:10px;cursor:pointer;${stacked ? 'width:100%;' : ''}`;
      btn.onclick = () => { close(); b.onPress?.(); };
      row.appendChild(btn);
    });
    box.appendChild(row);
    overlay.appendChild(box);
    overlay.addEventListener('click', (e: MouseEvent) => {
      if (e.target === overlay && (cancelBtn || options?.cancelable)) { close(); cancelBtn?.onPress?.(); options?.onDismiss?.(); }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    (row.lastElementChild as HTMLButtonElement | null)?.focus();
  },
  prompt() { /* not used */ },
};

/** ToastAndroid.show → a short snackbar at the bottom of the screen. */
export const ToastAndroid = {
  SHORT: 2000,
  LONG: 3500,
  show(message: string, duration = 2000) {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.textContent = message;
    el.style.cssText =
      'position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);max-width:min(440px,calc(100vw - 32px));' +
      'background:#0F172A;color:#fff;padding:11px 16px;border-radius:12px;font:600 14px/19px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'box-shadow:0 8px 24px rgba(15,23,42,.3);z-index:100001;text-align:center;transition:opacity .25s';
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, duration);
  },
};

/** Android-only API; harmless stand-in for shared code paths. */
export const PermissionsAndroid = {
  PERMISSIONS: { POST_NOTIFICATIONS: 'POST_NOTIFICATIONS', ACCESS_FINE_LOCATION: 'ACCESS_FINE_LOCATION', ACCESS_COARSE_LOCATION: 'ACCESS_COARSE_LOCATION' },
  RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
  check: async () => true,
  request: async () => 'granted',
  requestMultiple: async () => ({}),
};
