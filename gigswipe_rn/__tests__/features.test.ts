import { setLanguage, t } from '../src/i18n';
import hi from '../src/i18n/hi';
import { formatSchedule, money, payText, plural, rangeFor, startsIn } from '../src/utils/format';
import { buildReminders } from '../src/services/reminders';
import type { Conversation } from '../src/api/types';

jest.mock('@react-native-community/geolocation', () => ({ setRNConfiguration: jest.fn(), getCurrentPosition: jest.fn() }));
jest.mock('react-native-keychain', () => ({}));

const H = 3600_000;

describe('i18n', () => {
  afterEach(() => setLanguage('en'));

  it('fills placeholders and falls back to English', () => {
    expect(t('Starts in {n} min', { n: 5 })).toBe('Starts in 5 min');
    expect(t('Not a real key {x}', { x: 'y' })).toBe('Not a real key y');
  });

  it('switches to Hindi, including plurals and unknown keys', () => {
    setLanguage('hi');
    expect(t('Apply now')).toBe('अभी आवेदन करें');
    expect(plural(3, 'gig')).toBe('3 काम');
    expect(t('Starts in {n} min', { n: 5 })).toBe('5 मिनट में शुरू');
    expect(t('Some English only text')).toBe('Some English only text');
  });

  it('keeps every placeholder in every Hindi translation', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const [en, tr] of Object.entries(hi)) expect([en, ph(tr)]).toEqual([en, ph(en)]);
  });
});

describe('pay + schedule formatting', () => {
  it('formats pay with the currency and unit', () => {
    expect(money(1500)).toBe('₹1,500');
    expect(money(150000)).toBe('₹1,50,000'); // Indian grouping
    expect(payText({ payAmount: 800, payUnit: 'day' })).toBe('₹800/day');
    expect(payText({ payAmount: 200, payUnit: 'fixed' })).toBe('₹200 total');
    expect(payText({ pay: '$16/hr' })).toBe('$16/hr'); // older gigs without numbers
  });

  it('describes when a gig starts', () => {
    const now = Date.now();
    expect(startsIn(new Date(now + 30 * 60000).toISOString())).toBe('Starts in 30 min');
    expect(startsIn(new Date(now + 3 * H).toISOString())).toBe('Starts in 3 h');
    expect(startsIn(new Date(now - H).toISOString(), new Date(now + H).toISOString())).toBe('Happening now');
    expect(startsIn(new Date(now - 3 * H).toISOString(), new Date(now - H).toISOString())).toBe('Ended');
  });

  it('formats a same-day schedule', () => {
    const s = new Date(); s.setHours(9, 0, 0, 0);
    const e = new Date(s); e.setHours(17, 30);
    expect(formatSchedule(s.toISOString(), e.toISOString())).toBe('Today · 9:00 AM – 5:30 PM');
  });
});

describe('feed date ranges', () => {
  it('today starts now and ends at midnight', () => {
    const now = new Date(2026, 10, 25, 14, 0); // Wed 25 Nov 2026, 2 PM
    const r = rangeFor('today', now)!;
    expect(new Date(r.from).getTime()).toBe(now.getTime());
    expect(new Date(r.to).getTime()).toBe(new Date(2026, 10, 26).getTime());
  });

  it('weekend covers Saturday and Sunday', () => {
    const wed = new Date(2026, 10, 25, 14, 0);
    const r = rangeFor('weekend', wed)!;
    expect(new Date(r.from).getTime()).toBe(new Date(2026, 10, 28).getTime());
    expect(new Date(r.to).getTime()).toBe(new Date(2026, 10, 30).getTime());
    const sun = new Date(2026, 10, 29, 10, 0);
    const r2 = rangeFor('weekend', sun)!;
    expect(new Date(r2.from).getTime()).toBe(sun.getTime());
    expect(new Date(r2.to).getTime()).toBe(new Date(2026, 10, 30).getTime());
  });

  it('any = no range', () => expect(rangeFor('any')).toBeNull());
});

describe('gig reminders', () => {
  const conv = (o: Partial<Conversation>): Conversation => ({
    id: 'a1', gigId: 'g1', gigTitle: 'Event crew', workerId: 'w', businessId: 'b', businessName: 'Brew & Co',
    businessColor: '#000', status: 'accepted', createdAt: '', hireCodeActive: true, lastMessage: '', lastMessageTime: '',
    unreadCount: 0, otherUser: null, ...o,
  });

  it('schedules 1 day and 1 hour before for booked gigs only', () => {
    const now = Date.now();
    const start = new Date(now + 48 * H).toISOString();
    const list = buildReminders([
      conv({ gigStartAt: start, gigLocation: 'Pike Place' }),
      conv({ id: 'a2', gigId: 'g2', status: 'pending', gigStartAt: start }),
      conv({ id: 'a3', gigId: 'g3', gigStartAt: new Date(now - H).toISOString() }),
    ], 'worker', now);
    expect(list.map(r => r.id)).toEqual(['g1:1d', 'g1:1h']);
    expect(list[1]!.at).toBe(new Date(start).getTime() - H);
    expect(list[1]!.body).toContain('Brew & Co');
    expect(list[1]!.body).toContain('Pike Place');
  });

  it('gives a job giver one reminder per gig, not per person', () => {
    const now = Date.now();
    const start = new Date(now + 5 * H).toISOString();
    const list = buildReminders([
      conv({ id: 'a1', gigStartAt: start, status: 'hired' }),
      conv({ id: 'a2', gigStartAt: start, status: 'accepted' }),
    ], 'business', now);
    expect(list.map(r => r.id)).toEqual(['g1:1h']);
  });
});
