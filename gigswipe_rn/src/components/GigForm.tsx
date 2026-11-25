// The gig form used to post, edit and repost (duplicate) gigs.
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorMessage, type CreateGigBody, type Gig, type PayUnit, type User, type WorkMode } from '../api';
import { CURRENCY, GIG_CATEGORIES, MAX_GIG_PHOTOS, PAY_UNITS } from '../config';
import { t } from '../i18n';
import { colors, font, radius, spacing } from '../theme';
import { durationHours, formatSchedule, money } from '../utils/format';
import { Banner, Button, Chip, SectionTitle, TextField, ToggleRow } from './ui';
import { Icon } from './Icon';
import { DateTimeSheet } from './DateTimeSheet';
import { PhotoGridEditor } from './Photos';

export interface GigFormValue {
  title: string;
  payAmount: string;
  payUnit: PayUnit;
  hours: string;
  location: string;
  category: string;
  description: string;
  workMode: WorkMode;
  scheduled: boolean;
  startAt: Date | null;
  endAt: Date | null;
  openings: number;
  photos: string[];
}

export const EMPTY_GIG: GigFormValue = {
  title: '', payAmount: '', payUnit: 'hour', hours: '', location: '', category: '', description: '',
  workMode: 'onsite', scheduled: true, startAt: null, endAt: null, openings: 1, photos: [],
};

/** Form values from an existing gig. `repost` drops dates that have passed. */
export function gigToForm(g: Gig, repost = false): GigFormValue {
  const keepDates = !repost || (!!g.startAt && new Date(g.startAt) > new Date());
  return {
    title: g.title,
    payAmount: g.payAmount != null ? String(g.payAmount) : '',
    payUnit: g.payUnit ?? 'hour',
    hours: g.hours ?? '',
    location: g.workMode === 'onsite' ? g.location ?? '' : '',
    category: GIG_CATEGORIES.some(c => c.label === g.category) ? g.category : 'Other',
    description: g.description,
    workMode: g.workMode,
    scheduled: repost ? true : !!g.startAt,
    startAt: keepDates && g.startAt ? new Date(g.startAt) : null,
    endAt: keepDates && g.endAt ? new Date(g.endAt) : null,
    openings: g.openings ?? 1,
    photos: g.photos ?? [],
  };
}

export function formToBody(f: GigFormValue): CreateGigBody {
  return {
    title: f.title.trim(),
    payAmount: Number(f.payAmount.replace(/,/g, '')),
    payUnit: f.payUnit,
    hours: f.hours.trim(),
    description: f.description.trim(),
    category: f.category,
    workMode: f.workMode,
    location: f.workMode === 'onsite' ? f.location.trim() : undefined,
    startAt: f.scheduled && f.startAt ? f.startAt.toISOString() : null,
    endAt: f.scheduled && f.endAt ? f.endAt.toISOString() : null,
    openings: f.openings,
    photos: f.photos,
  };
}

export function GigForm({ initial, user, submitLabel, submitIcon, onSubmit, minHiredCount = 0, onOpenProfile }: {
  initial: GigFormValue;
  user: User;
  submitLabel: string;
  submitIcon?: React.ComponentProps<typeof Icon>['name'];
  onSubmit: (body: CreateGigBody) => Promise<void>;
  /** When editing: people already hired (openings can't go below this). */
  minHiredCount?: number;
  onOpenProfile?: () => void;
}) {
  const [f, setF] = useState<GigFormValue>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const set = <K extends keyof GigFormValue>(k: K, v: GigFormValue[K]) => { setF(p => ({ ...p, [k]: v })); setError(''); };

  const amount = Number(f.payAmount.replace(/,/g, ''));
  const errors = {
    title: !f.title.trim() ? t('Give the gig a title') : null,
    pay: !(amount > 0) ? t('Enter how much it pays') : null,
    category: !f.category ? t('Pick a category') : null,
    description: f.description.trim().length < 20 ? t('Describe the gig in at least 20 characters') : null,
    schedule: f.scheduled && (!f.startAt || !f.endAt) ? t('Pick a start and end time, or turn off "Set date & time"')
      : f.scheduled && f.endAt && f.startAt && f.endAt <= f.startAt ? t('The end time must be after the start time.')
      : f.scheduled && f.endAt && f.endAt < new Date() ? t('This time has already passed. Pick a time in the future.')
      : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (touched ? errors[k] : null);
  const hasCoords = user.latitude != null && user.longitude != null;

  const hours = durationHours(f.startAt?.toISOString(), f.endAt?.toISOString());
  const estimate = useMemo(() => {
    if (!(amount > 0) || !f.scheduled || !hours) return null;
    if (f.payUnit === 'hour') return money(Math.round(amount * hours));
    return null;
  }, [amount, f.payUnit, f.scheduled, hours]);

  const setStart = (d: Date) => {
    const len = f.startAt && f.endAt ? f.endAt.getTime() - f.startAt.getTime() : 4 * 3600000;
    setF(p => ({ ...p, startAt: d, endAt: !p.endAt || p.endAt <= d ? new Date(d.getTime() + len) : p.endAt }));
    setError('');
  };

  const submit = async () => {
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit(formToBody(f));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SectionTitle icon="images-outline" title={t('Photos (optional)')} style={{ marginTop: 0 }} />
        <PhotoGridEditor photos={f.photos} onChange={v => set('photos', v)} max={MAX_GIG_PHOTOS} />
        <Text style={s.hint}>{t('Show the place or the work. Gigs with photos get more applicants.')}</Text>

        <SectionTitle icon="create-outline" title={t('Basics')} />
        <TextField label={t('Gig title *')} icon="create-outline" value={f.title} onChangeText={v => set('title', v)}
          placeholder={t('e.g. Weekend barista, Event setup crew')} maxLength={80} error={show('title')} />

        <Text style={s.label}>{t('Category *')}</Text>
        <View style={s.wrap}>
          {GIG_CATEGORIES.map(c => (
            <Chip key={c.label} label={t(c.label)} icon={c.icon} selected={f.category === c.label} onPress={() => set('category', c.label)} />
          ))}
        </View>
        {show('category') ? <Text style={s.err}>{show('category')}</Text> : null}

        <SectionTitle icon="cash-outline" title={t('Pay *')} />
        <View style={s.payRow}>
          <Text style={s.currency}>{CURRENCY}</Text>
          <TextField value={f.payAmount} onChangeText={v => set('payAmount', v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad"
            placeholder="0" maxLength={10} style={{ flex: 1, marginBottom: 0 }} error={show('pay')} />
        </View>
        <View style={[s.wrap, { marginTop: 4 }]}>
          {PAY_UNITS.map(u => <Chip key={u.key} label={t(u.label)} selected={f.payUnit === u.key} onPress={() => set('payUnit', u.key)} />)}
        </View>

        <SectionTitle icon="calendar-outline" title={t('When')} />
        <ToggleRow icon="calendar-outline" title={t('Set date & time')} value={f.scheduled} onChange={v => set('scheduled', v)}
          subtitle={f.scheduled ? t('The gig disappears from the feed when it ends.') : t('Ongoing or flexible work with no fixed date.')} />
        {f.scheduled ? (
          <View style={{ gap: 8 }}>
            <PickerRow icon="play-outline" label={t('Starts')} value={f.startAt ? formatSchedule(f.startAt.toISOString()) : t('Pick start')}
              onPress={() => setPicker('start')} empty={!f.startAt} />
            <PickerRow icon="stop-outline" label={t('Ends')} value={f.endAt ? formatSchedule(f.endAt.toISOString()) : t('Pick end')}
              onPress={() => setPicker('end')} empty={!f.endAt} disabled={!f.startAt} />
            {f.startAt ? (
              <View style={s.wrap}>
                {[2, 4, 6, 8].map(h => (
                  <Chip key={h} label={t('{n} hours', { n: h })} selected={Math.abs(hours - h) < 0.01}
                    onPress={() => set('endAt', new Date(f.startAt!.getTime() + h * 3600000))} />
                ))}
              </View>
            ) : null}
            {hours ? (
              <Text style={s.hint}>
                {t('{n} hours', { n: Math.round(hours * 10) / 10 })}{estimate ? ` · ${t('about {amount} in total', { amount: estimate })}` : ''}
              </Text>
            ) : null}
            {show('schedule') ? <Text style={s.err}>{show('schedule')}</Text> : null}
          </View>
        ) : null}
        <TextField label={t('Schedule notes (optional)')} icon="time-outline" value={f.hours} onChangeText={v => set('hours', v)}
          placeholder={t('e.g. Every Sat–Sun, 1 hour lunch break')} maxLength={120} style={{ marginTop: 10 }} />

        <SectionTitle icon="people-outline" title={t('People needed')} />
        <View style={s.stepper}>
          <Pressable style={s.stepBtn} onPress={() => set('openings', Math.max(Math.max(1, minHiredCount), f.openings - 1))}
            accessibilityLabel={t('Fewer')}>
            <Icon name="remove" size={22} color={colors.dark} />
          </Pressable>
          <View style={{ alignItems: 'center', minWidth: 90 }}>
            <Text style={s.stepValue}>{f.openings}</Text>
            <Text style={s.hint}>{f.openings === 1 ? t('person') : t('people')}</Text>
          </View>
          <Pressable style={s.stepBtn} onPress={() => set('openings', Math.min(500, f.openings + 1))} accessibilityLabel={t('More')}>
            <Icon name="add" size={22} color={colors.dark} />
          </Pressable>
        </View>
        <Text style={[s.hint, { textAlign: 'center' }]}>
          {minHiredCount > 0
            ? t('{n} already hired. The gig closes automatically when every spot is filled.', { n: minHiredCount })
            : t('The gig closes automatically when every spot is filled.')}
        </Text>

        <SectionTitle icon="location-outline" title={t('Where')} />
        <View style={s.modeRow}>
          {([['onsite', t('On-site'), 'business-outline'], ['remote', t('Remote'), 'home-outline']] as const).map(([mode, label, icon]) => (
            <Pressable key={mode} onPress={() => set('workMode', mode)} style={[s.mode, f.workMode === mode && s.modeOn]}
              accessibilityState={{ selected: f.workMode === mode }}>
              <Icon name={icon} size={18} color={f.workMode === mode ? colors.accent : colors.muted} />
              <Text style={[s.modeText, f.workMode === mode && { color: colors.accent }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {f.workMode === 'onsite' ? (
          <>
            <TextField label={t('Address or area')} icon="location-outline" value={f.location} onChangeText={v => set('location', v)}
              placeholder={user.locationLabel || user.location || t('e.g. 12 Main St, Downtown')} maxLength={120}
              hint={user.locationLabel ? t('Leave empty to use "{place}"', { place: user.locationLabel }) : undefined} />
            {!hasCoords && (
              <Banner icon="locate-outline" color={colors.amber} action={onOpenProfile ? t('Profile') : undefined} onPress={onOpenProfile}
                text={t('Set your business location in Profile so this gig shows distance and appears on the map.')} />
            )}
          </>
        ) : (
          <Banner icon="information-circle-outline" color={colors.muted} text={t('Remote gigs are shown to job seekers everywhere, with no map or directions.')} />
        )}

        <SectionTitle icon="document-text-outline" title={t('Description *')} />
        <TextField value={f.description} onChangeText={v => set('description', v)} multiline maxLength={2000}
          placeholder={t("What will the person do? What skills or experience help? Anything to bring? What's the place like?")}
          error={show('description')} />

        {error ? <Banner icon="alert-circle-outline" color={colors.red} text={error} /> : null}
        {touched && !valid ? <Banner icon="alert-circle-outline" color={colors.red} text={t('Please fix the highlighted fields.')} /> : null}
        <Button title={submitLabel} icon={submitIcon} onPress={submit} loading={busy} style={{ marginTop: spacing.lg }} />
      </ScrollView>

      <DateTimeSheet visible={picker === 'start'} title={t('Start time')} value={f.startAt}
        onClose={() => setPicker(null)} onConfirm={setStart} />
      <DateTimeSheet visible={picker === 'end'} title={t('End time')} value={f.endAt}
        min={f.startAt ? new Date(f.startAt.getTime() + 30 * 60000) : undefined}
        onClose={() => setPicker(null)} onConfirm={d => set('endAt', d)} />
    </KeyboardAvoidingView>
  );
}

function PickerRow({ icon, label, value, onPress, empty, disabled }: {
  icon: React.ComponentProps<typeof Icon>['name']; label: string; value: string; onPress: () => void; empty?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={[s.pickRow, disabled && { opacity: 0.5 }]} accessibilityRole="button">
      <Icon name={icon} size={18} color={colors.accent} />
      <Text style={s.pickLabel}>{label}</Text>
      <Text style={[s.pickValue, empty && { color: colors.placeholder }]} numberOfLines={1}>{value}</Text>
      <Icon name="chevron-forward" size={16} color={colors.subtle} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, paddingBottom: 48 },
  label: { ...font.label, marginBottom: 8, marginTop: 4 },
  hint: { fontSize: 12, color: colors.subtle, marginTop: 6, lineHeight: 17 },
  err: { fontSize: 12, color: colors.red, marginTop: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  payRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  currency: { fontSize: 26, fontWeight: '800', color: colors.dark, marginTop: 10, minWidth: 20 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  stepBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.borderMid, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white },
  stepValue: { fontSize: 30, fontWeight: '900', color: colors.dark },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  mode: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderMid, backgroundColor: colors.surface },
  modeOn: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  modeText: { fontSize: 15, fontWeight: '700', color: colors.muted },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 14, borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt },
  pickLabel: { fontSize: 14, fontWeight: '700', color: colors.body, width: 60 },
  pickValue: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.dark, textAlign: 'right' },
});
