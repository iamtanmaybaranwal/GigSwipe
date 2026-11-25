// Web version: settings live in localStorage; gig reminders are a phone-app
// feature (they need the operating system's alarm scheduler), so they're a no-op here.
export const prefs = {
  get(key: string): string {
    try { return window.localStorage.getItem(`gigswipe.pref.${key}`) ?? ''; } catch { return ''; }
  },
  set(key: string, value: string) {
    try { window.localStorage.setItem(`gigswipe.pref.${key}`, value); } catch { /* private mode */ }
  },
};

export interface Reminder {
  id: string;
  at: number;
  title: string;
  body: string;
}

export function setReminders(_list: Reminder[]) {
  // not available in the browser
}
