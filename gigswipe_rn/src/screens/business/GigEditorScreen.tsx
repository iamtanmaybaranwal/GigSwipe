// Edit an existing gig, or repost one (a copy with fresh dates).
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type Gig } from '../../api';
import { useCurrentUser } from '../../context/AuthContext';
import { t } from '../../i18n';
import { colors } from '../../theme';
import { ErrorView, Header, Loading } from '../../components/ui';
import { GigForm, gigToForm } from '../../components/GigForm';
import { toast } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';

export default function GigEditorScreen({ route, navigation }: RootScreen<'GigEditor'>) {
  const { gigId, mode } = route.params;
  const user = useCurrentUser();
  const [gig, setGig] = useState<Gig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.gigs.get(gigId).then(r => setGig(r.gig)).catch(e => setError(errorMessage(e)));
  }, [gigId]);
  useEffect(load, [load]);

  const title = mode === 'edit' ? t('Edit gig') : t('Repost gig');

  if (error) return <SafeAreaView style={s.safe}><Header title={title} /><ErrorView message={error} onRetry={load} /></SafeAreaView>;
  if (!gig) return <SafeAreaView style={s.safe}><Header title={title} /><Loading /></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title={title} subtitle={mode === 'duplicate' ? t('A new copy of "{title}"', { title: gig.title }) : undefined} />
      <GigForm
        initial={gigToForm(gig, mode === 'duplicate')}
        user={user}
        minHiredCount={mode === 'edit' ? gig.hiredCount : 0}
        submitLabel={mode === 'edit' ? t('Save changes') : t('Post gig')}
        submitIcon={mode === 'edit' ? 'checkmark' : 'rocket-outline'}
        onSubmit={async body => {
          if (mode === 'edit') {
            await api.gigs.update(gig.id, body);
            toast(t('Gig updated'));
          } else {
            await api.gigs.create(body);
            toast(t('Gig posted! Job seekers can apply now.'));
          }
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.white } });
