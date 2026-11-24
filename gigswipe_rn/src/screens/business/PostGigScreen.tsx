import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type WorkMode } from '../../api';
import { useCurrentUser } from '../../context/AuthContext';
import { GIG_CATEGORIES } from '../../config';
import { colors, font, radius, spacing } from '../../theme';
import { Banner, Button, SectionTitle, TextField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { toast } from '../../utils/format';
import type { BusinessTabScreen } from '../../navigation/types';

const EMPTY = { title: '', pay: '', hours: '', location: '', category: '', description: '', workMode: 'onsite' as WorkMode };

export default function PostGigScreen({ navigation }: BusinessTabScreen<'PostGig'>) {
  const user = useCurrentUser();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => { setF(p => ({ ...p, [k]: v })); setError(''); };

  const errors = {
    title: !f.title.trim() ? 'Give the gig a title' : null,
    pay: !f.pay.trim() ? 'Say how much it pays' : null,
    hours: !f.hours.trim() ? 'Add the hours or schedule' : null,
    category: !f.category ? 'Pick a category' : null,
    description: f.description.trim().length < 20 ? 'Describe the gig in at least 20 characters' : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (touched ? errors[k] : null);
  const hasCoords = user.latitude != null && user.longitude != null;

  const submit = async () => {
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    try {
      await api.gigs.create({
        title: f.title.trim(), pay: f.pay.trim(), hours: f.hours.trim(), description: f.description.trim(),
        category: f.category, workMode: f.workMode,
        ...(f.workMode === 'onsite' && f.location.trim() && { location: f.location.trim() }),
      });
      toast('Gig posted! Job seekers can apply now.');
      setF(EMPTY);
      setTouched(false);
      navigation.navigate('Dashboard');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={font.h1}>Post a gig</Text>
        <Text style={font.small}>Clear details get better applicants, faster.</Text>
      </View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SectionTitle icon="create-outline" title="Basics" style={{ marginTop: 0 }} />
          <TextField label="Gig title *" icon="create-outline" value={f.title} onChangeText={v => set('title', v)}
            placeholder="e.g. Weekend barista, Event setup crew" maxLength={80} error={show('title')} />
          <TextField label="Pay *" icon="cash-outline" value={f.pay} onChangeText={v => set('pay', v)}
            placeholder="e.g. $18/hr, $150 flat, ₹800/day" maxLength={60} error={show('pay')} />
          <TextField label="Hours / schedule *" icon="time-outline" value={f.hours} onChangeText={v => set('hours', v)}
            placeholder="e.g. Sat–Sun 8am–2pm, 10 hrs/week" maxLength={60} error={show('hours')} />

          <Text style={s.label}>Work type *</Text>
          <View style={s.modeRow}>
            {([['onsite', 'On-site', 'business-outline'], ['remote', 'Remote', 'home-outline']] as const).map(([mode, label, icon]) => (
              <Pressable key={mode} onPress={() => set('workMode', mode)} style={[s.mode, f.workMode === mode && s.modeOn]}
                accessibilityState={{ selected: f.workMode === mode }}>
                <Icon name={icon} size={18} color={f.workMode === mode ? colors.accent : colors.muted} />
                <Text style={[s.modeText, f.workMode === mode && { color: colors.accent }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {f.workMode === 'onsite' ? (
            <>
              <TextField label="Address or area" icon="location-outline" value={f.location} onChangeText={v => set('location', v)}
                placeholder={user.locationLabel || user.location || 'e.g. 12 Main St, Downtown'} maxLength={120}
                hint={user.locationLabel ? `Leave empty to use "${user.locationLabel}"` : undefined} />
              {!hasCoords && (
                <Banner icon="locate-outline" color={colors.amber} action="Profile" onPress={() => navigation.navigate('BusinessProfile')}
                  text="Set your business location in Profile so this gig shows distance and appears on the map." />
              )}
            </>
          ) : (
            <Banner icon="information-circle-outline" color={colors.muted} text="Remote gigs are shown to job seekers everywhere, with no map or directions." />
          )}

          <SectionTitle icon="pricetags-outline" title="Category *" />
          <View style={s.cats}>
            {GIG_CATEGORIES.map(c => {
              const on = f.category === c.label;
              return (
                <Pressable key={c.label} onPress={() => set('category', c.label)} style={[s.cat, on && s.catOn]}
                  accessibilityState={{ selected: on }}>
                  <Icon name={c.icon} size={18} color={on ? colors.accent : colors.muted} />
                  <Text style={[s.catText, on && { color: colors.accent }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {show('category') ? <Text style={s.err}>{show('category')}</Text> : null}

          <SectionTitle icon="document-text-outline" title="Description *" />
          <TextField value={f.description} onChangeText={v => set('description', v)} multiline maxLength={2000}
            placeholder="What will the person do? What skills or experience help? Anything to bring? What's the place like?"
            error={show('description')} />

          {error ? <Banner icon="alert-circle-outline" color={colors.red} text={error} /> : null}
          <Button title="Post gig" icon="rocket-outline" onPress={submit} loading={busy} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  body: { padding: 20, paddingBottom: 48 },
  label: { ...font.label, marginBottom: 8 },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  mode: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderMid, backgroundColor: colors.surface },
  modeOn: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  modeText: { fontSize: 15, fontWeight: '700', color: colors.muted },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 42, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.borderMid, backgroundColor: colors.surface },
  catOn: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  catText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  err: { fontSize: 12, color: colors.red, marginTop: 6 },
});
