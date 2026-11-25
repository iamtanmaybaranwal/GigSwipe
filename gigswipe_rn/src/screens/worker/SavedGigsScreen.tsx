import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type SavedGig } from '../../api';
import { useFocusData } from '../../hooks';
import { t } from '../../i18n';
import { colors, radius, shadow, spacing } from '../../theme';
import { Avatar, EmptyState, ErrorView, Header, IconButton, Loading, Pill } from '../../components/ui';
import { distanceLabel, formatSchedule, payText, plural, toast } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';

/** Why a saved gig can't be applied to any more, or null if it still can. */
const unavailable = (g: SavedGig) =>
  g.applied ? t('Applied') : g.expired ? t('Ended') : g.status === 'filled' ? t('Filled') : g.status === 'closed' ? t('Closed') : null;

export default function SavedGigsScreen({ navigation }: RootScreen<'SavedGigs'>) {
  const { data, setData, loading, error, refreshing, refresh, retry } = useFocusData(async () => (await api.saved.list()).gigs);
  const list = data ?? [];

  const remove = async (g: SavedGig) => {
    setData(d => d?.filter(x => x.id !== g.id) ?? d);
    try { await api.saved.remove(g.id); } catch (e) {
      toast(errorMessage(e));
      setData(d => (d ? [g, ...d] : d));
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title={t('Saved gigs')} subtitle={data ? plural(list.length, 'gig') : undefined} />
      {loading ? <Loading /> : error && !data ? <ErrorView message={error} onRetry={retry} /> : (
        <FlatList
          data={list}
          keyExtractor={g => g.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
          ListEmptyComponent={
            <EmptyState icon="bookmark-outline" title={t('Nothing saved yet')}
              message={t('Not sure about a gig? Swipe it up or tap the bookmark to save it for later.')} />
          }
          renderItem={({ item }) => {
            const off = unavailable(item);
            return (
              <Pressable style={[s.card, off && !item.applied && { opacity: 0.6 }]} onPress={() => navigation.navigate('GigDetail', { gigId: item.id })}>
                <Avatar name={item.businessName} color={item.businessColor} photo={item.businessPhotoUrl} size={46} square />
                <View style={{ flex: 1 }}>
                  <Text style={s.title} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.biz} numberOfLines={1}>{item.businessName}</Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {[payText(item), item.startAt ? formatSchedule(item.startAt, item.endAt) : null,
                      item.workMode === 'remote' ? t('Remote') : distanceLabel(item.distanceMiles) || item.location].filter(Boolean).join(' · ')}
                  </Text>
                  {off ? <View style={{ marginTop: 6 }}><Pill text={off} color={item.applied ? colors.green : colors.muted} /></View> : null}
                </View>
                <IconButton name="bookmark" label={t('Remove from saved')} color={colors.blue} onPress={() => remove(item)} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: colors.borderMid, ...shadow.card },
  title: { fontSize: 16, fontWeight: '800', color: colors.dark },
  biz: { fontSize: 13, color: colors.body, marginTop: 1 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 3 },
});
