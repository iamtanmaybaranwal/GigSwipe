import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Gig } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useFocusData } from '../../hooks';
import { LeafletMap, type MapPin } from '../../components/LeafletMap';
import { colors, radius, shadow, spacing } from '../../theme';
import { Avatar, Banner, Button, EmptyState, ErrorView, Header, IconButton, Loading } from '../../components/ui';
import { distanceLabel, money, openDirections, payText } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';
import { t } from '../../i18n';

export default function GigsMapScreen({ navigation }: RootScreen<'GigsMap'>) {
  const { user } = useAuth();
  const { data, loading, error, retry } = useFocusData(async () => (await api.gigs.feed()).gigs);
  const [selected, setSelected] = useState<Gig | null>(null);
  const [listMode, setListMode] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const pins = useMemo(() => (data ?? []).filter(g => g.latitude != null && g.longitude != null), [data]);
  const hasUserLocation = user?.latitude != null && user?.longitude != null;
  const showList = listMode || mapFailed;

  const mapPins = useMemo<MapPin[]>(() => pins.map(g => ({
    id: g.id,
    latitude: g.latitude!,
    longitude: g.longitude!,
    color: g.businessColor || colors.accent,
    label: g.payAmount != null ? money(g.payAmount) : g.title.slice(0, 14),
  })), [pins]);
  const me = useMemo(() => (hasUserLocation
    ? { latitude: user!.latitude!, longitude: user!.longitude!, radiusMiles: user!.radiusMiles }
    : null), [hasUserLocation, user]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header
        title={t('Nearby gigs')}
        subtitle={data ? t('{n} on the map', { n: pins.length }) : undefined}
        right={!mapFailed ? (
          <IconButton name={listMode ? 'map-outline' : 'list-outline'} label={listMode ? t('Show map') : t('Show list')}
            onPress={() => setListMode(m => !m)} color={colors.accent} />
        ) : undefined}
      />

      {loading ? <Loading /> : error ? <ErrorView message={error} onRetry={retry} /> : showList ? (
        <FlatList
          data={pins}
          keyExtractor={g => g.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          ListHeaderComponent={mapFailed ? (
            <Banner icon="cloud-offline-outline" color={colors.muted} action={t('Try again')} onPress={() => setMapFailed(false)}
              text={t("The map couldn't load. Check your internet. Showing a list instead.")} />
          ) : undefined}
          ListEmptyComponent={<EmptyState icon="map-outline" title={t('No on-site gigs nearby')} message={t("Remote gigs aren't shown here — find them in Discover.")} />}
          renderItem={({ item }) => (
            <GigRow gig={item} onPress={() => navigation.navigate('GigDetail', { gigId: item.id })} />
          )}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <LeafletMap
            pins={mapPins}
            me={me}
            selectedId={selected?.id}
            onPinPress={id => setSelected(pins.find(g => g.id === id) ?? null)}
            onMapPress={() => setSelected(null)}
            onError={() => setMapFailed(true)}
          />

          {!hasUserLocation && (
            <View style={s.hint} pointerEvents="box-none">
              <Banner icon="locate-outline" text={t('Set your location in Profile to centre the map on you.')} color={colors.blue} />
            </View>
          )}

          {selected && (
            <View style={s.sheet}>
              <GigRow gig={selected} flat />
              <View style={s.sheetBtns}>
                {selected.latitude != null && (
                  <Button title={t('Directions')} icon="navigate-outline" variant="outline" size="md" style={{ flex: 1 }}
                    onPress={() => openDirections(selected.latitude!, selected.longitude!)} />
                )}
                <Button title={t('View & apply')} iconRight="arrow-forward" size="md" style={{ flex: 1 }}
                  onPress={() => navigation.navigate('GigDetail', { gigId: selected.id })} />
              </View>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function GigRow({ gig, onPress, flat }: { gig: Gig; onPress?: () => void; flat?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.row, !flat && s.rowCard]}>
      <Avatar name={gig.businessName} color={gig.businessColor} photo={gig.businessPhotoUrl} size={46} square />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{gig.title}</Text>
        <Text style={s.rowBiz} numberOfLines={1}>{gig.businessName} · {payText(gig)}</Text>
        <Text style={s.rowMeta} numberOfLines={1}>{gig.location}</Text>
      </View>
      {gig.distanceMiles != null ? <Text style={s.dist}>{distanceLabel(gig.distanceMiles)}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  hint: { position: 'absolute', top: 12, left: 12, right: 12 },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 16, backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, ...shadow.raised },
  sheetBtns: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.borderMid },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.dark },
  rowBiz: { fontSize: 13, color: colors.body, marginTop: 2 },
  rowMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  dist: { fontSize: 13, fontWeight: '800', color: colors.accent },
});
