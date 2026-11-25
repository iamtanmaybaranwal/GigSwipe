import React, { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type MyGig } from '../../api';
import { useCurrentUser } from '../../context/AuthContext';
import { useFocusData, useSocketEvent } from '../../hooks';
import { t } from '../../i18n';
import { colors, radius, shadow, spacing, tint } from '../../theme';
import { Avatar, Banner, Button, Chip, EmptyState, ErrorView, IconButton, Loading, Pill } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { formatSchedule, payText, plural, startsIn, toast, timeAgo } from '../../utils/format';
import type { BusinessTabScreen } from '../../navigation/types';

/** What a job giver sees as the gig's state. */
export function gigState(g: Pick<MyGig, 'status' | 'expired'>): { label: string; color: string; live: boolean } {
  if (g.expired) return { label: t('Ended'), color: colors.subtle, live: false };
  if (g.status === 'filled') return { label: t('Filled'), color: colors.green, live: false };
  if (g.status === 'closed') return { label: t('Closed'), color: colors.muted, live: false };
  return { label: t('Open'), color: colors.blue, live: true };
}

export default function DashboardScreen({ navigation }: BusinessTabScreen<'Dashboard'>) {
  const user = useCurrentUser();
  const [menu, setMenu] = useState<MyGig | null>(null);
  const { data, setData, loading, error, refreshing, refresh, reload, retry } = useFocusData(async () => {
    const [{ gigs }, { applications }] = await Promise.all([api.gigs.mine(), api.applications.hired()]);
    return { gigs, hired: applications.length };
  });
  useSocketEvent('application_update', reload);

  const gigs = useMemo(() => data?.gigs ?? [], [data]);
  const sections = useMemo(() => {
    const live = gigs.filter(g => gigState(g).live);
    const past = gigs.filter(g => !gigState(g).live);
    return [
      ...(live.length ? [{ key: 'live', title: t('Active gigs'), data: live }] : []),
      ...(past.length ? [{ key: 'past', title: t('Filled, closed & past'), data: past }] : []),
    ];
  }, [gigs]);
  const totals = gigs.reduce((tt, g) => ({ applicants: tt.applicants + g.applicantCount, pending: tt.pending + g.pendingCount }),
    { applicants: 0, pending: 0 });
  const bizName = user.businessName || user.name;
  const noLocation = user.latitude == null;
  const activeCount = sections.find(x => x.key === 'live')?.data.length ?? 0;

  const patchGig = (g: MyGig) => setData(d => d ? { ...d, gigs: d.gigs.map(x => (x.id === g.id ? { ...x, ...g } : x)) } : d);

  const setOpen = async (gig: MyGig, open: boolean) => {
    try {
      const { gig: updated } = await api.gigs.update(gig.id, { status: open ? 'open' : 'closed' });
      patchGig({ ...gig, ...updated });
      toast(open ? t('Gig reopened') : t('Gig closed. It no longer appears in the feed.'));
    } catch (e) { Alert.alert(t('Something went wrong'), errorMessage(e)); }
  };

  const remove = (gig: MyGig) => Alert.alert(
    t('Delete this gig?'),
    t('"{title}" will disappear from the feed. Pending applicants will see it as closed. Existing chats stay available.', { title: gig.title }),
    [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: async () => {
        try {
          await api.gigs.remove(gig.id);
          setData(d => d ? { ...d, gigs: d.gigs.filter(g => g.id !== gig.id) } : d);
          toast(t('Gig deleted'));
        } catch (e) { Alert.alert(t('Could not delete gig'), errorMessage(e)); }
      } },
    ]
  );

  const actions = (g: MyGig): { icon: IconName; label: string; color?: string; onPress: () => void }[] => {
    const st = gigState(g);
    return [
      { icon: 'people-outline', label: t('View applicants'), onPress: () => navigation.navigate('Applicants', { gigId: g.id, title: g.title }) },
      ...(!g.expired ? [{ icon: 'create-outline' as IconName, label: t('Edit gig'), onPress: () => navigation.navigate('GigEditor', { gigId: g.id, mode: 'edit' }) }] : []),
      { icon: 'copy-outline', label: g.expired ? t('Repost with new dates') : t('Duplicate'), onPress: () => navigation.navigate('GigEditor', { gigId: g.id, mode: 'duplicate' }) },
      ...(st.live ? [{ icon: 'pause-circle-outline' as IconName, label: t('Close applications'), onPress: () => setOpen(g, false) }] : []),
      ...(g.status === 'closed' && !g.expired ? [{ icon: 'play-circle-outline' as IconName, label: t('Reopen'), onPress: () => setOpen(g, true) }] : []),
      ...(g.status === 'filled' && !g.expired ? [{ icon: 'person-add-outline' as IconName, label: t('Need more people? Edit openings'), onPress: () => navigation.navigate('GigEditor', { gigId: g.id, mode: 'edit' }) }] : []),
      { icon: 'trash-outline', label: t('Delete'), color: colors.red, onPress: () => remove(g) },
    ];
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Avatar name={bizName} color={user.avatarColor} photo={user.photoUrl} size={46} square />
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>{t('Dashboard')}</Text>
          <Text style={s.biz} numberOfLines={1}>{bizName}</Text>
        </View>
        <Button title={t('Post gig')} icon="add" size="md" onPress={() => navigation.navigate('PostGig')} />
      </View>

      {loading ? <Loading /> : error && !data ? <ErrorView message={error} onRetry={retry} /> : (
        <SectionList
          sections={sections}
          keyExtractor={g => g.id}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, flexGrow: 1 }}
          ItemSeparatorComponent={Gap}
          ListHeaderComponent={
            <View style={{ gap: spacing.md }}>
              <View style={s.stats}>
                <Stat icon="briefcase-outline" value={activeCount} label={t('Active gigs')} color={colors.accent} />
                <Stat icon="people-outline" value={totals.applicants} label={t('Applicants')} color={colors.blue} />
                <Stat icon="hourglass-outline" value={totals.pending} label={t('To review')} color={colors.amber} />
                <Stat icon="checkmark-circle-outline" value={data?.hired ?? 0} label={t('Hired')} color={colors.green} />
              </View>
              {noLocation && (
                <Banner icon="locate-outline" color={colors.accent} action={t('Set')}
                  text={t('Add your business location so nearby job seekers see your on-site gigs first.')}
                  onPress={() => navigation.navigate('BusinessProfile')} />
              )}
              <Pressable style={s.findCard} onPress={() => navigation.navigate('FindWorkers')}>
                <View style={s.findIcon}><Icon name="search" size={18} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.findTitle}>{t('Find people nearby')}</Text>
                  <Text style={s.findSub}>{t('Browse job seekers by skill and invite them to apply.')}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            </View>
          }
          renderSectionHeader={({ section }) => <Text style={s.listTitle}>{section.title}</Text>}
          ListEmptyComponent={
            <EmptyState icon="briefcase-outline" title={t('No gigs posted yet')}
              message={t('Post your first gig. It takes about a minute and people nearby can apply straight away.')}
              action={t('Post a gig')} onAction={() => navigation.navigate('PostGig')} />
          }
          renderItem={({ item }) => (
            <GigCard gig={item} onPress={() => navigation.navigate('Applicants', { gigId: item.id, title: item.title })} onMenu={() => setMenu(item)} />
          )}
        />
      )}

      <Sheet visible={!!menu} title={menu?.title ?? ''} onClose={() => setMenu(null)}>
        {menu ? actions(menu).map(a => (
          <Pressable key={a.label} style={s.menuRow} onPress={() => { setMenu(null); a.onPress(); }}>
            <Icon name={a.icon} size={20} color={a.color ?? colors.dark} />
            <Text style={[s.menuText, a.color ? { color: a.color } : null]}>{a.label}</Text>
          </Pressable>
        )) : null}
      </Sheet>
    </SafeAreaView>
  );
}

const Gap = () => <View style={{ height: spacing.md }} />;

function Stat({ icon, value, label, color }: { icon: IconName; value: number; label: string; color: string }) {
  return (
    <View style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: tint(color, 0.12) }]}><Icon name={icon} size={16} color={color} /></View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function GigCard({ gig, onPress, onMenu }: { gig: MyGig; onPress: () => void; onMenu: () => void }) {
  const c = gig.businessColor || colors.accent;
  const st = gigState(gig);
  const when = gig.startAt ? formatSchedule(gig.startAt, gig.endAt) : gig.hours || t('Flexible timing');
  return (
    <Pressable onPress={onPress} android_ripple={{ color: colors.surfaceAlt }} style={[s.card, !st.live && { opacity: 0.85 }]}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            <Pill text={st.label} color={st.color} solid={st.live} />
            {st.live && gig.startAt ? <Pill text={startsIn(gig.startAt, gig.endAt)} color={colors.amber} icon="time-outline" /> : null}
          </View>
          <Text style={s.cardTitle} numberOfLines={2}>{gig.title}</Text>
          <Text style={s.cardMeta} numberOfLines={1}>{payText(gig)} · {when}</Text>
          <Text style={s.cardLoc} numberOfLines={1}>
            {gig.workMode === 'remote' ? t('Remote') : gig.location} · {t('posted {when}', { when: timeAgo(gig.createdAt) })}
          </Text>
        </View>
        <IconButton name="ellipsis-vertical" label={t('Gig options')} color={colors.muted} size={20} onPress={onMenu} />
      </View>
      <View style={s.cardFoot}>
        <Chip label={t('{hired}/{total} hired', { hired: gig.hiredCount, total: gig.openings })} icon="people-outline"
          selected={gig.hiredCount > 0} color={colors.green} style={{ height: 30 }} />
        <View style={{ flex: 1 }} />
        {gig.pendingCount > 0 && <Pill text={t('{n} new', { n: gig.pendingCount })} color={colors.amber} solid />}
        <View style={s.applicants}>
          <Text style={[s.applicantsText, !gig.applicantCount && { color: colors.subtle }]}>
            {gig.applicantCount ? plural(gig.applicantCount, 'applicant') : t('No applicants yet')}
          </Text>
          {gig.applicantCount ? <Icon name="chevron-forward" size={14} color={c} /> : null}
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
  findCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: colors.borderMid },
  findIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  findTitle: { fontSize: 15, fontWeight: '800', color: colors.dark },
  findSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  listTitle: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.xl, marginBottom: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderMid, ...shadow.card },
  cardTop: { flexDirection: 'row', gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.dark },
  cardMeta: { fontSize: 14, color: colors.body, marginTop: 4, fontWeight: '600' },
  cardLoc: { fontSize: 12, color: colors.muted, marginTop: 3 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  applicants: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  applicantsText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuText: { fontSize: 15, fontWeight: '600', color: colors.dark },
});
