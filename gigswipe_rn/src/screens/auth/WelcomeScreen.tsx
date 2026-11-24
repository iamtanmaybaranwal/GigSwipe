import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../../theme';
import { Button } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import type { RootScreen } from '../../navigation/types';

const PERKS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'flash-outline', title: 'Apply in one swipe', text: 'No CVs or long forms. Swipe right and you’ve applied.' },
  { icon: 'location-outline', title: 'Work near you', text: 'Gigs ranked by distance, inside the range you choose.' },
  { icon: 'shield-checkmark-outline', title: 'Verified hiring', text: 'Hire codes and two-way ratings keep everyone honest.' },
];

export default function WelcomeScreen({ navigation }: RootScreen<'Welcome'>) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.hero}>
        <View style={s.logo}><Text style={s.logoG}>G</Text></View>
        <Text style={s.title}>GigSwipe</Text>
        <Text style={s.tagline}>Local gigs.{'\n'}One swipe away.</Text>
      </View>

      <View style={s.perks}>
        {PERKS.map(p => (
          <View key={p.title} style={s.perk}>
            <View style={s.perkIcon}><Icon name={p.icon} size={20} color={colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.perkTitle}>{p.title}</Text>
              <Text style={s.perkText}>{p.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.footer}>
        <Button title="Get started" iconRight="arrow-forward" onPress={() => navigation.navigate('Role')} />
        <Button title="I already have an account" variant="ghost" onPress={() => navigation.navigate('Login')} />
        <Text style={s.fine}>For job seekers and anyone who needs a hand · Free to start</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 28, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: 14, marginTop: 48 },
  logo: { width: 88, height: 88, borderRadius: radius.xxl, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  logoG: { fontSize: 48, fontWeight: '900', color: colors.white },
  title: { fontSize: 40, fontWeight: '800', color: colors.dark, letterSpacing: -1 },
  tagline: { fontSize: 20, color: colors.muted, textAlign: 'center', lineHeight: 28 },
  perks: { gap: 18 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  perkIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontSize: 15, fontWeight: '700', color: colors.dark },
  perkText: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  footer: { gap: 6, marginBottom: 16 },
  fine: { fontSize: 12, color: colors.subtle, textAlign: 'center', marginTop: 4 },
});
