// Job givers browse nearby job seekers by skill / availability and invite them.
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type WorkerResult } from '../../api';
import { useCurrentUser } from '../../context/AuthContext';
import { AVAILABILITY_SLOTS, RADIUS_OPTIONS } from '../../config';
import { t } from '../../i18n';
import { colors, font, radius, shadow, spacing } from '../../theme';
import { Avatar, Banner, Button, Chip, EmptyState, ErrorView, Loading, Pill } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { InviteSheet } from '../../components/InviteSheet';
import { distanceLabel, plural } from '../../utils/format';
import type { BusinessTabScreen } from '../../navigation/types';

export default function FindWorkersScreen({ navigation }: BusinessTabScreen<'FindWorkers'>) {
  const me = useCurrentUser();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [availableNow, setAvailableNow] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [radiusMi, setRadiusMi] = useState(25);
  const [data, setData] = useState<{ workers: WorkerResult[]; hasLocation: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [invite, setInvite] = useState<WorkerResult | null>(null);

  useEffect(() => { const id = setTimeout(() => setQuery(q.trim()), 400); return () => clearTimeout(id); }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.users.searchWorkers({ q: query || undefined, availableNow, slot: slot ?? undefined, radius: radiusMi })
      .then(r => { if (!cancelled) { setData(r); setError(null); } })
      .catch(e => { if (!cancelled) setError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, availableNow, slot, radiusMi, reloadKey, me.latitude, me.longitude]);

  const workers = data?.workers ?? [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={font.h1}>{t('Find people')}</Text>
        <Text style={font.small}>{t('Job seekers near you who are open to invites')}</Text>
        <View style={s.search}>
          <Icon name="search" size={17} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder={t('Skill, job or name (e.g. barista, driver)')}
            placeholderTextColor={colors.placeholder} style={s.searchInput} returnKeyType="search" maxLength={60} />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={10}><Icon name="close-circle" size={18} color={colors.subtle} /></Pressable> : null}
        </View>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label={t('Available now')} icon="flash-outline" color={colors.green} selected={availableNow} onPress={() => setAvailableNow(v => !v)} />
          {AVAILABILITY_SLOTS.map(a => (
            <Chip key={a.key} label={t(a.label)} icon={a.icon} selected={slot === a.key} onPress={() => setSlot(slot === a.key ? null : a.key)} />
          ))}
        </ScrollView>
        {data?.hasLocation !== false ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chips, { paddingTop: 0 }]}>
            {RADIUS_OPTIONS.map(r => <Chip key={r} label={t('Within {n} mi', { n: r })} selected={radiusMi === r} onPress={() => setRadiusMi(r)} />)}
          </ScrollView>
        ) : null}
      </View>

      {data && !data.hasLocation ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: 8 }}>
          <Banner icon="locate-outline" color={colors.accent} action={t('Set')} onPress={() => navigation.navigate('BusinessProfile')}
            text={t('Set your business location to see who is closest.')} />
        </View>
      ) : null}

      {loading && !data ? <Loading /> : error && !data ? <ErrorView message={error} onRetry={() => setReloadKey(k => k + 1)} /> : (
        <FlatList
          data={workers}
          keyExtractor={w => w.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 4, gap: spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => setReloadKey(k => k + 1)} colors={[colors.accent]} />}
          ListHeaderComponent={workers.length ? <Text style={s.count}>{plural(workers.length, 'person', 'people')}</Text> : undefined}
          ListEmptyComponent={
            <EmptyState icon="people-outline" title={t('No one found')}
              message={t('Try a bigger distance, remove a filter, or search for a different skill.')} />
          }
          renderItem={({ item }) => (
            <WorkerCard w={item} onOpen={() => navigation.navigate('UserProfile', { userId: item.id })} onInvite={() => setInvite(item)} />
          )}
        />
      )}

      <InviteSheet visible={!!invite} workerId={invite?.id ?? ''} workerName={invite?.name ?? ''}
        onClose={() => setInvite(null)} onPostGig={() => navigation.navigate('PostGig')} />
    </SafeAreaView>
  );
}

function WorkerCard({ w, onOpen, onInvite }: { w: WorkerResult; onOpen: () => void; onInvite: () => void }) {
  const skills = (w.skills ?? []).slice(0, 4);
  const slots = (w.availability ?? []).map(k => AVAILABILITY_SLOTS.find(a => a.key === k)?.label).filter(Boolean) as string[];
  return (
    <Pressable style={s.card} onPress={onOpen}>
      <View style={s.cardTop}>
        <Avatar name={w.name} color={w.avatarColor} photo={w.photoUrl} badge={w.availableNow} size={54} />
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{w.name}</Text>
          <Text style={s.sub} numberOfLines={1}>{[w.major, w.year].filter(Boolean).join(' · ') || t('Job seeker')}</Text>
          <View style={s.metaRow}>
            {w.totalRatings ? <Text style={s.meta}>★ {w.averageStars.toFixed(1)} ({w.totalRatings})</Text> : <Text style={s.meta}>{t('New')}</Text>}
            {w.gigsCompleted ? <Text style={s.meta}>· {plural(w.gigsCompleted, 'gig done', 'gigs done')}</Text> : null}
            {w.distanceMiles != null ? <Text style={s.meta}>· {t('~{distance}', { distance: distanceLabel(w.distanceMiles) })}</Text> : null}
          </View>
        </View>
        {w.availableNow ? <Pill text={t('Available now')} color={colors.green} icon="flash" /> : null}
      </View>
      {skills.length ? (
        <View style={s.skills}>
          {skills.map(sk => <View key={sk} style={s.skill}><Text style={s.skillText}>{sk}</Text></View>)}
          {(w.skills?.length ?? 0) > skills.length ? <Text style={s.more}>+{w.skills!.length - skills.length}</Text> : null}
        </View>
      ) : null}
      {slots.length ? <Text style={s.avail} numberOfLines={1}>🗓 {slots.map(l => t(l)).join(', ')}</Text> : null}
      <View style={s.btns}>
        <Button title={t('View profile')} size="sm" variant="outline" onPress={onOpen} style={{ flex: 1 }} />
        <Button title={t('Invite to a gig')} size="sm" icon="paper-plane-outline" onPress={onInvite} style={{ flex: 1 }} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt, marginTop: 12 },
  searchInput: { flex: 1, fontSize: 14, color: colors.dark, paddingVertical: 0 },
  chips: { paddingHorizontal: spacing.lg, paddingVertical: 10, gap: 8 },
  count: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.borderMid, gap: 10, ...shadow.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 16, fontWeight: '800', color: colors.dark },
  sub: { fontSize: 13, color: colors.body, marginTop: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  meta: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  skill: { backgroundColor: colors.accentLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  skillText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  more: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  avail: { fontSize: 12, color: colors.body },
  btns: { flexDirection: 'row', gap: 8 },
});
