// Filters for the job seeker's swipe feed.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FeedFilters, PayUnit, WorkMode } from '../api';
import { CURRENCY, GIG_CATEGORIES, PAY_UNITS, RADIUS_OPTIONS } from '../config';
import { t } from '../i18n';
import { prefs } from '../services/device';
import { colors, font, spacing } from '../theme';
import { rangeFor, type DateRange } from '../utils/format';
import { Sheet } from './Sheet';
import { Button, Chip, TextField } from './ui';

export interface FeedPrefs {
  q: string;
  categories: string[];
  mode: 'any' | WorkMode;
  date: DateRange;
  payUnit: PayUnit | null;
  minPay: string;
  radius: number | null; // null = the range saved in the profile
}

export const DEFAULT_FEED_PREFS: FeedPrefs = {
  q: '', categories: [], mode: 'any', date: 'any', payUnit: null, minPay: '', radius: null,
};

export const DATE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: 'any', label: 'Any time' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
  { key: 'week', label: 'Next 7 days' },
];

/** Number of filters that differ from the defaults (shown as a badge). */
export const activeFilterCount = (p: FeedPrefs) =>
  (p.categories.length ? 1 : 0) + (p.mode !== 'any' ? 1 : 0) + (p.date !== 'any' ? 1 : 0) +
  (p.payUnit ? 1 : 0) + (p.radius != null ? 1 : 0);

export function toFeedQuery(p: FeedPrefs): FeedFilters {
  const range = rangeFor(p.date);
  const minPay = Number(p.minPay.replace(/,/g, ''));
  return {
    q: p.q.trim() || undefined,
    category: p.categories.length ? p.categories : undefined,
    mode: p.mode === 'any' ? undefined : p.mode,
    payUnit: p.payUnit ?? undefined,
    minPay: p.payUnit && minPay > 0 ? minPay : undefined,
    from: range?.from,
    to: range?.to,
    radius: p.radius ?? undefined,
  };
}

const KEY = 'feed_filters';
export function loadFeedPrefs(): FeedPrefs {
  try {
    const raw = prefs.get(KEY);
    return raw ? { ...DEFAULT_FEED_PREFS, ...JSON.parse(raw), q: '' } : DEFAULT_FEED_PREFS;
  } catch {
    return DEFAULT_FEED_PREFS;
  }
}
export const saveFeedPrefs = (p: FeedPrefs) => prefs.set(KEY, JSON.stringify({ ...p, q: '' }));

export function FeedFilterSheet({ visible, value, profileRadius, onClose, onApply }: {
  visible: boolean; value: FeedPrefs; profileRadius?: number | null; onClose: () => void; onApply: (p: FeedPrefs) => void;
}) {
  const [p, setP] = useState(value);
  useEffect(() => { if (visible) setP(value); }, [visible, value]);
  const set = <K extends keyof FeedPrefs>(k: K, v: FeedPrefs[K]) => setP(x => ({ ...x, [k]: v }));
  const toggleCat = (c: string) =>
    set('categories', p.categories.includes(c) ? p.categories.filter(x => x !== c) : [...p.categories, c]);

  return (
    <Sheet visible={visible} title={t('Filters')} onClose={onClose}>
      <Text style={s.h}>{t('When')}</Text>
      <View style={s.wrap}>
        {DATE_OPTIONS.map(o => <Chip key={o.key} label={t(o.label)} selected={p.date === o.key} onPress={() => set('date', o.key)} />)}
      </View>

      <Text style={s.h}>{t('Work type')}</Text>
      <View style={s.wrap}>
        <Chip label={t('Any')} selected={p.mode === 'any'} onPress={() => set('mode', 'any')} />
        <Chip label={t('On-site')} icon="business-outline" selected={p.mode === 'onsite'} onPress={() => set('mode', 'onsite')} />
        <Chip label={t('Remote')} icon="home-outline" selected={p.mode === 'remote'} onPress={() => set('mode', 'remote')} />
      </View>

      <Text style={s.h}>{t('Distance')}</Text>
      <View style={s.wrap}>
        <Chip label={profileRadius ? t('My range ({n} mi)', { n: profileRadius }) : t('My range')} selected={p.radius == null}
          onPress={() => set('radius', null)} />
        {RADIUS_OPTIONS.map(r => <Chip key={r} label={t('{n} mi', { n: r })} selected={p.radius === r} onPress={() => set('radius', r)} />)}
      </View>

      <Text style={s.h}>{t('Minimum pay')}</Text>
      <View style={s.wrap}>
        <Chip label={t('Any pay')} selected={!p.payUnit} onPress={() => set('payUnit', null)} />
        {PAY_UNITS.map(u => <Chip key={u.key} label={t(u.label)} selected={p.payUnit === u.key} onPress={() => set('payUnit', u.key)} />)}
      </View>
      {p.payUnit ? (
        <TextField label={t('At least ({currency})', { currency: CURRENCY })} icon="cash-outline" value={p.minPay} keyboardType="number-pad"
          onChangeText={v => set('minPay', v.replace(/[^\d]/g, ''))} placeholder="0" maxLength={8} style={{ marginTop: 10 }}
          hint={t('Only gigs paid {unit} are shown.', { unit: t(PAY_UNITS.find(u => u.key === p.payUnit)!.label) })} />
      ) : null}

      <Text style={s.h}>{t('Categories')}</Text>
      <View style={s.wrap}>
        {GIG_CATEGORIES.map(c => (
          <Chip key={c.label} label={t(c.label)} icon={c.icon} selected={p.categories.includes(c.label)} onPress={() => toggleCat(c.label)} />
        ))}
      </View>

      <View style={s.foot}>
        <Button title={t('Reset')} variant="outline" size="md" style={{ flex: 1 }}
          onPress={() => setP({ ...DEFAULT_FEED_PREFS, q: p.q })} />
        <Button title={t('Show gigs')} size="md" style={{ flex: 2 }} onPress={() => { onApply(p); onClose(); }} />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  h: { ...font.label, marginTop: spacing.lg, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foot: { flexDirection: 'row', gap: 10, marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
