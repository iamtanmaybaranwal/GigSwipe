import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import { useFocusData, useSocketEvent } from '../../hooks';
import { colors, font } from '../../theme';
import { EmptyState, ErrorView, Loading } from '../../components/ui';
import { ConversationRow } from '../../components/ConversationRow';
import { plural } from '../../utils/format';
import { t } from '../../i18n';
import type { BusinessTabScreen } from '../../navigation/types';

const Separator = () => <View style={s.sep} />;

export default function MessagesScreen({ navigation }: BusinessTabScreen<'Messages'>) {
  const { data, loading, error, refreshing, refresh, reload, retry } =
    useFocusData(async () => (await api.applications.inbox()).conversations);
  useSocketEvent('inbox_update', reload);
  useSocketEvent('application_update', reload);

  const list = data ?? [];
  const unread = list.reduce((n, c) => n + c.unreadCount, 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={font.h1}>{t('Messages')}</Text>
        <Text style={font.small}>{list.length ? `${plural(list.length, 'conversation')}${unread ? ` · ${t('{n} unread', { n: unread })}` : ''}` : t('Chats with your applicants')}</Text>
      </View>
      {loading ? <Loading /> : error && !data ? <ErrorView message={error} onRetry={retry} /> : (
        <FlatList
          data={list}
          keyExtractor={c => c.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
          contentContainerStyle={{ flexGrow: 1 }}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title={t('No conversations yet')}
            message={t('When someone applies to one of your gigs, a chat with them appears here.')} />}
          renderItem={({ item }) => (
            <ConversationRow
              name={item.otherUser?.name ?? t('Job seeker')}
              color={item.otherUser?.avatarColor}
              photo={item.otherUser?.photoUrl}
              online={item.otherUser?.availableNow}
              title={item.gigTitle}
              lastMessage={item.lastMessage}
              time={item.lastMessageTime}
              unread={item.unreadCount}
              status={item.status}
              onPress={() => navigation.navigate('Chat', { applicationId: item.id })}
              onAvatarPress={() => navigation.navigate('UserProfile', { userId: item.workerId })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: 84 },
});
