import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../../theme';
import { Button } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import type { RootScreen } from '../../navigation/types';
import { LANGUAGES, setLanguage, t, useLanguage } from '../../i18n';

const PERKS: { icon: IconName; title: string; text: string }[] = [
  // English keys; translated when rendered so a language switch updates them
  { icon: 'flash-outline', title: 'Apply in one swipe', text: 'No CVs or long forms. Swipe right and you’ve applied.' },
  { icon: 'location-outline', title: 'Work near you', text: 'Gigs ranked by distance, inside the range you choose.' },
  { icon: 'shield-checkmark-outline', title: 'Verified hiring', text: 'Hire codes and two-way ratings keep everyone honest.' },
];

export default function WelcomeScreen({ navigation }: RootScreen<'Welcome'>) {
  const lang = useLanguage();
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.lang}>
        {LANGUAGES.map(l => (
          <Pressable key={l.code} onPress={() => setLanguage(l.code)} style={[s.langBtn, lang === l.code && s.langOn]}
            accessibilityRole="button" accessibilityState={{ selected: lang === l.code }}>
            <Text style={[s.langText, lang === l.code && { color: colors.white }]}>{l.native}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.hero}>
        <View style={s.logo}><Text style={s.logoG}>G</Text></View>
        <Text style={s.title}>GigSwipe</Text>
        <Text style={s.tagline}>{t('Local gigs.')}{'\n'}{t('One swipe away.')}</Text>
      </View>

      <View style={s.perks}>
        {PERKS.map(p => (
          <View key={p.title} style={s.perk}>
            <View style={s.perkIcon}><Icon name={p.icon} size={20} color={colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.perkTitle}>{t(p.title)}</Text>
              <Text style={s.perkText}>{t(p.text)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.footer}>
        <Button title={t('Get started')} iconRight="arrow-forward" onPress={() => navigation.navigate('Role')} />
        <Button title={t('I already have an account')} variant="ghost" onPress={() => navigation.navigate('Login')} />
        <Text style={s.fine}>{t('For job seekers and anyone who needs a hand · Free to start')}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 28, justifyContent: 'space-between' },
  lang: { flexDirection: 'row', alignSelf: 'flex-end', gap: 6, marginTop: 8 },
  langBtn: { paddingHorizontal: 12, height: 32, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderMid },
  langOn: { backgroundColor: colors.dark, borderColor: colors.dark },
  langText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  hero: { alignItems: 'center', gap: 14, marginTop: 16 },
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
