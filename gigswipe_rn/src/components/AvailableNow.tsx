// "Available now": one tap tells nearby job givers you can start today.
// It switches itself off at midnight (or after 48 h at most, enforced by the server).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { api, errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import { colors, radius, tint } from '../theme';
import { formatTime, toast } from '../utils/format';
import { ToggleRow } from './ui';

/** End of today, or 6 hours from now if it's already late evening. */
function untilTonight() {
  const now = new Date();
  const midnight = new Date(now); midnight.setHours(23, 59, 0, 0);
  return midnight.getTime() - now.getTime() < 3 * 3600000 ? new Date(now.getTime() + 6 * 3600000) : midnight;
}

export function useAvailableNow() {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const on = !!user?.availableUntil && new Date(user.availableUntil) > new Date();
  const set = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const { user: updated } = await api.auth.updateProfile({ availableUntil: next ? untilTonight().toISOString() : null });
      setUser(updated);
      toast(next ? t('You are available now. Job givers nearby can see it.') : t('Available now is off'));
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { on, busy, set, until: user?.availableUntil };
}

/** Compact pill for the feed header. */
export function AvailableNowPill() {
  const { on, busy, set } = useAvailableNow();
  return (
    <Pressable onPress={() => set(!on)} disabled={busy} accessibilityRole="switch" accessibilityState={{ checked: on }}
      accessibilityLabel={t('Available now')}
      style={[s.pill, on ? { backgroundColor: tint(colors.green, 0.12), borderColor: colors.green } : null, busy && { opacity: 0.6 }]}>
      <Text style={[s.dot, { color: on ? colors.green : colors.subtle }]}>●</Text>
      <Text style={[s.text, on && { color: colors.green }]}>{on ? t('Available') : t('Available now?')}</Text>
    </Pressable>
  );
}

/** Full toggle row for the profile screen. */
export function AvailableNowRow() {
  const { on, busy, set, until } = useAvailableNow();
  return (
    <ToggleRow icon="flash-outline" color={colors.green} title={t('Available now')} value={on} disabled={busy} onChange={set}
      subtitle={on && until ? t('On until {time}. Job givers nearby see you first.', { time: formatTime(until) })
        : t('Turn on when you can start today. It switches off at midnight.')} />
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 11, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.borderMid, backgroundColor: colors.white },
  dot: { fontSize: 10 },
  text: { fontSize: 12, fontWeight: '800', color: colors.muted },
});
