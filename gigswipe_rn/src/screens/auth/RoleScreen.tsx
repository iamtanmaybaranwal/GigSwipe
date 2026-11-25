import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, shadow, tint } from '../../theme';
import { Button, IconButton } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import type { RootScreen } from '../../navigation/types';
import { t } from '../../i18n';

export default function RoleScreen({ navigation }: RootScreen<'Role'>) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <IconButton name="arrow-back" label={t('Go back')} onPress={() => navigation.goBack()} style={{ marginLeft: -8 }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={font.h1}>{t('How will you use GigSwipe?')}</Text>
        <Text style={[font.body, { color: colors.muted, marginTop: 6, marginBottom: 24 }]}>
          {t('You can always create a second account for the other role.')}
        </Text>

        <RoleCard
          icon="person-outline"
          title={t("I'm looking for work")}
          tag={t('Job Seeker')}
          text={t('Students, part-timers, freelancers, parents, retirees, or anyone between jobs. Swipe local and remote gigs and chat with employers.')}
          color={colors.accent}
          onPress={() => navigation.navigate('Register', { role: 'worker' })}
        />
        <RoleCard
          icon="storefront-outline"
          title={t('I need to hire')}
          tag={t('Job Giver')}
          text={t('Businesses, event organisers, startups, households and individuals. Post a gig in a minute and hire people nearby.')}
          color={colors.navy}
          onPress={() => navigation.navigate('Register', { role: 'business' })}
        />

        <Button title={t('Already have an account? Sign in')} variant="ghost" onPress={() => navigation.navigate('Login')} style={{ marginTop: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function RoleCard({ icon, title, tag, text, color, onPress }: {
  icon: IconName; title: string; tag: string; text: string; color: string; onPress: () => void;
}) {
  return (
    <View style={[s.card, { borderColor: tint(color, 0.2) }]}>
      <View style={s.cardTop}>
        <View style={[s.cardIcon, { backgroundColor: tint(color, 0.1) }]}><Icon name={icon} size={26} color={color} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[s.tag, { color }]}>{tag}</Text>
          <Text style={s.cardTitle}>{title}</Text>
        </View>
      </View>
      <Text style={s.cardText}>{text}</Text>
      <Button title={t('Sign up as {role}', { role: tag })} color={color} size="md" iconRight="arrow-forward" onPress={onPress} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 24 },
  card: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 20, borderWidth: 1.5, gap: 14, marginBottom: 16, ...shadow.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tag: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  cardTitle: { fontSize: 19, fontWeight: '800', color: colors.dark, marginTop: 2 },
  cardText: { fontSize: 14, color: colors.muted, lineHeight: 20 },
});
