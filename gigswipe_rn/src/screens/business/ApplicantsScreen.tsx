import React, { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type ApplicantWithWorker } from '../../api';
import { useFocusData, useSocketEvent } from '../../hooks';
import { colors, radius, shadow, spacing } from '../../theme';
import { Avatar, Button, EmptyState, ErrorView, Header, Loading } from '../../components/ui';
import { STATUS_META } from '../../components/ConversationRow';
import { RatingSheet } from '../../components/RatingSheet';
import { formatDate, formatTime, plural, toast } from '../../utils/format';
import { t } from '../../i18n';
import { AVAILABILITY_SLOTS } from '../../config';
import type { RootScreen } from '../../navigation/types';

type Tab = 'all' | 'pending' | 'accepted' | 'hired';

export default function ApplicantsScreen({ route, navigation }: RootScreen<'Applicants'>) {
  const { gigId, title } = route.params;
  const [tab, setTab] = useState<Tab>('all');
  const [rating, setRating] = useState<ApplicantWithWorker | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, setData, loading, error, refreshing, refresh, reload, retry } = useFocusData(async () => {
    const [{ applicants }, { ratedApplicationIds }] = await Promise.all([api.applications.forGig(gigId), api.ratings.given()]);
    return { applicants, rated: new Set(ratedApplicationIds) };
  }, [gigId]);
  useSocketEvent('application_update', reload);

  const all = data?.applicants ?? [];
  const list = tab === 'all' ? all : all.filter(a => a.status === tab);
  const count = (k: Tab) => (k === 'all' ? all.length : all.filter(a => a.status === k).length);

  const setStatus = (a: ApplicantWithWorker, status: 'accepted' | 'rejected') => {
    const name = a.worker?.name ?? t('this applicant');
    Alert.alert(
      status === 'accepted' ? t('Accept {name}?', { name }) : t('Decline {name}?', { name }),
      status === 'accepted'
        ? t('They’ll get a 4-digit hire code to show you when you meet. You can chat to agree details.')
        : t('Their application will be closed.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: status === 'accepted' ? t('Accept') : t('Decline'), style: status === 'rejected' ? 'destructive' : 'default', onPress: async () => {
          setBusyId(a.id);
          try {
            const { application } = await api.applications.setStatus(a.id, status);
            setData(d => d ? { ...d, applicants: d.applicants.map(x => x.id === a.id ? { ...x, ...application } : x) } : d);
            if (status === 'accepted') navigation.navigate('Chat', { applicationId: a.id });
            else toast(t('Application declined'));
          } catch (e) { Alert.alert(t('Something went wrong'), errorMessage(e)); }
          finally { setBusyId(null); }
        } },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title={title ?? t('Applicants')} subtitle={data ? plural(all.length, 'applicant') : undefined} />

      <View style={s.tabs}>
        {(['all', 'pending', 'accepted', 'hired'] as Tab[]).map(k => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}>
            <Text style={[s.tabText, tab === k && s.tabTextOn]}>
              {k === 'all' ? t('All') : t(STATUS_META[k].label)} {count(k) ? `(${count(k)})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? <Loading /> : error && !data ? <ErrorView message={error} onRetry={retry} /> : (
        <FlatList
          data={list}
          keyExtractor={a => a.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState icon="people-outline"
            title={tab === 'all' ? t('No applicants yet') : t('No one in "{status}" yet', { status: t(STATUS_META[tab as Exclude<Tab, 'all'>].label) })}
            message={tab === 'all' ? t('People who swipe right on this gig will show up here.') : undefined} />}
          renderItem={({ item }) => {
            const w = item.worker;
            const meta = STATUS_META[item.status];
            const rated = data?.rated.has(item.id);
            const slots = (w?.availability ?? []).map(k => AVAILABILITY_SLOTS.find(a => a.key === k)?.label).filter(Boolean) as string[];
            return (
              <View style={s.card}>
                <Pressable style={s.top} onPress={() => navigation.navigate('UserProfile', { userId: item.workerId })}>
                  <Avatar name={w?.name} color={w?.avatarColor} photo={w?.photoUrl} badge={w?.availableNow} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{w?.name ?? t('Job seeker')}</Text>
                    {w?.major || w?.year ? <Text style={s.meta}>{[w?.major, w?.year].filter(Boolean).join(' · ')}</Text> : null}
                    <Text style={s.applied}>{t('Applied {date}', { date: formatDate(item.createdAt) })} · <Text style={{ color: meta.color, fontWeight: '700' }}>{t(meta.label)}</Text></Text>
                  </View>
                </Pressable>
                {w?.availableNow && w.availableUntil ? (
                  <Text style={s.now}>⚡ {t('Available now, until {time}', { time: formatTime(w.availableUntil) })}</Text>
                ) : null}
                {w?.bio ? <Text style={s.bio} numberOfLines={3}>{w.bio}</Text> : null}
                {slots.length ? <Text style={s.avail} numberOfLines={2}>🗓 {slots.map(l => t(l)).join(', ')}</Text> : null}
                {(w?.skills?.length ?? 0) > 0 && (
                  <View style={s.skills}>
                    {w!.skills!.slice(0, 6).map(sk => <View key={sk} style={s.skill}><Text style={s.skillText}>{sk}</Text></View>)}
                    {w!.skills!.length > 6 ? <Text style={s.more}>+{w!.skills!.length - 6}</Text> : null}
                  </View>
                )}
                <View style={s.actions}>
                  <Button title={t('Chat')} icon="chatbubble-outline" size="sm" variant="outline" style={{ flex: 1 }}
                    onPress={() => navigation.navigate('Chat', { applicationId: item.id })} />
                  {item.status === 'pending' && <>
                    <Button title={t('Decline')} size="sm" variant="danger" style={{ flex: 1 }} disabled={busyId === item.id} onPress={() => setStatus(item, 'rejected')} />
                    <Button title={t('Accept')} size="sm" variant="success" style={{ flex: 1 }} loading={busyId === item.id} onPress={() => setStatus(item, 'accepted')} />
                  </>}
                  {(item.status === 'accepted' || item.status === 'hired') && (
                    rated
                      ? <View style={[s.ratedBox, { flex: 1 }]}><Text style={s.ratedText}>✓ {t('Rated')}</Text></View>
                      : <Button title={t('Rate')} icon="star-outline" size="sm" variant="soft" color={colors.amber} style={{ flex: 1 }} onPress={() => setRating(item)} />
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      <RatingSheet
        visible={!!rating}
        targetName={rating?.worker?.name ?? ''}
        gigTitle={rating?.gigTitle ?? title ?? ''}
        onClose={() => setRating(null)}
        onSubmit={async (stars, review) => {
          const id = rating!.id;
          await api.ratings.submit({ applicationId: id, stars, review: review || undefined });
          setData(d => d ? { ...d, rated: new Set([...d.rated, id]) } : d);
          toast(t('Thanks for your review!'));
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { paddingHorizontal: 12, height: 32, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  tabOn: { backgroundColor: colors.dark },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  tabTextOn: { color: colors.white },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderMid, ...shadow.card },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: colors.dark },
  meta: { fontSize: 13, color: colors.body, marginTop: 2 },
  applied: { fontSize: 12, color: colors.subtle, marginTop: 3 },
  bio: { fontSize: 14, color: colors.body, marginTop: 12, lineHeight: 20 },
  now: { fontSize: 13, color: colors.green, fontWeight: '700', marginTop: 10 },
  avail: { fontSize: 12, color: colors.body, marginTop: 8 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  skill: { backgroundColor: colors.accentLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  skillText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  more: { fontSize: 12, color: colors.muted, alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  ratedBox: { height: 34, alignItems: 'center', justifyContent: 'center' },
  ratedText: { fontSize: 13, fontWeight: '700', color: colors.amber },
});
