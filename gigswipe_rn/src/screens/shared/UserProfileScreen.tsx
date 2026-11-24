import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Application } from '../../api';
import { useCurrentUser } from '../../context/AuthContext';
import { useFocusData } from '../../hooks';
import { colors, radius, spacing } from '../../theme';
import { Button, Card, ErrorView, Header, Loading, SectionTitle } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { ProfileHeader, RatingsCard } from '../../components/Profile';
import { RatingSheet } from '../../components/RatingSheet';
import { callPhone, openUrl, toast } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';

export default function UserProfileScreen({ route }: RootScreen<'UserProfile'>) {
  const { userId } = route.params;
  const me = useCurrentUser();
  const isMe = me.id === userId;
  const [rating, setRating] = useState<Application | null>(null);

  const { data, loading, error, retry, reload } = useFocusData(async () => {
    const [profile, ratings, shared, given] = await Promise.all([
      api.users.profile(userId),
      api.ratings.forUser(userId),
      isMe ? Promise.resolve({ applications: [] as Application[] }) : api.applications.sharedWith(userId),
      isMe ? Promise.resolve({ ratedApplicationIds: [] as string[] }) : api.ratings.given(),
    ]);
    return { ...profile, ...ratings, shared: shared.applications, rated: new Set(given.ratedApplicationIds) };
  }, [userId]);

  if (loading) return <SafeAreaView style={s.safe}><Header title="Profile" /><Loading /></SafeAreaView>;
  if (error || !data) return <SafeAreaView style={s.safe}><Header title="Profile" /><ErrorView message={error ?? 'Profile not found'} onRetry={retry} /></SafeAreaView>;

  const u = data.user;
  const isWorker = u.role === 'worker';
  const subtitle = isWorker
    ? [u.major, u.year].filter(Boolean).join(' · ')
    : [u.businessName && u.businessName !== u.name ? u.name : null, u.industry].filter(Boolean).join(' · ');
  const tags: { icon: IconName; text: string }[] = [
    ...(u.locationLabel || u.location ? [{ icon: 'location-outline' as IconName, text: (u.location || u.locationLabel)! }] : []),
    ...(isWorker && u.university ? [{ icon: 'school-outline' as IconName, text: u.university }] : []),
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title={isWorker ? 'Job seeker' : 'Job giver'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ProfileHeader
          name={isWorker ? u.name : (u.businessName || u.name)}
          color={u.avatarColor}
          subtitle={subtitle}
          tags={tags}
          stats={[
            { value: data.totalRatings ? `${data.averageStars.toFixed(1)}★` : '—', label: 'Rating' },
            { value: String(data.totalRatings), label: 'Reviews' },
            isWorker ? { value: String(data.gigsCompleted), label: 'Gigs done' } : { value: String(data.workersHired), label: 'Hired' },
          ]}
        />

        {!isMe && data.shared.length > 0 && (
          <Card style={s.card}>
            <SectionTitle style={{ marginTop: 0 }} icon="briefcase-outline" title="Your work together" />
            {data.shared.map(a => (
              <View key={a.id} style={s.sharedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.sharedTitle}>{a.gigTitle}</Text>
                  <Text style={s.sharedSub}>{a.status === 'hired' ? 'Hired' : 'Accepted'}</Text>
                </View>
                {data.rated.has(a.id)
                  ? <Text style={s.reviewed}>✓ Reviewed</Text>
                  : <Button title="Review" icon="star-outline" size="sm" variant="soft" color={colors.amber} onPress={() => setRating(a)} />}
              </View>
            ))}
          </Card>
        )}

        {u.bio ? (
          <Card style={s.card}>
            <SectionTitle style={{ marginTop: 0 }} icon="document-text-outline" title="About" />
            <Text style={s.bio}>{u.bio}</Text>
          </Card>
        ) : null}

        {isWorker && (u.skills?.length ?? 0) > 0 && (
          <Card style={s.card}>
            <SectionTitle style={{ marginTop: 0 }} icon="flash-outline" title="Skills" />
            <View style={s.chips}>
              {u.skills!.map(sk => <View key={sk} style={s.chip}><Text style={s.chipText}>{sk}</Text></View>)}
            </View>
          </Card>
        )}

        {isWorker && (u.sampleWork?.length ?? 0) > 0 && (
          <Card style={s.card}>
            <SectionTitle style={{ marginTop: 0 }} icon="attach-outline" title="Portfolio" />
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
            <SectionTitle style={{ marginTop: 0 }} icon="call-outline" title="Contact" />
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
          title={isWorker ? 'Reviews from job givers' : 'Reviews from job seekers'}
          average={data.averageStars}
          total={data.totalRatings}
          ratings={data.ratings}
          emptyText="No reviews yet."
        />
      </ScrollView>

      <RatingSheet
        visible={!!rating}
        targetName={isWorker ? u.name : (u.businessName || u.name)}
        gigTitle={rating?.gigTitle ?? ''}
        onClose={() => setRating(null)}
        onSubmit={async (stars, review) => {
          await api.ratings.submit({ applicationId: rating!.id, stars, review: review || undefined });
          toast('Thanks for your review!');
          reload();
        }}
      />
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
