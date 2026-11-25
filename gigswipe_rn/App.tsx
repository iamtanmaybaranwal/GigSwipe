/**
 * GigSwipe — local gigs, one swipe away.
 * App root: providers, navigation container and app-wide safety nets.
 */
import React, { useRef } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, type NavigationState, type Theme } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { ErrorBoundary, OfflineBanner } from './src/components/AppChrome';
import { ForceUpdateScreen, UpdateAvailableBar, useUpdateCheck } from './src/components/AppUpdate';
import { useUpdateState } from './src/services/appUpdate';
import { navigationRef } from './src/navigation/ref';
import { GigLinkOpener } from './src/components/GigLinkOpener';
import { colors } from './src/theme';
import { useLanguage } from './src/i18n';

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.surface,
    card: colors.white,
    text: colors.dark,
    border: colors.borderMid,
    notification: colors.accent,
  },
};

export default function App() {
  // Changing the language remounts the screens so every label re-renders in the
  // new language; the navigation state is kept so the user stays where they were.
  const lang = useLanguage();
  const navState = useRef<NavigationState | undefined>(undefined);
  useUpdateCheck();
  const update = useUpdateState();
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <ErrorBoundary>
        {update.required ? (
          // Too old to use: nothing else is reachable until the app is updated
          <ForceUpdateScreen />
        ) : (
          <AuthProvider>
            <View style={{ flex: 1 }}>
              <NavigationContainer key={lang} ref={navigationRef} theme={navTheme} initialState={navState.current}
                onStateChange={st => { navState.current = st; }}>
                <RootNavigator />
                <GigLinkOpener />
              </NavigationContainer>
              <OfflineBanner />
              <UpdateAvailableBar />
            </View>
          </AuthProvider>
        )}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
