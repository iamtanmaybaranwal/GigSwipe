import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { api, type Gig } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useFocusData } from '../../hooks';
import { MAPS_ENABLED } from '../../config';
import { colors, radius, shadow, spacing } from '../../theme';
import { Avatar, Banner, Button, EmptyState, ErrorView, Header, IconButton, Loading } from '../../components/ui';
import { distanceLabel, openDirections } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';

export default function GigsMapScreen({ navigation }: RootScreen<'GigsMap'>) {
  const { user } = useAuth();
  const { data, loading, error, retry } = useFocusData(async () => (await api.gigs.feed()).gigs);
  const [selected, setSelected] = useState<Gig | null>(null);
  const [listMode, setListMode] = useState(!MAPS_ENABLED);

  const pins = useMemo(() => (data ?? []).filter(g => g.latitude != null && g.longitude != null), [data]);
  const hasUserLocation = user?.latitude != null && user?.longitude != null;

  const region = useMemo(() => {
    const lat = hasUserLocation ? user!.latitude! : pins[0]?.latitude ?? 39.5;
    const lng = hasUserLocation ? user!.longitude! : pins[0]?.longitude ?? -98.35;
    const zoomedOut = !hasUserLocation && !pins.length;
    return { latitude: lat, longitude: lng, latitudeDelta: zoomedOut ? 40 : 0.15, longitudeDelta: zoomedOut ? 40 : 0.15 };
  }, [hasUserLocation, user, pins]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header
        title="Nearby gigs"
        subtitle={data ? `${pins.length} on the map` : undefined}
        right={MAPS_ENABLED ? (
          <IconButton name={listMode ? 'map-outline' : 'list-outline'} label={listMode ? 'Show map' : 'Show list'}
            onPress={() => setListMode(m => !m)} color={colors.accent} />
        ) : undefined}
      />

      {loading ? <Loading /> : error ? <ErrorView message={error} onRetry={retry} /> : listMode ? (
        <FlatList
          data={pins}
          keyExtractor={g => g.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          ListHeaderComponent={!MAPS_ENABLED ? (
            <Banner icon="information-circle-outline" color={colors.muted}
              text="Map view needs a Google Maps key (MAPS_API_KEY in .env). Showing a list instead." />
          ) : undefined}
          ListEmptyComponent={<EmptyState icon="map-outline" title="No on-site gigs nearby" message="Remote gigs aren't shown here — find them in Discover." />}
          renderItem={({ item }) => (
            <GigRow gig={item} onPress={() => navigation.navigate('GigDetail', { gigId: item.id })} />
          )}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={region}
            showsUserLocation={hasUserLocation}
            showsMyLocationButton={hasUserLocation}
            toolbarEnabled={false}
            onPress={() => setSelected(null)}
          >
            {pins.map(g => (
              <Marker
                key={g.id}
                coordinate={{ latitude: g.latitude!, longitude: g.longitude! }}
                pinColor={g.businessColor}
                title={g.title}
                onPress={e => { e.stopPropagation(); setSelected(g); }}
              />
            ))}
          </MapView>

          {!hasUserLocation && (
            <View style={s.hint}>
              <Banner icon="locate-outline" text="Set your location in Profile to centre the map on you." color={colors.blue} />
            </View>
          )}

          {selected && (
            <View style={s.sheet}>
              <GigRow gig={selected} flat />
              <View style={s.sheetBtns}>
                {selected.latitude != null && (
                  <Button title="Directions" icon="navigate-outline" variant="outline" size="md" style={{ flex: 1 }}
                    onPress={() => openDirections(selected.latitude!, selected.longitude!)} />
                )}
                <Button title="View & apply" iconRight="arrow-forward" size="md" style={{ flex: 1 }}
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
      <Avatar name={gig.businessName} color={gig.businessColor} size={46} square />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{gig.title}</Text>
        <Text style={s.rowBiz} numberOfLines={1}>{gig.businessName} · {gig.pay}</Text>
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
