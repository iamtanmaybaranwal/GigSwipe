// App-wide safety nets: an error boundary and an offline banner.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, spacing } from '../theme';
import { Button } from './ui';
import { Icon } from './Icon';
import { t } from '../i18n';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Hook a crash reporter (Sentry, Crashlytics) in here for production.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={s.crash}>
        <Icon name="alert-circle-outline" size={56} color={colors.accent} />
        <Text style={[font.h2, { marginTop: spacing.lg, textAlign: 'center' }]}>{t('Something went wrong')}</Text>
        <Text style={[font.small, { textAlign: 'center', marginTop: 8 }]}>
          The app hit an unexpected problem. Your data is safe.
        </Text>
        {__DEV__ ? <Text style={s.dev} numberOfLines={6}>{String(this.state.error?.message)}</Text> : null}
        <Button title={t('Try again')} onPress={() => this.setState({ error: null })} style={{ marginTop: spacing.xxl, alignSelf: 'stretch' }} />
      </View>
    );
  }
}

export function OfflineBanner() {
  const net = useNetInfo();
  const insets = useSafeAreaInsets();
  // isInternetReachable is null while unknown — only warn when we're sure
  const offline = net.isConnected === false || net.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View style={[s.offline, { paddingTop: insets.top + 6 }]} pointerEvents="none">
      <Icon name="cloud-offline-outline" size={15} color={colors.white} />
      <Text style={s.offlineText}>{t("You're offline. Changes will fail until you reconnect.")}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  crash: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl, backgroundColor: colors.white },
  dev: { marginTop: spacing.lg, fontSize: 12, color: colors.red, fontFamily: 'monospace' },
  offline: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, backgroundColor: colors.dark, paddingBottom: 6 },
  offlineText: { color: colors.white, fontSize: 12, fontWeight: '600' },
});
