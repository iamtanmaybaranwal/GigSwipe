import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type User } from '../../api';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import { useFocusData } from '../../hooks';
import { INDUSTRIES } from '../../config';
import { colors, radius, spacing } from '../../theme';
import { Avatar, Banner, Card, SectionTitle, TextField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ProfileHeader, RatingsCard } from '../../components/Profile';
import { AccountCard, SaveBar } from '../../components/ProfileForm';
import { LocationRangePicker, type LocationValue } from '../../components/LocationRangePicker';
import { Sheet } from '../../components/Sheet';
import { plural, toast } from '../../utils/format';

type Form = {
  name: string; businessName: string; industry: string; location: string; website: string; phone: string; bio: string; loc: LocationValue;
};
const fromUser = (u: User): Form => ({
  name: u.name ?? '', businessName: u.businessName ?? '', industry: u.industry ?? '', location: u.location ?? '',
  website: u.website ?? '', phone: u.phone ?? '', bio: u.bio ?? '',
  loc: { locationLabel: u.locationLabel, latitude: u.latitude, longitude: u.longitude, radiusMiles: u.radiusMiles },
});

export default function BusinessProfileScreen() {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const [form, setForm] = useState<Form>(() => fromUser(user));
  const [baseline, setBaseline] = useState<Form>(() => fromUser(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [industryOpen, setIndustryOpen] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const incoming = useMemo(() => fromUser(user), [user]);
  useEffect(() => {
    setForm(f => (JSON.stringify(f) === JSON.stringify(baseline) ? incoming : f));
    setBaseline(incoming);
  }, [incoming]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const { data } = useFocusData(async () => {
    const [ratings, history, profile] = await Promise.all([
      api.ratings.forUser(user.id), api.gigs.history(), api.users.profile(user.id),
    ]);
    return { ...ratings, history: history.history, workersHired: profile.workersHired };
  }, [user.id]);

  const save = useCallback(async () => {
    if (!form.name.trim()) { setError('Your name cannot be empty.'); return; }
    setSaving(true);
    try {
      const { user: updated } = await api.auth.updateProfile({
        name: form.name.trim(), businessName: form.businessName.trim(), industry: form.industry, location: form.location.trim(),
        website: form.website.trim(), phone: form.phone.trim(), bio: form.bio.trim(),
        locationLabel: form.loc.locationLabel?.trim(), latitude: form.loc.latitude ?? null,
        longitude: form.loc.longitude ?? null, radiusMiles: form.loc.radiusMiles ?? null,
      });
      setForm(fromUser(updated));
      setBaseline(fromUser(updated));
      setUser(updated);
      toast('Profile saved');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [form, setUser]);

  const avg = data?.averageStars ?? 0;
  const total = data?.totalRatings ?? 0;
  const displayName = form.businessName || form.name;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ProfileHeader
            name={displayName}
            color={user.avatarColor}
            subtitle={form.industry || 'Add your industry below'}
            tags={form.location || form.loc.locationLabel ? [{ icon: 'location-outline', text: form.location || form.loc.locationLabel! }] : []}
            stats={[
              { value: total ? `${avg.toFixed(1)}★` : '—', label: 'Rating' },
              { value: String(data?.history.length ?? 0), label: 'Gigs posted' },
              { value: String(data?.workersHired ?? 0), label: 'Hired' },
            ]}
          />

          {form.loc.latitude == null && (
            <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <Banner icon="locate-outline" color={colors.accent} text="Set your hiring location below so your on-site gigs reach people nearby." />
            </View>
          )}

          <Card style={s.card}>
            <SectionTitle icon="storefront-outline" title="Business" style={{ marginTop: 0 }} />
            <TextField label="Your name" icon="person-outline" value={form.name} onChangeText={v => set('name', v)} maxLength={80} />
            <TextField label="Business name" icon="storefront-outline" value={form.businessName} onChangeText={v => set('businessName', v)}
              placeholder="Leave empty if you hire as an individual" maxLength={100} />
            <Text style={s.label}>Industry</Text>
            <Pressable style={s.select} onPress={() => setIndustryOpen(true)} accessibilityRole="button">
              <Icon name="briefcase-outline" size={18} color={colors.muted} />
              <Text style={[s.selectText, !form.industry && { color: colors.placeholder }]}>{form.industry || 'Choose an industry'}</Text>
              <Icon name="chevron-down" size={18} color={colors.muted} />
            </Pressable>
            <TextField label="Address (shown on your profile)" icon="location-outline" value={form.location} onChangeText={v => set('location', v)}
              placeholder="e.g. 12 Main St, Seattle, WA" maxLength={120} />
            <TextField label="Website" icon="globe-outline" value={form.website} onChangeText={v => set('website', v)}
              placeholder="mybusiness.com" autoCapitalize="none" keyboardType="url" maxLength={200} />
            <TextField label="Phone (optional, public)" icon="call-outline" value={form.phone} onChangeText={v => set('phone', v)}
              placeholder="+1 555 000 0000" keyboardType="phone-pad" maxLength={30} />
            <TextField label="About" icon="document-text-outline" value={form.bio} onChangeText={v => set('bio', v)} multiline maxLength={1000}
              placeholder="What you do, what it's like to work with you, and any perks (meals, tips, flexible hours)…" />
          </Card>

          <Card style={s.card}>
            <SectionTitle icon="navigate-outline" title="Hiring location" style={{ marginTop: 0 }} />
            <LocationRangePicker value={form.loc} onChange={v => set('loc', v)} rangeLabel="Hiring range"
              helperText="New on-site gigs use this location, so nearby job seekers see them first." />
          </Card>

          {error ? <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}><Banner icon="alert-circle-outline" color={colors.red} text={error} /></View> : null}

          <RatingsCard title="Reviews from job seekers" average={avg} total={total} ratings={data?.ratings ?? []}
            emptyText="No reviews yet. Accept and hire job seekers to start building your reputation." />

          {(data?.history.length ?? 0) > 0 && (
            <Card style={s.card}>
              <SectionTitle icon="time-outline" title={`Gig history · ${plural(data!.history.length, 'gig')}`} style={{ marginTop: 0 }} />
              {data!.history.map(h => (
                <View key={h.gig.id} style={s.hRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.hTitle}>{h.gig.title}</Text>
                    <Text style={s.hSub}>{h.gig.category} · {h.gig.pay}</Text>
                  </View>
                  {h.totalWorkers ? (
                    <View style={s.avatars}>
                      {h.hiredWorkers.slice(0, 3).map((w, i) => (
                        <View key={w.id} style={{ marginLeft: i ? -10 : 0, borderWidth: 2, borderColor: colors.white, borderRadius: 18 }}>
                          <Avatar name={w.name} color={w.avatarColor} size={30} />
                        </View>
                      ))}
                      <Text style={s.hCount}>{h.totalWorkers} hired</Text>
                    </View>
                  ) : <Text style={s.hNone}>No hires yet</Text>}
                </View>
              ))}
            </Card>
          )}

          <AccountCard />
        </ScrollView>
        <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => { setForm(baseline); setError(''); }} />
      </KeyboardAvoidingView>

      <Sheet visible={industryOpen} title="Industry" onClose={() => setIndustryOpen(false)}>
        {INDUSTRIES.map(ind => (
          <Pressable key={ind} style={s.option} onPress={() => { set('industry', ind); setIndustryOpen(false); }}>
            <Text style={[s.optionText, form.industry === ind && { color: colors.accent, fontWeight: '800' }]}>{ind}</Text>
            {form.industry === ind ? <Icon name="checkmark" size={18} color={colors.accent} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: colors.body, marginBottom: 6 },
  select: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    paddingHorizontal: 14, height: 52, marginBottom: 24 },
  selectText: { flex: 1, fontSize: 15, color: colors.dark },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { flex: 1, fontSize: 16, color: colors.dark },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  hTitle: { fontSize: 15, fontWeight: '700', color: colors.dark },
  hSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  hCount: { fontSize: 12, fontWeight: '700', color: colors.green, marginLeft: 6 },
  hNone: { fontSize: 12, color: colors.subtle },
});
