import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ApplicationStatus } from '../api/types';
import { colors, tint } from '../theme';
import { listTime } from '../utils/format';
import { t } from '../i18n';
import { Avatar } from './ui';

/** Labels are English keys: show them with t(meta.label). */
export const STATUS_META: Record<ApplicationStatus, { label: string; color: string }> = {
  pending: { label: 'Applied', color: colors.amber },
  accepted: { label: 'Accepted', color: colors.blue },
  hired: { label: 'Hired', color: colors.green },
  rejected: { label: 'Closed', color: colors.subtle },
};

export function ConversationRow({ name, color, photo, online, title, lastMessage, time, unread, status, onPress, onAvatarPress, right }: {
  name: string; color?: string; photo?: string; online?: boolean; title: string; lastMessage: string; time: string; unread: number;
  status: ApplicationStatus; onPress: () => void; onAvatarPress?: () => void; right?: React.ReactNode;
}) {
  const meta = STATUS_META[status];
  const noMsg = lastMessage === 'No messages yet';
  return (
    <Pressable onPress={onPress} android_ripple={{ color: colors.surfaceAlt }} style={s.row}>
      <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} hitSlop={4}>
        <Avatar name={name} color={color} photo={photo} badge={online} size={52} />
      </Pressable>
      <View style={s.body}>
        <View style={s.line}>
          <Text style={[s.name, unread > 0 && { fontWeight: '800' }]} numberOfLines={1}>{name}</Text>
          <Text style={[s.time, unread > 0 && { color: colors.accent, fontWeight: '700' }]}>{listTime(time)}</Text>
        </View>
        <View style={s.line}>
          <Text style={s.gig} numberOfLines={1}>{title}</Text>
          <View style={[s.status, { backgroundColor: tint(meta.color, 0.12) }]}>
            <Text style={[s.statusText, { color: meta.color }]}>{t(meta.label)}</Text>
          </View>
        </View>
        <View style={s.line}>
          <Text style={[s.msg, noMsg && s.msgEmpty, unread > 0 && s.msgUnread]} numberOfLines={1}>
            {noMsg ? t('No messages yet. Say hi!') : lastMessage}
          </Text>
          {unread > 0 ? <View style={s.badge}><Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text></View> : right}
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: colors.white },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.dark },
  time: { fontSize: 12, color: colors.subtle },
  gig: { flex: 1, fontSize: 13, color: colors.body, fontWeight: '600' },
  status: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '800' },
  msg: { flex: 1, fontSize: 14, color: colors.muted },
  msgEmpty: { fontStyle: 'italic', color: colors.subtle },
  msgUnread: { color: colors.dark, fontWeight: '600' },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
});
