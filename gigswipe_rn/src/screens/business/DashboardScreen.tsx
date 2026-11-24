import React from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type MyGig } from '../../api';
import { useCurrentUser } from '../../context/AuthContext';
import { useFocusData, useSocketEvent } from '../../hooks';
import { colors, radius, shadow, spacing, tint } from '../../theme';
import { Avatar, Banner, Button, EmptyState, ErrorView, IconButton, Loading, Pill } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { plural, toast } from '../../utils/format';
import type { BusinessTabScreen } from '../../navigation/types';

export default function DashboardScreen({ navigation }: BusinessTabScreen<'Dashboard'>) {
  const user = useCurrentUser();
  const { data, setData, loading, error, refreshing, refresh, reload, retry } = useFocusData(async () => {
    const [{ gigs }, { applications }] = await Promise.all([api.gigs.mine(), api.applications.hired()]);
    return { gigs, hired: applications.length };
  });
  useSocketEvent('application_update', reload);

  const gigs = data?.gigs ?? [];
  const totals = gigs.reduce((t, g) => ({ applicants: t.applicants + g.applicantCount, pending: t.pending + g.pendingCount }),
    { applicants: 0, pending: 0 });
  const bizName = user.businessName || user.name;
  const noLocation = user.latitude == null;

  const remove = (gig: MyGig) => Alert.alert(
    'Remove this gig?',
    `"${gig.title}" will disappear from the feed. Pending applicants will see it as closed. Existing chats stay available.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.gigs.remove(gig.id);
          setData(d => d ? { ...d, gigs: d.gigs.filter(g => g.id !== gig.id) } : d);
          toast('Gig removed');
        } catch (e) { Alert.alert('Could not remove gig', errorMessage(e)); }
      } },
    ]
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Avatar name={bizName} color={user.avatarColor} size={46} square />
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>Dashboard</Text>
          <Text style={s.biz} numberOfLines={1}>{bizName}</Text>
        </View>
        <Button title="Post gig" icon="add" size="md" onPress={() => navigation.navigate('PostGig')} />
      </View>

      {loading ? <Loading /> : error && !data ? <ErrorView message={error} onRetry={retry} /> : (
        <FlatList
          data={gigs}
          keyExtractor={g => g.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          ListHeaderComponent={
            <View style={{ gap: spacing.md }}>
              <View style={s.stats}>
                <Stat icon="briefcase-outline" value={gigs.length} label="Active gigs" color={colors.accent} />
                <Stat icon="people-outline" value={totals.applicants} label="Applicants" color={colors.blue} />
                <Stat icon="hourglass-outline" value={totals.pending} label="To review" color={colors.amber} />
                <Stat icon="checkmark-circle-outline" value={data?.hired ?? 0} label="Hired" color={colors.green} />
              </View>
              {noLocation && (
                <Banner icon="locate-outline" color={colors.accent} action="Set"
                  text="Add your business location so nearby job seekers see your on-site gigs first."
                  onPress={() => navigation.navigate('BusinessProfile')} />
              )}
              {gigs.length > 0 && <Text style={s.listTitle}>Your gigs</Text>}
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="briefcase-outline" title="No gigs posted yet"
              message="Post your first gig. It takes about a minute and people nearby can apply straight away."
              action="Post a gig" onAction={() => navigation.navigate('PostGig')} />
          }
          renderItem={({ item }) => (
            <GigCard gig={item} onPress={() => navigation.navigate('Applicants', { gigId: item.id, title: item.title })} onDelete={() => remove(item)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Stat({ icon, value, label, color }: { icon: IconName; value: number; label: string; color: string }) {
  return (
    <View style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: tint(color, 0.12) }]}><Icon name={icon} size={16} color={color} /></View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function GigCard({ gig, onPress, onDelete }: { gig: MyGig; onPress: () => void; onDelete: () => void }) {
  const c = gig.businessColor || colors.accent;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: colors.surfaceAlt }} style={s.card}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{gig.title}</Text>
          <Text style={s.cardMeta} numberOfLines={1}>{gig.pay} · {gig.hours}</Text>
          <Text style={s.cardLoc} numberOfLines={1}>
            {gig.workMode === 'remote' ? 'Remote' : gig.location} · posted {gig.postedAt.toLowerCase()}
          </Text>
        </View>
        <IconButton name="trash-outline" label="Remove gig" color={colors.red} size={18} onPress={onDelete} />
      </View>
      <View style={s.cardFoot}>
        <Pill text={gig.category} color={c} />
        <View style={{ flex: 1 }} />
        {gig.pendingCount > 0 && <Pill text={`${gig.pendingCount} new`} color={colors.amber} solid />}
        <View style={s.applicants}>
          <Icon name="people-outline" size={14} color={gig.applicantCount ? colors.accent : colors.subtle} />
          <Text style={[s.applicantsText, !gig.applicantCount && { color: colors.subtle }]}>
            {gig.applicantCount ? plural(gig.applicantCount, 'applicant') : 'No applicants yet'}
          </Text>
          {gig.applicantCount ? <Icon name="chevron-forward" size={14} color={colors.accent} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  hello: { fontSize: 12, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  biz: { fontSize: 19, fontWeight: '800', color: colors.dark },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.borderMid },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 10, color: colors.muted, fontWeight: '700', marginTop: 1, textAlign: 'center' },
  listTitle: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderMid, ...shadow.card },
  cardTop: { flexDirection: 'row', gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.dark },
  cardMeta: { fontSize: 14, color: colors.body, marginTop: 4, fontWeight: '600' },
  cardLoc: { fontSize: 12, color: colors.muted, marginTop: 3 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  applicants: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  applicantsText: { fontSize: 13, fontWeight: '700', color: colors.accent },
});
