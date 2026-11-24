import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type ApplicationWithMeta } from '../../api';
import { useFocusData, useSocketEvent } from '../../hooks';
import { colors, font, radius, spacing } from '../../theme';
import { EmptyState, ErrorView, Loading } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ConversationRow } from '../../components/ConversationRow';
import { plural } from '../../utils/format';
import type { WorkerTabScreen } from '../../navigation/types';

const Separator = () => <View style={s.sep} />;

export default function MatchesScreen({ navigation }: WorkerTabScreen<'Matches'>) {
  const { data, loading, error, refreshing, refresh, reload, retry } =
    useFocusData(async () => (await api.applications.mine()).applications);

  useSocketEvent('inbox_update', reload);
  useSocketEvent('application_update', reload);

  const apps = data ?? [];
  const withCodes = apps.filter(a => a.status === 'accepted' && a.hireCode);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={font.h1}>Matches</Text>
        <Text style={font.small}>{apps.length ? plural(apps.length, 'conversation') : 'Your applications and chats'}</Text>
      </View>

      {loading ? <Loading /> : error && !data ? <ErrorView message={error} onRetry={retry} /> : (
        <FlatList
          data={apps}
          keyExtractor={a => a.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={withCodes.length ? (
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              {withCodes.map(a => <HireCodeCard key={a.id} app={a} />)}
            </View>
          ) : undefined}
          ListEmptyComponent={
            <EmptyState icon="chatbubbles-outline" title="No matches yet"
              message="Swipe right on a gig to apply. A chat with the job giver opens straight away."
              action="Browse gigs" onAction={() => navigation.navigate('Discover')} />
          }
          renderItem={({ item }) => (
            <ConversationRow
              name={item.businessName}
              color={item.businessColor}
              title={item.gigTitle}
              lastMessage={item.lastMessage}
              time={item.lastMessageTime}
              unread={item.unreadCount}
              status={item.status}
              onPress={() => navigation.navigate('Chat', { applicationId: item.id })}
              onAvatarPress={() => navigation.navigate('UserProfile', { userId: item.businessId })}
              right={item.status === 'accepted' && item.hireCode ? <Icon name="key" size={16} color={colors.green} /> : null}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function HireCodeCard({ app }: { app: ApplicationWithMeta }) {
  return (
    <View style={s.code}>
      <View style={s.codeIcon}><Icon name="key-outline" size={20} color={colors.green} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.codeLabel}>You were accepted for {app.gigTitle}</Text>
        <Text style={s.codeHint}>Show this code to {app.businessName} when you meet</Text>
      </View>
      <Text style={s.codeNum} accessibilityLabel={`Hire code ${app.hireCode?.split('').join(' ')}`}>{app.hireCode}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: 84 },
  code: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.greenLight, borderRadius: radius.lg,
    padding: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  codeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  codeLabel: { fontSize: 14, fontWeight: '700', color: colors.dark },
  codeHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  codeNum: { fontSize: 30, fontWeight: '900', color: colors.green, letterSpacing: 4 },
});
