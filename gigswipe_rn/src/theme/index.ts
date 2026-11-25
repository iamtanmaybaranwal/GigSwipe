// GigSwipe design tokens — the single source of truth for colours, spacing and type.

export const colors = {
  // Brand
  accent: '#FF5864',
  accentDark: '#D94450',
  accentLight: '#FFF1F2',
  navy: '#0F172A',

  // Text
  dark: '#0F172A',
  body: '#334155',
  muted: '#64748B',
  subtle: '#94A3B8',
  placeholder: '#A0AEC0',

  // Surfaces
  white: '#FFFFFF',
  surface: '#F8FAFC',
  surfaceAlt: '#F1F5F9',

  // Borders
  border: '#F1F5F9',
  borderMid: '#E2E8F0',

  // Semantic
  green: '#10B981',
  greenLight: '#ECFDF5',
  red: '#EF4444',
  redLight: '#FEF2F2',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',
  blue: '#3B82F6',
  blueLight: '#EFF6FF',

  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const font = {
  h1: { fontSize: 30, fontWeight: '800' as const, color: colors.dark, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800' as const, color: colors.dark, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const, color: colors.dark },
  title: { fontSize: 16, fontWeight: '700' as const, color: colors.dark },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.body, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400' as const, color: colors.muted, lineHeight: 19 },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.subtle },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.body },
} as const;

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

/** Adds a 2-digit hex alpha to a #RRGGBB colour (e.g. tint(color, 0.12)). */
export function tint(hex: string, alpha: number): string {
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex : colors.accent;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${clean}${a}`;
}
