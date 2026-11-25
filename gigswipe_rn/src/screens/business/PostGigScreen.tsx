import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import { useCurrentUser } from '../../context/AuthContext';
import { t } from '../../i18n';
import { colors, font } from '../../theme';
import { EMPTY_GIG, GigForm } from '../../components/GigForm';
import { toast } from '../../utils/format';
import type { BusinessTabScreen } from '../../navigation/types';

export default function PostGigScreen({ navigation }: BusinessTabScreen<'PostGig'>) {
  const user = useCurrentUser();
  const [formKey, setFormKey] = useState(0); // bump to reset the form after posting

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={font.h1}>{t('Post a gig')}</Text>
        <Text style={font.small}>{t('Clear details get better applicants, faster.')}</Text>
      </View>
      <GigForm
        key={formKey}
        initial={EMPTY_GIG}
        user={user}
        submitLabel={t('Post gig')}
        submitIcon="rocket-outline"
        onOpenProfile={() => navigation.navigate('BusinessProfile')}
        onSubmit={async body => {
          await api.gigs.create(body);
          toast(t('Gig posted! Job seekers can apply now.'));
          setFormKey(k => k + 1);
          navigation.navigate('Dashboard');
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
});
