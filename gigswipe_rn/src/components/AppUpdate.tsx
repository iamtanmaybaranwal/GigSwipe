// Full-screen "Update required" page and the small "update available" bar.
import React, { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { colors, font, radius, shadow, spacing } from '../theme';
import {
  APP_VERSION, checkForUpdate, dismissUpdateBanner, useUpdateState,
} from '../services/appUpdate';
import { Button } from './ui';
import { onSocketEvent } from '../services/socket';
import { Icon } from './Icon';

const openStore = (url?: string) => { if (url) Linking.openURL(url).catch(() => {}); };

/** Checks on launch, on returning to the app, on reconnecting to the server, and every 15 minutes. */
export function useUpdateCheck() {
  useEffect(() => {
    checkForUpdate();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') checkForUpdate(); });
    // Changing the version rules on the server restarts it; the live connection
    // then reconnects and we check again, so a forced update applies within seconds.
    const off = onSocketEvent<boolean>('connection_change', up => { if (up) checkForUpdate(); });
    const timer = setInterval(checkForUpdate, 15 * 60 * 1000);
    return () => { sub.remove(); off(); clearInterval(timer); };
  }, []);
}

export function ForceUpdateScreen() {
  const u = useUpdateState();
  const [checking, setChecking] = useState(false);
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.body}>
        <View style={s.logo}><Text style={s.logoG}>G</Text></View>
        <View style={s.badge}><Icon name="arrow-up-circle" size={18} color={colors.accent} /><Text style={s.badgeText}>{t('Update required')}</Text></View>
        <Text style={s.title}>{t('A new version of GigSwipe is ready')}</Text>
        <Text style={s.text}>
          {u.message || t('This version is no longer supported. Please install the latest version to keep using GigSwipe. Your account and chats are safe.')}
        </Text>
        <Text style={s.version}>
          {t('Your version: {current}', { current: APP_VERSION })}{u.latest ? ` · ${t('Latest: {latest}', { latest: u.latest })}` : ''}
        </Text>
      </View>
      <View style={s.foot}>
        <Button title={t('Update now')} icon="download-outline" onPress={() => openStore(u.url)} disabled={!u.url} />
        <Button title={t('I have updated, check again')} variant="ghost" loading={checking}
          onPress={async () => { setChecking(true); await checkForUpdate(); setChecking(false); }} />
      </View>
    </SafeAreaView>
  );
}

/** Dismissible bar for optional updates. */
export function UpdateAvailableBar() {
  const u = useUpdateState();
  const insets = useSafeAreaInsets();
  if (u.required || !u.available || u.dismissed || !u.url) return null;
  return (
    <View style={[s.bar, { top: insets.top + 6 }]} pointerEvents="box-none">
      <Pressable style={s.barInner} onPress={() => openStore(u.url)} accessibilityRole="button">
        <Icon name="sparkles" size={18} color={colors.white} />
        <Text style={s.barText} numberOfLines={2}>{t('A new version ({latest}) is available. Tap to update.', { latest: u.latest ?? '' })}</Text>
        <Pressable hitSlop={10} onPress={dismissUpdateBanner} accessibilityLabel={t('Close')}>
          <Icon name="close" size={18} color={colors.white} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 28 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 88, height: 88, borderRadius: radius.xxl, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  logoG: { fontSize: 48, fontWeight: '900', color: colors.white },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28, backgroundColor: colors.accentLight,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { fontSize: 13, fontWeight: '800', color: colors.accent },
  title: { ...font.h2, textAlign: 'center', marginTop: spacing.lg },
  text: { ...font.body, color: colors.muted, textAlign: 'center', marginTop: spacing.md },
  version: { fontSize: 12, color: colors.subtle, marginTop: spacing.lg },
  foot: { gap: 4, paddingBottom: spacing.lg },
  bar: { position: 'absolute', left: 12, right: 12 },
  barInner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.navy, borderRadius: radius.lg,
    paddingHorizontal: 14, paddingVertical: 12, ...shadow.raised },
  barText: { flex: 1, color: colors.white, fontSize: 13, fontWeight: '600' },
});
