import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type Conversation, type InviteWithGig } from '../../api';
import { useFocusData, useSocketEvent } from '../../hooks';
import { t } from '../../i18n';
import { colors, font, radius, spacing } from '../../theme';
import { Avatar, Button, EmptyState, ErrorView, Loading, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ConversationRow } from '../../components/ConversationRow';
import { formatSchedule, openDirections, payText, plural, startsIn, toast } from '../../utils/format';
import type { WorkerTabScreen } from '../../navigation/types';

const Separator = () => <View style={s.sep} />;
const DAY = 86400000;

export default function MatchesScreen({ navigation }: WorkerTabScreen<'Matches'>) {
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const { data, setData, loading, error, refreshing, refresh, reload, retry } = useFocusData(async () => {
    const [{ applications }, { invites }] = await Promise.all([api.applications.mine(), api.invites.mine()]);
    return { apps: applications, invites };
  });

  useSocketEvent('inbox_update', reload);
  useSocketEvent('application_update', reload);
  useSocketEvent('invite_update', reload);

  const apps = data?.apps ?? [];
  const invites = data?.invites ?? [];
  const withCodes = apps.filter(a => a.status === 'accepted' && a.hireCode);
  const now = Date.now();
  const upcoming = apps
    .filter(a => (a.status === 'accepted' || a.status === 'hired') && a.gigStartAt &&
      new Date(a.gigEndAt ?? a.gigStartAt).getTime() > now && new Date(a.gigStartAt).getTime() - now < 7 * DAY)
    .sort((a, b) => new Date(a.gigStartAt!).getTime() - new Date(b.gigStartAt!).getTime());

  const accept = async (inv: InviteWithGig) => {
    setBusyInvite(inv.id);
    try {
      const { application } = await api.invites.accept(inv.id);
      setData(d => d ? { ...d, invites: d.invites.filter(i => i.id !== inv.id) } : d);
      toast(t('Applied! Say hello to the job giver.'));
      navigation.navigate('Chat', { applicationId: application.id });
    } catch (e) { Alert.alert(t('Something went wrong'), errorMessage(e)); reload(); }
    finally { setBusyInvite(null); }
  };
  const decline = (inv: InviteWithGig) => Alert.alert(t('Decline this invite?'), t('{business} won’t be able to invite you to this gig again.', { business: inv.gig.businessName }), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('Decline'), style: 'destructive', onPress: async () => {
      setData(d => d ? { ...d, invites: d.invites.filter(i => i.id !== inv.id) } : d);
      try { await api.invites.decline(inv.id); } catch (e) { toast(errorMessage(e)); reload(); }
    } },
  ]);

  const header = (invites.length || upcoming.length || withCodes.length) ? (
    <View style={{ padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md }}>
      {invites.length ? (
        <>
          <SectionTitle icon="mail-unread-outline" title={t('Invites for you')} style={{ marginTop: 0, marginBottom: 0 }} />
          {invites.map(inv => (
            <InviteCard key={inv.id} inv={inv} busy={busyInvite === inv.id} onAccept={() => accept(inv)} onDecline={() => decline(inv)}
              onOpen={() => navigation.navigate('GigDetail', { gigId: inv.gigId })} />
          ))}
        </>
      ) : null}
      {upcoming.length ? (
        <>
          <SectionTitle icon="calendar-outline" title={t('Upcoming')} style={{ marginTop: invites.length ? spacing.md : 0, marginBottom: 0 }} />
          {upcoming.map(a => <UpcomingCard key={a.id} app={a} onOpen={() => navigation.navigate('Chat', { applicationId: a.id })} />)}
        </>
      ) : null}
      {withCodes.map(a => <HireCodeCard key={a.id} app={a} />)}
      {apps.length ? <SectionTitle icon="chatbubbles-outline" title={t('Chats')} style={{ marginBottom: 0 }} /> : null}
    </View>
  ) : undefined;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={font.h1}>{t('Matches')}</Text>
        <Text style={font.small}>{apps.length ? plural(apps.length, 'conversation') : t('Your applications and chats')}</Text>
      </View>

      {loading ? <Loading /> : error && !data ? <ErrorView message={error} onRetry={retry} /> : (
        <FlatList
          data={apps}
          keyExtractor={a => a.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={header}
          ListEmptyComponent={invites.length ? undefined : (
            <EmptyState icon="chatbubbles-outline" title={t('No matches yet')}
              message={t('Swipe right on a gig to apply. A chat with the job giver opens straight away.')}
              action={t('Browse gigs')} onAction={() => navigation.navigate('Discover')} />
          )}
          renderItem={({ item }) => (
            <ConversationRow
              name={item.businessName}
              color={item.businessColor}
              photo={item.otherUser?.photoUrl}
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

function InviteCard({ inv, busy, onAccept, onDecline, onOpen }: {
  inv: InviteWithGig; busy: boolean; onAccept: () => void; onDecline: () => void; onOpen: () => void;
}) {
  const g = inv.gig;
  return (
    <View style={s.invite}>
      <View style={s.inviteTop}>
        <Avatar name={g.businessName} color={g.businessColor} photo={inv.business?.photoUrl ?? g.businessPhotoUrl} size={44} square />
        <View style={{ flex: 1 }}>
          <Text style={s.inviteFrom} numberOfLines={1}>{t('{business} invited you', { business: g.businessName })}</Text>
          <Text style={s.inviteTitle} onPress={onOpen} numberOfLines={2}>{g.title}</Text>
          <Text style={s.inviteMeta} numberOfLines={1}>
            {[payText(g), g.startAt ? formatSchedule(g.startAt, g.endAt) : null, g.workMode === 'remote' ? t('Remote') : g.location].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      {inv.message ? <Text style={s.inviteMsg}>“{inv.message}”</Text> : null}
      <View style={s.inviteBtns}>
        <Button title={t('Details')} size="sm" variant="outline" onPress={onOpen} disabled={busy} />
        <View style={{ flex: 1 }} />
        <Button title={t('Decline')} size="sm" variant="danger" onPress={onDecline} disabled={busy} />
        <Button title={t('Apply')} size="sm" variant="success" icon="checkmark" onPress={onAccept} loading={busy} />
      </View>
    </View>
  );
}

function UpcomingCard({ app, onOpen }: { app: Conversation; onOpen: () => void }) {
  const canNavigate = app.gigLatitude != null && app.gigLongitude != null;
  return (
    <View style={s.up}>
      <View style={s.upIcon}><Icon name="briefcase-outline" size={20} color={colors.blue} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.upWhen}>{startsIn(app.gigStartAt, app.gigEndAt)}</Text>
        <Text style={s.upTitle} numberOfLines={1} onPress={onOpen}>{app.gigTitle} · {app.businessName}</Text>
        <Text style={s.upMeta} numberOfLines={1}>{formatSchedule(app.gigStartAt, app.gigEndAt)}{app.gigLocation ? ` · ${app.gigLocation}` : ''}</Text>
      </View>
      {canNavigate ? (
        <Button title={t('Directions')} size="sm" variant="soft" color={colors.blue} icon="navigate-outline"
          onPress={() => openDirections(app.gigLatitude!, app.gigLongitude!)} />
      ) : null}
    </View>
  );
}

function HireCodeCard({ app }: { app: Conversation }) {
  return (
    <View style={s.code}>
      <View style={s.codeIcon}><Icon name="key-outline" size={20} color={colors.green} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.codeLabel}>{t('You were accepted for {gig}', { gig: app.gigTitle })}</Text>
        <Text style={s.codeHint}>{t('Show this code to {business} when you meet', { business: app.businessName })}</Text>
      </View>
      <Text style={s.codeNum} accessibilityLabel={t('Hire code {code}', { code: app.hireCode?.split('').join(' ') })}>{app.hireCode}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: 84 },
  invite: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, borderWidth: 1.5, borderColor: colors.accent, gap: 10 },
  inviteTop: { flexDirection: 'row', gap: 12 },
  inviteFrom: { fontSize: 12, fontWeight: '800', color: colors.accent },
  inviteTitle: { fontSize: 16, fontWeight: '800', color: colors.dark, marginTop: 2 },
  inviteMeta: { fontSize: 12, color: colors.muted, marginTop: 3 },
  inviteMsg: { fontSize: 14, color: colors.body, fontStyle: 'italic', lineHeight: 20 },
  inviteBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  up: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.blueLight, borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: '#BFDBFE' },
  upIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  upWhen: { fontSize: 12, fontWeight: '800', color: colors.blue },
  upTitle: { fontSize: 15, fontWeight: '700', color: colors.dark, marginTop: 1 },
  upMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  code: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.greenLight, borderRadius: radius.lg,
    padding: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  codeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  codeLabel: { fontSize: 14, fontWeight: '700', color: colors.dark },
  codeHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  codeNum: { fontSize: 30, fontWeight: '900', color: colors.green, letterSpacing: 4 },
});
