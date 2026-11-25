import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Rating } from '../api/types';
import { colors, radius, spacing, tint } from '../theme';
import { formatDate } from '../utils/format';
import { t } from '../i18n';
import { Avatar, Card } from './ui';
import { Stars } from './Stars';
import { Icon, type IconName } from './Icon';

export function ProfileHeader({ name, color, photo, online, onEditPhoto, uploading, subtitle, tags, stats }: {
  name: string; color?: string; photo?: string; online?: boolean;
  /** Shows a camera button on the avatar (own profile). */
  onEditPhoto?: () => void; uploading?: boolean;
  subtitle?: string; tags?: { icon: IconName; text: string }[];
  stats: { value: string; label: string }[];
}) {
  const c = color || colors.accent;
  return (
    <View>
      <View style={[s.cover, { backgroundColor: tint(c, 0.16) }]} />
      <Pressable style={s.avatarRing} onPress={onEditPhoto} disabled={!onEditPhoto || uploading}
        accessibilityLabel={onEditPhoto ? t('Change profile photo') : undefined}>
        <Avatar name={name} color={c} photo={photo} badge={online} size={92} />
        {onEditPhoto ? (
          <View style={s.camera}>
            {uploading ? <ActivityIndicator size="small" color={colors.white} /> : <Icon name="camera" size={15} color={colors.white} />}
          </View>
        ) : null}
      </Pressable>
      <View style={s.identity}>
        <Text style={s.name}>{name || t('Your name')}</Text>
        {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
        {tags?.length ? (
          <View style={s.tags}>
            {tags.map(tag => (
              <View key={tag.text} style={s.tag}>
                <Icon name={tag.icon} size={13} color={colors.muted} />
                <Text style={s.tagText} numberOfLines={1}>{tag.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={s.stats}>
          {stats.map((st, i) => (
            <React.Fragment key={st.label}>
              {i > 0 ? <View style={s.divider} /> : null}
              <View style={s.stat}>
                <Text style={s.statValue}>{st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );
}

export function RatingsCard({ title, average, total, ratings, emptyText }: {
  title: string; average: number; total: number; ratings: Rating[]; emptyText: string;
}) {
  return (
    <Card style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }}>
      <View style={s.ratingsHead}>
        <Icon name="star" size={16} color={colors.amber} />
        <Text style={s.ratingsTitle}>{title}</Text>
      </View>
      {total === 0 ? (
        <Text style={s.empty}>{emptyText}</Text>
      ) : (
        <>
          <View style={s.summary}>
            <Text style={s.avg}>{average.toFixed(1)}</Text>
            <View>
              <Stars value={average} size={18} />
              <Text style={s.total}>{total === 1 ? t('{n} review', { n: total }) : t('{n} reviews', { n: total })}</Text>
            </View>
          </View>
          {ratings.map(r => (
            <View key={r.id} style={s.review}>
              <View style={s.reviewHead}>
                <Text style={s.reviewer}>{r.raterName}</Text>
                <Stars value={r.stars} size={12} gap={1} />
              </View>
              <Text style={s.reviewGig}>{r.gigTitle} · {formatDate(r.createdAt)}</Text>
              {r.review ? <Text style={s.reviewText}>“{r.review}”</Text> : null}
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  cover: { height: 110 },
  avatarRing: { alignSelf: 'center', marginTop: -50, padding: 4, borderRadius: 60, backgroundColor: colors.white },
  camera: { position: 'absolute', right: 2, bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent,
    borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  identity: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 10 },
  name: { fontSize: 24, fontWeight: '800', color: colors.dark, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.muted, marginTop: 4, textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, maxWidth: 260 },
  tagText: { fontSize: 12, color: colors.body, fontWeight: '600' },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, backgroundColor: colors.white,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderMid, paddingVertical: 12, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 19, fontWeight: '800', color: colors.dark },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2, fontWeight: '600' },
  divider: { width: 1, height: 28, backgroundColor: colors.borderMid },

  ratingsHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  ratingsTitle: { fontSize: 15, fontWeight: '800', color: colors.dark },
  empty: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  avg: { fontSize: 36, fontWeight: '900', color: colors.dark },
  total: { fontSize: 12, color: colors.muted, marginTop: 3 },
  review: { paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewer: { fontSize: 14, fontWeight: '700', color: colors.dark },
  reviewGig: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  reviewText: { fontSize: 14, color: colors.body, marginTop: 6, lineHeight: 20, fontStyle: 'italic' },
});
