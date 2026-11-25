import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type Gig, type GigViewerState } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n';
import { colors, font, radius, spacing, tint } from '../../theme';
import { Avatar, Banner, Button, ErrorView, Header, IconButton, Loading, Pill } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { PhotoGallery } from '../../components/Photos';
import { distanceLabel, formatSchedule, openDirections, payText, startsIn, toast, timeAgo } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';

export default function GigDetailScreen({ route, navigation }: RootScreen<'GigDetail'>) {
  const { gigId } = route.params;
  const { user } = useAuth();
  const [gig, setGig] = useState<Gig | null>(null);
  const [viewer, setViewer] = useState<GigViewerState | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.gigs.get(gigId).then(r => { setGig(r.gig); setViewer(r.viewer); }).catch(e => setError(errorMessage(e)));
  }, [gigId]);
  useEffect(load, [load]);

  const apply = async () => {
    if (!gig) return;
    if (viewer?.applicationId) { navigation.replace('Chat', { applicationId: viewer.applicationId }); return; }
    setApplying(true);
    try {
      const { application, alreadyApplied } = await api.applications.apply(gig.id);
      toast(alreadyApplied ? t('You already applied. Opening your chat.') : t('Applied! Say hello to the job giver.'));
      navigation.replace('Chat', { applicationId: application.id });
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setApplying(false);
    }
  };

  const toggleSave = async () => {
    if (!gig || !viewer) return;
    const next = !viewer.saved;
    setViewer({ ...viewer, saved: next });
    try {
      if (next) await api.saved.add(gig.id); else await api.saved.remove(gig.id);
      toast(next ? t('Saved for later') : t('Removed from saved'));
    } catch (e) {
      setViewer({ ...viewer, saved: !next });
      toast(errorMessage(e));
    }
  };

  if (error) return <SafeAreaView style={s.safe}><Header title={t('Gig details')} /><ErrorView message={error} onRetry={load} /></SafeAreaView>;
  if (!gig) return <SafeAreaView style={s.safe}><Header title={t('Gig details')} /><Loading /></SafeAreaView>;

  const c = gig.businessColor || colors.accent;
  const isWorker = user?.role === 'worker';
  const isOwner = user?.id === gig.businessId;
  const canNavigate = gig.workMode === 'onsite' && gig.latitude != null && gig.longitude != null;
  const closed = gig.expired ? t('This gig has already ended.')
    : gig.status === 'filled' ? t('Every spot on this gig has been filled.')
    : gig.status === 'closed' ? t('This gig is no longer taking applications.') : null;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title={t('Gig details')} right={isWorker && viewer ? (
        <IconButton name={viewer.saved ? 'bookmark' : 'bookmark-outline'} label={viewer.saved ? t('Remove from saved') : t('Save for later')}
          color={viewer.saved ? colors.blue : colors.dark} onPress={toggleSave} />
      ) : isOwner ? (
        <IconButton name="create-outline" label={t('Edit gig')} onPress={() => navigation.navigate('GigEditor', { gigId: gig.id, mode: 'edit' })} />
      ) : undefined} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <PhotoGallery photos={gig.photos ?? []} />
        <Pressable style={[s.hero, { backgroundColor: tint(c, 0.1) }]}
          onPress={() => navigation.navigate('UserProfile', { userId: gig.businessId })}>
          <Avatar name={gig.businessName} color={c} photo={gig.businessPhotoUrl} size={56} square />
          <View style={{ flex: 1 }}>
            <Text style={s.biz}>{gig.businessName}</Text>
            <Text style={s.posted}>{t('Posted {when} · View profile', { when: timeAgo(gig.createdAt) })}</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View style={s.body}>
          {closed ? <View style={{ marginBottom: spacing.md }}><Banner icon="lock-closed-outline" color={colors.muted} text={closed} /></View> : null}
          <View style={s.pills}>
            <Pill text={t(gig.category)} color={c} />
            {gig.startAt && !gig.expired ? <Pill text={startsIn(gig.startAt, gig.endAt)} color={colors.amber} icon="time-outline" /> : null}
            {gig.openings > 1 ? <Pill text={t('{left} of {total} spots left', { left: gig.spotsLeft, total: gig.openings })} color={colors.blue} icon="people-outline" /> : null}
          </View>
          <Text style={s.title}>{gig.title}</Text>

          <View style={s.grid}>
            <InfoBox icon="cash-outline" label={t('Pay')} value={payText(gig)} color={c} />
            <InfoBox icon="people-outline" label={t('People needed')} value={String(gig.openings)} color={c} />
          </View>
          <InfoBox icon="calendar-outline" label={t('When')} wide color={c}
            value={gig.startAt ? formatSchedule(gig.startAt, gig.endAt) : t('Flexible timing')} />
          {gig.hours ? <InfoBox icon="time-outline" label={t('Schedule notes')} value={gig.hours} color={c} wide /> : null}
          <InfoBox
            icon={gig.workMode === 'remote' ? 'home-outline' : 'location-outline'}
            label={gig.workMode === 'remote' ? t('Work type') : t('Location')}
            value={gig.workMode === 'remote' ? t('Remote · work from home')
              : [gig.location, distanceLabel(gig.distanceMiles) && t('{distance} away', { distance: distanceLabel(gig.distanceMiles) })].filter(Boolean).join(' · ')}
            color={c}
            wide
          />

          <Text style={s.section}>{t('About this gig')}</Text>
          <Text style={font.body}>{gig.description}</Text>

          {isWorker ? (
            <View style={s.next}>
              <Text style={[s.section, { marginTop: 0 }]}>{t('What happens next')}</Text>
              {([
                ['paper-plane-outline', t('Your application goes straight to the job giver')],
                ['chatbubbles-outline', t('A private chat opens the moment you apply')],
                ['key-outline', t('If you’re accepted you get a 4-digit hire code to show in person')],
                ['notifications-outline', t('We remind you before the gig starts')],
                ['star-outline', t('After the gig, you both leave a rating')],
              ] as [IconName, string][]).map(([icon, text]) => (
                <View key={text} style={s.nextRow}>
                  <Icon name={icon} size={17} color={colors.accent} />
                  <Text style={s.nextText}>{text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {isWorker && (
        <View style={s.bar}>
          {canNavigate && (
            <IconButton name="navigate-outline" label={t('Directions')} color={c} bg={tint(c, 0.1)}
              onPress={() => openDirections(gig.latitude!, gig.longitude!)} style={s.dirBtn} />
          )}
          {viewer?.applicationId ? (
            <Button title={t('Open chat')} icon="chatbubbles-outline" color={c} onPress={apply} style={{ flex: 1 }} />
          ) : (
            <Button title={closed ? t('Not taking applications') : t('Apply now')} iconRight={closed ? undefined : 'arrow-forward'} color={c}
              onPress={apply} loading={applying} disabled={!!closed} style={{ flex: 1 }} />
          )}
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
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
