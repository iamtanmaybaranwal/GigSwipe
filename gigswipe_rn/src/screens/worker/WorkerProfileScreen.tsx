import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type AvailabilitySlot, type Rating, type User, type WorkHistoryItem } from '../../api';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import { useFocusData } from '../../hooks';
import { AVAILABILITY_SLOTS } from '../../config';
import { t } from '../../i18n';
import { colors, spacing } from '../../theme';
import { Avatar, Banner, Card, Chip, SectionTitle, TextField } from '../../components/ui';
import { ProfileHeader, RatingsCard } from '../../components/Profile';
import { AccountCard, ListEditor, SaveBar } from '../../components/ProfileForm';
import { AvailableNowRow } from '../../components/AvailableNow';
import { LocationRangePicker, type LocationValue } from '../../components/LocationRangePicker';
import { pickAndUploadPhoto } from '../../services/photos';
import { formatDate, plural, toast } from '../../utils/format';

type Form = {
  name: string; major: string; year: string; university: string; bio: string;
  skills: string[]; sampleWork: string[]; availability: AvailabilitySlot[]; availabilityNote: string; loc: LocationValue;
};

const fromUser = (u: User): Form => ({
  name: u.name ?? '', major: u.major ?? '', year: u.year ?? '', university: u.university ?? '', bio: u.bio ?? '',
  skills: u.skills ?? [], sampleWork: u.sampleWork ?? [],
  availability: u.availability ?? [], availabilityNote: u.availabilityNote ?? '',
  loc: { locationLabel: u.locationLabel, latitude: u.latitude, longitude: u.longitude, radiusMiles: u.radiusMiles },
});

export default function WorkerProfileScreen() {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const [form, setForm] = useState<Form>(() => fromUser(user));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // `baseline` is what the form started from. If the user object changes elsewhere
  // (e.g. a background location refresh) and nothing was edited, adopt the new values.
  const [baseline, setBaseline] = useState<Form>(() => fromUser(user));
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const incoming = useMemo(() => fromUser(user), [user]);
  useEffect(() => {
    setForm(f => (JSON.stringify(f) === JSON.stringify(baseline) ? incoming : f));
    setBaseline(incoming);
  }, [incoming]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm(f => ({ ...f, [k]: v })); setError(''); };
  const toggleSlot = (k: AvailabilitySlot) =>
    set('availability', form.availability.includes(k) ? form.availability.filter(x => x !== k) : [...form.availability, k]);

  const { data } = useFocusData(async () => {
    const [ratings, history, profile] = await Promise.all([
      api.ratings.forUser(user.id),
      api.applications.workHistory(),
      api.users.profile(user.id),
    ]);
    return { ...ratings, history: history.history, gigsCompleted: profile.gigsCompleted };
  }, [user.id]);

  const changePhoto = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadPhoto({ allowRemove: !!user.photoUrl });
      if (url === undefined) return;
      const { user: updated } = await api.auth.updateProfile({ photoUrl: url });
      setUser(updated);
      toast(url ? t('Profile photo updated') : t('Profile photo removed'));
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const save = useCallback(async () => {
    if (!form.name.trim()) { setError(t('Your name cannot be empty.')); return; }
    setSaving(true);
    try {
      const { user: updated } = await api.auth.updateProfile({
        name: form.name.trim(), major: form.major.trim(), year: form.year.trim(), university: form.university.trim(),
        bio: form.bio.trim(), skills: form.skills, sampleWork: form.sampleWork,
        availability: form.availability, availabilityNote: form.availabilityNote.trim(),
        locationLabel: form.loc.locationLabel?.trim(), latitude: form.loc.latitude ?? null,
        longitude: form.loc.longitude ?? null, radiusMiles: form.loc.radiusMiles ?? null,
      });
      setForm(fromUser(updated));
      setBaseline(fromUser(updated));
      setUser(updated);
      toast(t('Profile saved'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [form, setUser]);

  const avg = data?.averageStars ?? 0;
  const total = data?.totalRatings ?? 0;
  const noLocation = form.loc.latitude == null;
  const tips = [
    !user.photoUrl && t('a profile photo'),
    !form.skills.length && t('your skills'),
    !form.availability.length && t('when you are free'),
  ].filter(Boolean) as string[];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ProfileHeader
            name={form.name}
            color={user.avatarColor}
            photo={user.photoUrl}
            online={user.availableNow}
            onEditPhoto={changePhoto}
            uploading={uploading}
            subtitle={[form.major, form.year].filter(Boolean).join(' · ') || t('Add what you do below')}
            tags={form.loc.locationLabel ? [{ icon: 'location-outline', text: form.loc.locationLabel }] : []}
            stats={[
              { value: total ? `${avg.toFixed(1)}★` : '—', label: t('Rating') },
              { value: String(data?.gigsCompleted ?? 0), label: t('Gigs done') },
              { value: String(form.skills.length), label: t('Skills') },
            ]}
          />

          {noLocation ? (
            <View style={s.banner}>
              <Banner icon="locate-outline" color={colors.accent} text={t('Add your location below so we can show you the closest gigs first.')} />
            </View>
          ) : tips.length ? (
            <View style={s.banner}>
              <Banner icon="sparkles-outline" color={colors.blue}
                text={t('Job givers hire faster when they can see {things}.', { things: tips.join(', ') })} />
            </View>
          ) : null}

          <Card style={s.card}>
            <SectionTitle icon="flash-outline" title={t('Availability')} style={{ marginTop: 0 }} />
            <AvailableNowRow />
            <Text style={s.label}>{t('When are you usually free?')}</Text>
            <View style={s.chips}>
              {AVAILABILITY_SLOTS.map(a => (
                <Chip key={a.key} label={t(a.label)} icon={a.icon} selected={form.availability.includes(a.key)} onPress={() => toggleSlot(a.key)} />
              ))}
            </View>
            <TextField label={t('Anything else? (optional)')} icon="chatbox-ellipses-outline" value={form.availabilityNote}
              onChangeText={v => set('availabilityNote', v)} placeholder={t('e.g. After 6 PM on weekdays, not on Sundays')}
              maxLength={200} style={{ marginTop: 12 }} />
          </Card>

          <Card style={s.card}>
            <SectionTitle icon="person-outline" title={t('About you')} style={{ marginTop: 0 }} />
            <TextField label={t('Full name')} icon="person-outline" value={form.name} onChangeText={v => set('name', v)} maxLength={80} />
            <TextField label={t('What do you do?')} icon="briefcase-outline" value={form.major} onChangeText={v => set('major', v)}
              placeholder={t('e.g. Barista, Electrician, Designer, Student')} maxLength={120} />
            <TextField label={t('Experience')} icon="ribbon-outline" value={form.year} onChangeText={v => set('year', v)}
              placeholder={t('e.g. 3 years, Fresher, Retired teacher')} maxLength={60} />
            <TextField label={t('Education or training (optional)')} icon="school-outline" value={form.university}
              onChangeText={v => set('university', v)} placeholder={t('e.g. City College, ITI, Self-taught')} maxLength={120} />
            <TextField label={t('Short bio')} icon="document-text-outline" value={form.bio} onChangeText={v => set('bio', v)}
              placeholder={t('Reliable, quick learner, great with customers.')} multiline maxLength={1000} />
          </Card>

          <Card style={s.card}>
            <SectionTitle icon="navigate-outline" title={t('Location & range')} style={{ marginTop: 0 }} />
            <LocationRangePicker value={form.loc} onChange={v => set('loc', v)}
              helperText={t("We'll show gigs inside this distance, closest first. Remote gigs always appear.")} />
          </Card>

          <Card style={s.card}>
            <SectionTitle icon="construct-outline" title={t('Skills')} style={{ marginTop: 0 }} />
            <ListEditor items={form.skills} onChange={v => set('skills', v)} placeholder={t('Add a skill (e.g. Cash handling)')}
              max={30} maxLength={40} hint={t('Tap a skill to remove it.')} />
          </Card>

          <Card style={s.card}>
            <SectionTitle icon="attach-outline" title={t('Portfolio & links')} style={{ marginTop: 0 }} />
            <ListEditor items={form.sampleWork} onChange={v => set('sampleWork', v)} placeholder={t('Add a link or past project')}
              max={20} maxLength={300} />
          </Card>

          {error ? <View style={s.banner}><Banner icon="alert-circle-outline" color={colors.red} text={error} /></View> : null}

          <RatingsCard title={t('Reviews from job givers')} average={avg} total={total} ratings={(data?.ratings ?? []) as Rating[]}
            emptyText={t('No reviews yet. Complete a gig to get your first one!')} />

          {(data?.history.length ?? 0) > 0 && (
            <Card style={s.card}>
              <SectionTitle icon="time-outline" title={t('Work history · {gigs}', { gigs: plural(data!.history.length, 'gig') })} style={{ marginTop: 0 }} />
              {data!.history.map((h: WorkHistoryItem) => (
                <View key={h.application.id} style={s.hRow}>
                  <Avatar name={h.business?.businessName ?? h.application.businessName} color={h.application.businessColor}
                    photo={h.business?.photoUrl} size={40} square />
                  <View style={{ flex: 1 }}>
                    <Text style={s.hTitle}>{h.application.gigTitle}</Text>
                    <Text style={s.hSub}>{h.business?.businessName ?? h.application.businessName} · {formatDate(h.application.hiredAt ?? h.application.createdAt)}</Text>
                    <Text style={s.hMeta}>{h.totalWorkers > 1 ? t('Worked with {people}', { people: plural(h.totalWorkers - 1, 'other person', 'other people') }) : t('Solo gig')}</Text>
                  </View>
                </View>
              ))}
            </Card>
          )}

          <AccountCard />
        </ScrollView>
        <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => { setForm(baseline); setError(''); }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  banner: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: colors.body, marginTop: 8, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  hTitle: { fontSize: 15, fontWeight: '700', color: colors.dark },
  hSub: { fontSize: 13, color: colors.body, marginTop: 2 },
  hMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
