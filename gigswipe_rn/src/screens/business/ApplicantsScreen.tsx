import React, { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type ApplicantWithWorker } from '../../api';
import { useFocusData, useSocketEvent } from '../../hooks';
import { colors, radius, shadow, spacing } from '../../theme';
import { Avatar, Button, EmptyState, ErrorView, Header, Loading } from '../../components/ui';
import { STATUS_META } from '../../components/ConversationRow';
import { RatingSheet } from '../../components/RatingSheet';
import { formatDate, plural, toast } from '../../utils/format';
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
  const count = (t: Tab) => (t === 'all' ? all.length : all.filter(a => a.status === t).length);

  const setStatus = (a: ApplicantWithWorker, status: 'accepted' | 'rejected') => {
    const name = a.worker?.name ?? 'this applicant';
    Alert.alert(
      status === 'accepted' ? `Accept ${name}?` : `Decline ${name}?`,
      status === 'accepted'
        ? 'They’ll get a 4-digit hire code to show you when you meet. You can chat to agree details.'
        : 'Their application will be closed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: status === 'accepted' ? 'Accept' : 'Decline', style: status === 'rejected' ? 'destructive' : 'default', onPress: async () => {
          setBusyId(a.id);
          try {
            const { application } = await api.applications.setStatus(a.id, status);
            setData(d => d ? { ...d, applicants: d.applicants.map(x => x.id === a.id ? { ...x, ...application } : x) } : d);
            if (status === 'accepted') navigation.navigate('Chat', { applicationId: a.id });
            else toast('Application declined');
          } catch (e) { Alert.alert('Something went wrong', errorMessage(e)); }
          finally { setBusyId(null); }
        } },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title={title ?? 'Applicants'} subtitle={data ? plural(all.length, 'applicant') : undefined} />

      <View style={s.tabs}>
        {(['all', 'pending', 'accepted', 'hired'] as Tab[]).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]}>
            <Text style={[s.tabText, tab === t && s.tabTextOn]}>
              {t === 'all' ? 'All' : STATUS_META[t].label} {count(t) ? `(${count(t)})` : ''}
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
            title={tab === 'all' ? 'No applicants yet' : `No ${STATUS_META[tab as Exclude<Tab, 'all'>].label.toLowerCase()} applicants`}
            message={tab === 'all' ? 'People who swipe right on this gig will show up here.' : undefined} />}
          renderItem={({ item }) => {
            const w = item.worker;
            const meta = STATUS_META[item.status];
            const rated = data?.rated.has(item.id);
            return (
              <View style={s.card}>
                <Pressable style={s.top} onPress={() => navigation.navigate('UserProfile', { userId: item.workerId })}>
                  <Avatar name={w?.name} color={w?.avatarColor} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{w?.name ?? 'Job seeker'}</Text>
                    {w?.major || w?.year ? <Text style={s.meta}>{[w?.major, w?.year].filter(Boolean).join(' · ')}</Text> : null}
                    <Text style={s.applied}>Applied {formatDate(item.createdAt)} · <Text style={{ color: meta.color, fontWeight: '700' }}>{meta.label}</Text></Text>
                  </View>
                </Pressable>
                {w?.bio ? <Text style={s.bio} numberOfLines={3}>{w.bio}</Text> : null}
                {(w?.skills?.length ?? 0) > 0 && (
                  <View style={s.skills}>
                    {w!.skills!.slice(0, 6).map(sk => <View key={sk} style={s.skill}><Text style={s.skillText}>{sk}</Text></View>)}
                    {w!.skills!.length > 6 ? <Text style={s.more}>+{w!.skills!.length - 6}</Text> : null}
                  </View>
                )}
                <View style={s.actions}>
                  <Button title="Chat" icon="chatbubble-outline" size="sm" variant="outline" style={{ flex: 1 }}
                    onPress={() => navigation.navigate('Chat', { applicationId: item.id })} />
                  {item.status === 'pending' && <>
                    <Button title="Decline" size="sm" variant="danger" style={{ flex: 1 }} disabled={busyId === item.id} onPress={() => setStatus(item, 'rejected')} />
                    <Button title="Accept" size="sm" variant="success" style={{ flex: 1 }} loading={busyId === item.id} onPress={() => setStatus(item, 'accepted')} />
                  </>}
                  {(item.status === 'accepted' || item.status === 'hired') && (
                    rated
                      ? <View style={[s.ratedBox, { flex: 1 }]}><Text style={s.ratedText}>✓ Rated</Text></View>
                      : <Button title="Rate" icon="star-outline" size="sm" variant="soft" color={colors.amber} style={{ flex: 1 }} onPress={() => setRating(item)} />
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
          toast('Thanks for your review!');
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
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  skill: { backgroundColor: colors.accentLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  skillText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  more: { fontSize: 12, color: colors.muted, alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  ratedBox: { height: 34, alignItems: 'center', justifyContent: 'center' },
  ratedText: { fontSize: 13, fontWeight: '700', color: colors.amber },
});
