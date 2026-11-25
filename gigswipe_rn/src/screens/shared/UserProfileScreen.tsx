import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Application } from '../../api';
import { useCurrentUser } from '../../context/AuthContext';
import { useFocusData } from '../../hooks';
import { AVAILABILITY_SLOTS } from '../../config';
import { t } from '../../i18n';
import { colors, radius, spacing } from '../../theme';
import { Banner, Button, Card, ErrorView, Header, Loading, SectionTitle } from '../../components/ui';
import { InviteSheet } from '../../components/InviteSheet';
import { Icon, type IconName } from '../../components/Icon';
import { ProfileHeader, RatingsCard } from '../../components/Profile';
import { RatingSheet } from '../../components/RatingSheet';
import { callPhone, formatTime, openUrl, toast } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';

export default function UserProfileScreen({ route, navigation }: RootScreen<'UserProfile'>) {
  const { userId } = route.params;
  const me = useCurrentUser();
  const isMe = me.id === userId;
  const [rating, setRating] = useState<Application | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, loading, error, retry, reload } = useFocusData(async () => {
    const [profile, ratings, shared, given] = await Promise.all([
      api.users.profile(userId),
      api.ratings.forUser(userId),
      isMe ? Promise.resolve({ applications: [] as Application[] }) : api.applications.sharedWith(userId),
      isMe ? Promise.resolve({ ratedApplicationIds: [] as string[] }) : api.ratings.given(),
    ]);
    return { ...profile, ...ratings, shared: shared.applications, rated: new Set(given.ratedApplicationIds) };
  }, [userId]);

  if (loading) return <SafeAreaView style={s.safe}><Header title={t('Profile')} /><Loading /></SafeAreaView>;
  if (error || !data) return <SafeAreaView style={s.safe}><Header title={t('Profile')} /><ErrorView message={error ?? t('Profile not found')} onRetry={retry} /></SafeAreaView>;

  const u = data.user;
  const isWorker = u.role === 'worker';
  const subtitle = isWorker
    ? [u.major, u.year].filter(Boolean).join(' · ')
    : [u.businessName && u.businessName !== u.name ? u.name : null, u.industry].filter(Boolean).join(' · ');
  const canInvite = me.role === 'business' && isWorker && !isMe;
  const slots = (u.availability ?? []).map(k => AVAILABILITY_SLOTS.find(a => a.key === k)).filter(Boolean) as typeof AVAILABILITY_SLOTS[number][];
  const tags: { icon: IconName; text: string }[] = [
    ...(u.availableNow ? [{ icon: 'flash' as IconName, text: t('Available now') }] : []),
    ...(u.emailVerified ? [{ icon: 'shield-checkmark' as IconName, text: t('Email verified') }] : []),
    ...(u.locationLabel || u.location ? [{ icon: 'location-outline' as IconName, text: (u.location || u.locationLabel)! }] : []),
    ...(isWorker && u.university ? [{ icon: 'school-outline' as IconName, text: u.university }] : []),
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title={isWorker ? t('Job seeker') : t('Job giver')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProfileHeader
          name={isWorker ? u.name : (u.businessName || u.name)}
          color={u.avatarColor}
          photo={u.photoUrl}
          online={u.availableNow}
          subtitle={subtitle}
          tags={tags}
          stats={[
            { value: data.totalRatings ? `${data.averageStars.toFixed(1)}★` : '—', label: t('Rating') },
            { value: String(data.totalRatings), label: t('Reviews') },
            isWorker ? { value: String(data.gigsCompleted), label: t('Gigs done') } : { value: String(data.workersHired), label: t('Hired') },
          ]}
        />

        {canInvite ? (
          <View style={s.card}>
            {u.availableNow && u.availableUntil ? (
              <View style={{ marginBottom: spacing.md }}>
                <Banner icon="flash" color={colors.green} text={t('{name} can start today (until {time}).', { name: u.name.split(' ')[0], time: formatTime(u.availableUntil) })} />
              </View>
            ) : null}
            <Button title={t('Invite to a gig')} icon="paper-plane-outline" onPress={() => setInviteOpen(true)} />
          </View>
        ) : null}

        {!isMe && data.shared.length > 0 && (
          <Card style={s.card}>
            <SectionTitle style={{ marginTop: 0 }} icon="briefcase-outline" title={t('Your work together')} />
            {data.shared.map(a => (
              <View key={a.id} style={s.sharedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.sharedTitle}>{a.gigTitle}</Text>
                  <Text style={s.sharedSub}>{a.status === 'hired' ? t('Hired') : t('Accepted')}</Text>
                </View>
                {data.rated.has(a.id)
                  ? <Text style={s.reviewed}>✓ {t('Reviewed')}</Text>
                  : <Button title={t('Review')} icon="star-outline" size="sm" variant="soft" color={colors.amber} onPress={() => setRating(a)} />}
              </View>
            ))}
          </Card>
        )}

        {u.bio ? (
          <Card style={s.card}>
            <SectionTitle style={{ marginTop: 0 }} icon="document-text-outline" title={t('About')} />
            <Text style={s.bio}>{u.bio}</Text>
          </Card>
        ) : null}

        {isWorker && (slots.length > 0 || u.availabilityNote) ? (
          <Card style={s.card}>
            <SectionTitle style={{ marginTop: 0 }} icon="calendar-outline" title={t('Availability')} />
            {slots.length ? (
              <View style={s.chips}>
                {slots.map(a => <View key={a.key} style={[s.chip, { backgroundColor: colors.blueLight }]}><Text style={[s.chipText, { color: colors.blue }]}>{t(a.label)}</Text></View>)}
              </View>
            ) : null}
            {u.availabilityNote ? <Text style={[s.bio, slots.length ? { marginTop: 10 } : null]}>{u.availabilityNote}</Text> : null}
          </Card>
        ) : null}

        {isWorker && (u.skills?.length ?? 0) > 0 && (
          <Card style={s.card}>
            <SectionTitle style={{ marginTop: 0 }} icon="flash-outline" title={t('Skills')} />
            <View style={s.chips}>
              {u.skills!.map(sk => <View key={sk} style={s.chip}><Text style={s.chipText}>{sk}</Text></View>)}
            </View>
          </Card>
        )}

        {isWorker && (u.sampleWork?.length ?? 0) > 0 && (
          <Card style={s.card}>
            <SectionTitle style={{ marginTop: 0 }} icon="attach-outline" title={t('Portfolio')} />
            {u.sampleWork!.map((w, i) => (
              <Pressable key={i} style={s.link} onPress={() => (/\./.test(w) && !/\s/.test(w) ? openUrl(w) : undefined)}>
                <Icon name="link-outline" size={15} color={colors.accent} />
                <Text style={s.linkText}>{w}</Text>
              </Pressable>
            ))}
          </Card>
        )}

        {!isWorker && (u.website || u.phone) ? (
          <Card style={s.card}>
            <SectionTitle style={{ marginTop: 0 }} icon="call-outline" title={t('Contact')} />
            {u.website ? (
              <Pressable style={s.link} onPress={() => openUrl(u.website!)}>
                <Icon name="globe-outline" size={15} color={colors.accent} /><Text style={s.linkText}>{u.website}</Text>
              </Pressable>
            ) : null}
            {u.phone ? (
              <Pressable style={s.link} onPress={() => callPhone(u.phone!)}>
                <Icon name="call-outline" size={15} color={colors.accent} /><Text style={s.linkText}>{u.phone}</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        <RatingsCard
          title={isWorker ? t('Reviews from job givers') : t('Reviews from job seekers')}
          average={data.averageStars}
          total={data.totalRatings}
          ratings={data.ratings}
          emptyText={t('No reviews yet.')}
        />
      </ScrollView>

      <RatingSheet
        visible={!!rating}
        targetName={isWorker ? u.name : (u.businessName || u.name)}
        gigTitle={rating?.gigTitle ?? ''}
        onClose={() => setRating(null)}
        onSubmit={async (stars, review) => {
          await api.ratings.submit({ applicationId: rating!.id, stars, review: review || undefined });
          toast(t('Thanks for your review!'));
          reload();
        }}
      />
      {canInvite ? (
        <InviteSheet visible={inviteOpen} workerId={u.id} workerName={u.name} onClose={() => setInviteOpen(false)}
          onPostGig={() => navigation.navigate('BusinessTabs', { screen: 'PostGig' })} />
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  sharedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  sharedTitle: { fontSize: 15, fontWeight: '700', color: colors.dark },
  sharedSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  reviewed: { fontSize: 12, fontWeight: '700', color: colors.green },
  bio: { fontSize: 15, color: colors.body, lineHeight: 22, },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, },
  chip: { backgroundColor: colors.accentLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  linkText: { fontSize: 14, color: colors.body, flex: 1 },
});
