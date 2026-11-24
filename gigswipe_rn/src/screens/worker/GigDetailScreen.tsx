import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type Gig } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { colors, font, radius, spacing, tint } from '../../theme';
import { Avatar, Button, ErrorView, Header, IconButton, Loading, Pill } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { distanceLabel, openDirections, toast } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';

export default function GigDetailScreen({ route, navigation }: RootScreen<'GigDetail'>) {
  const { gigId } = route.params;
  const { user } = useAuth();
  const [gig, setGig] = useState<Gig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.gigs.get(gigId).then(r => setGig(r.gig)).catch(e => setError(errorMessage(e)));
  }, [gigId]);
  useEffect(load, [load]);

  const apply = async () => {
    if (!gig) return;
    setApplying(true);
    try {
      const { application, alreadyApplied } = await api.applications.apply(gig.id);
      toast(alreadyApplied ? 'You already applied — opening your chat' : 'Applied! Say hello to the job giver.');
      navigation.replace('Chat', { applicationId: application.id });
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setApplying(false);
    }
  };

  if (error) return <SafeAreaView style={s.safe}><Header title="Gig details" /><ErrorView message={error} onRetry={load} /></SafeAreaView>;
  if (!gig) return <SafeAreaView style={s.safe}><Header title="Gig details" /><Loading /></SafeAreaView>;

  const c = gig.businessColor || colors.accent;
  const isWorker = user?.role === 'worker';
  const canNavigate = gig.workMode === 'onsite' && gig.latitude != null && gig.longitude != null;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title="Gig details" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Pressable style={[s.hero, { backgroundColor: tint(c, 0.1) }]}
          onPress={() => navigation.navigate('UserProfile', { userId: gig.businessId })}>
          <Avatar name={gig.businessName} color={c} size={56} square />
          <View style={{ flex: 1 }}>
            <Text style={s.biz}>{gig.businessName}</Text>
            <Text style={s.posted}>Posted {gig.postedAt.toLowerCase()} · View profile</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View style={s.body}>
          <Pill text={gig.category} color={c} />
          <Text style={s.title}>{gig.title}</Text>

          <View style={s.grid}>
            <InfoBox icon="cash-outline" label="Pay" value={gig.pay} color={c} />
            <InfoBox icon="time-outline" label="Hours" value={gig.hours} color={c} />
          </View>
          <InfoBox
            icon={gig.workMode === 'remote' ? 'home-outline' : 'location-outline'}
            label={gig.workMode === 'remote' ? 'Work type' : 'Location'}
            value={gig.workMode === 'remote' ? 'Remote — work from home'
              : [gig.location, distanceLabel(gig.distanceMiles) && `${distanceLabel(gig.distanceMiles)} away`].filter(Boolean).join(' · ')}
            color={c}
            wide
          />

          <Text style={s.section}>About this gig</Text>
          <Text style={font.body}>{gig.description}</Text>

          <View style={s.next}>
            <Text style={[s.section, { marginTop: 0 }]}>What happens next</Text>
            {([
              ['paper-plane-outline', 'Your application goes straight to the job giver'],
              ['chatbubbles-outline', 'A private chat opens the moment you apply'],
              ['key-outline', 'If you’re accepted you get a 4-digit hire code to show in person'],
              ['star-outline', 'After the gig, you both leave a rating'],
            ] as [IconName, string][]).map(([icon, text]) => (
              <View key={text} style={s.nextRow}>
                <Icon name={icon} size={17} color={colors.accent} />
                <Text style={s.nextText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {isWorker && (
        <View style={s.bar}>
          {canNavigate && (
            <IconButton name="navigate-outline" label="Directions" color={c} bg={tint(c, 0.1)}
              onPress={() => openDirections(gig.latitude!, gig.longitude!)} style={s.dirBtn} />
          )}
          <Button title="Apply now" iconRight="arrow-forward" color={c} onPress={apply} loading={applying} style={{ flex: 1 }} />
        </View>
      )}
    </SafeAreaView>
  );
}

function InfoBox({ icon, label, value, color, wide }: { icon: IconName; label: string; value: string; color: string; wide?: boolean }) {
  return (
    <View style={[s.box, wide ? { marginTop: spacing.md } : { flex: 1 }]}>
      <View style={[s.boxIcon, { backgroundColor: tint(color, 0.12) }]}><Icon name={icon} size={18} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.boxLabel}>{label}</Text>
        <Text style={s.boxValue}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: spacing.xl },
  biz: { fontSize: 17, fontWeight: '800', color: colors.dark },
  posted: { fontSize: 12, color: colors.muted, marginTop: 3 },
  body: { padding: spacing.xl },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark, letterSpacing: -0.5, marginTop: 10, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', gap: spacing.md },
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border },
  boxIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  boxLabel: { fontSize: 11, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  boxValue: { fontSize: 14, color: colors.dark, fontWeight: '700', marginTop: 2 },
  section: { fontSize: 17, fontWeight: '800', color: colors.dark, marginTop: spacing.xxl, marginBottom: spacing.sm },
  next: { marginTop: spacing.xxl, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 12 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextText: { fontSize: 14, color: colors.body, flex: 1, lineHeight: 20 },
  bar: { flexDirection: 'row', gap: 10, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  dirBtn: { width: 54, height: 54, borderRadius: radius.md },
});
