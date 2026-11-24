import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { DEFAULT_RADIUS, RADIUS_OPTIONS } from '../config';
import { describeLocation, getCurrentCoords, LocationError, requestLocationPermission } from '../services/location';
import { Icon } from './Icon';
import { TextField } from './ui';

export interface LocationValue {
  locationLabel?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusMiles?: number | null;
}

/** Ask for location permission, read GPS and pick a travel/hiring radius. */
export function LocationRangePicker({ value, onChange, helperText, rangeLabel = 'Comfortable range' }: {
  value: LocationValue; onChange: (v: LocationValue) => void; helperText?: string; rangeLabel?: string;
}) {
  const [locating, setLocating] = useState(false);
  const hasLocation = value.latitude != null && value.longitude != null;

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await requestLocationPermission();
      if (perm !== 'granted') {
        Alert.alert(
          'Location permission needed',
          perm === 'blocked'
            ? 'Location access is turned off for GigSwipe. Open Settings → Permissions → Location and choose "Allow while using the app".'
            : 'GigSwipe uses your location only to match you with nearby gigs and job seekers.',
          perm === 'blocked'
            ? [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
            : [{ text: 'OK' }]
        );
        return;
      }
      const { latitude, longitude } = await getCurrentCoords();
      const label = await describeLocation(latitude, longitude);
      onChange({ ...value, latitude, longitude, locationLabel: label, radiusMiles: value.radiusMiles ?? DEFAULT_RADIUS });
    } catch (e) {
      Alert.alert('Could not get your location', e instanceof LocationError ? e.message : 'Please try again.');
    } finally {
      setLocating(false);
    }
  };

  if (!hasLocation) {
    return (
      <View>
        <Pressable style={s.enable} onPress={locate} disabled={locating} accessibilityRole="button">
          {locating ? <ActivityIndicator color={colors.accent} /> : <Icon name="locate-outline" size={18} color={colors.accent} />}
          <Text style={s.enableText}>{locating ? 'Finding you…' : 'Use my current location'}</Text>
        </Pressable>
        <Text style={s.helper}>One-time setup. After this, GigSwipe keeps it up to date while you use the app.</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={s.current}>
        <Icon name="location" size={16} color={colors.green} />
        <Text style={s.currentText} numberOfLines={1}>Location set</Text>
        <Pressable onPress={locate} disabled={locating} hitSlop={8}>
          {locating ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={s.link}>Update</Text>}
        </Pressable>
      </View>
      <TextField
        label="Area name (shown to others)"
        icon="map-outline"
        value={value.locationLabel ?? ''}
        onChangeText={t => onChange({ ...value, locationLabel: t })}
        placeholder="e.g. Downtown Seattle, WA"
        maxLength={120}
      />
      <Text style={s.rangeLabel}>{rangeLabel}</Text>
      <View style={s.chips}>
        {RADIUS_OPTIONS.map(mi => {
          const on = value.radiusMiles === mi;
          return (
            <Pressable key={mi} onPress={() => onChange({ ...value, radiusMiles: mi })}
              style={[s.chip, on && s.chipOn]} accessibilityState={{ selected: on }}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{mi} mi</Text>
            </Pressable>
          );
        })}
      </View>
      {helperText ? <Text style={s.helper}>{helperText}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  enable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.accent, borderStyle: 'dashed', backgroundColor: colors.accentLight },
  enableText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  current: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.greenLight,
    padding: 12, borderRadius: radius.md, marginBottom: spacing.md },
  currentText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.dark },
  link: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  rangeLabel: { fontSize: 13, fontWeight: '600', color: colors.body, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.surfaceAlt },
  chipOn: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextOn: { color: colors.accent },
  helper: { fontSize: 12, color: colors.subtle, marginTop: 8, lineHeight: 17 },
});
