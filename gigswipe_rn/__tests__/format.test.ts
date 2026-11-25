import { distanceLabel, initials, isValidEmail, listTime, plural, timeAgo } from '../src/utils/format';
import { tint } from '../src/theme';
import { metersBetween } from '../src/services/location';

jest.mock('@react-native-community/geolocation', () => ({ setRNConfiguration: jest.fn(), getCurrentPosition: jest.fn() }));
jest.mock('react-native-keychain', () => ({}));

describe('format helpers', () => {
  it('builds initials', () => {
    expect(initials('Jordan Taylor')).toBe('JT');
    expect(initials('  cher ')).toBe('C');
    expect(initials('')).toBe('?');
    expect(initials(undefined, 'GS')).toBe('GS');
    expect(initials('Ana María de la Cruz')).toBe('AM');
  });

  it('pluralises', () => {
    expect(plural(1, 'gig')).toBe('1 gig');
    expect(plural(3, 'gig')).toBe('3 gigs');
    expect(plural(2, 'person', 'people')).toBe('2 people');
  });

  it('formats relative times', () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    expect(timeAgo(ago(10_000))).toBe('Just now');
    expect(timeAgo(ago(5 * 60_000))).toBe('5m ago');
    expect(timeAgo(ago(3 * 3600_000))).toBe('3h ago');
    expect(timeAgo(ago(2 * 86400_000))).toBe('2d ago');
    expect(timeAgo(undefined)).toBe('');
  });

  it('formats distances', () => {
    expect(distanceLabel(undefined)).toBe('');
    expect(distanceLabel(0.05)).toBe('Nearby');
    expect(distanceLabel(2.345)).toBe('2.3 mi');
    expect(distanceLabel(23.6)).toBe('24 mi');
  });

  it('validates emails', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail(' person@mail.com ')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });

  it('shows clock time for today in lists', () => {
    expect(listTime(new Date().toISOString())).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });
});

describe('theme + geo', () => {
  it('tints colours with alpha', () => {
    expect(tint('#FF5864', 1)).toBe('#FF5864ff');
    expect(tint('#FF5864', 0)).toBe('#FF586400');
    expect(tint('not-a-colour', 0.5)).toBe('#FF586480');
  });

  it('measures distance', () => {
    // Seattle → Bellevue ≈ 10–20 km
    const m = metersBetween(47.6062, -122.3321, 47.6101, -122.2015);
    expect(m).toBeGreaterThan(9000);
    expect(m).toBeLessThan(11000);
  });
});
