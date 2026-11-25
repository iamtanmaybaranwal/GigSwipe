// Job giver → pick one of their open gigs and invite a job seeker to apply.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage, type InviteOption } from '../api';
import { t } from '../i18n';
import { colors, radius, spacing } from '../theme';
import { formatSchedule, payText, toast } from '../utils/format';
import { Sheet } from './Sheet';
import { Banner, Button, TextField } from './ui';
import { Icon } from './Icon';

const STATE_LABEL: Record<InviteOption['state'], string | null> = {
  none: null,
  applied: 'Already applied',
  invite_pending: 'Invited',
  invite_accepted: 'Already applied',
  invite_declined: 'Declined',
};

export function InviteSheet({ visible, workerId, workerName, onClose, onPostGig }: {
  visible: boolean; workerId: string; workerName: string; onClose: () => void; onPostGig?: () => void;
}) {
  const [options, setOptions] = useState<InviteOption[] | null>(null);
  const [error, setError] = useState('');
  const [gigId, setGigId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setOptions(null); setError(''); setGigId(null); setMessage('');
    api.invites.options(workerId)
      .then(r => {
        setOptions(r.gigs);
        const first = r.gigs.find(o => o.state === 'none');
        if (first) setGigId(first.gig.id);
      })
      .catch(e => setError(errorMessage(e)));
  }, [visible, workerId]);

  const send = async () => {
    if (!gigId) return;
    setSending(true);
    try {
      await api.invites.send(gigId, workerId, message.trim() || undefined);
      toast(t('Invite sent to {name}', { name: workerName }));
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet visible={visible} title={t('Invite {name}', { name: workerName })} onClose={onClose}>
      {!options && !error ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} /> : null}
      {options && options.length === 0 ? (
        <View style={{ gap: 12, paddingVertical: 8 }}>
          <Banner icon="briefcase-outline" color={colors.muted} text={t('You have no open gigs. Post a gig first, then invite people to it.')} />
          {onPostGig ? <Button title={t('Post a gig')} icon="add" onPress={() => { onClose(); onPostGig(); }} /> : null}
        </View>
      ) : null}
      {options && options.length > 0 ? (
        <>
          <Text style={s.h}>{t('Which gig?')}</Text>
          <View style={{ gap: 8 }}>
            {options.map(o => {
              const label = STATE_LABEL[o.state];
              const on = gigId === o.gig.id;
              return (
                <Pressable key={o.gig.id} disabled={!!label} onPress={() => setGigId(o.gig.id)}
                  style={[s.opt, on && s.optOn, !!label && { opacity: 0.55 }]} accessibilityState={{ selected: on, disabled: !!label }}>
                  <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.accent : colors.subtle} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.optTitle} numberOfLines={1}>{o.gig.title}</Text>
                    <Text style={s.optMeta} numberOfLines={1}>
                      {[payText(o.gig), o.gig.startAt ? formatSchedule(o.gig.startAt, o.gig.endAt) : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {label ? <Text style={s.optState}>{t(label)}</Text> : null}
                </Pressable>
              );
            })}
          </View>
          <TextField label={t('Message (optional)')} value={message} onChangeText={setMessage} maxLength={300} multiline
            placeholder={t('e.g. Your experience looks perfect for this. Can you make it on Saturday?')} style={{ marginTop: spacing.lg }} />
        </>
      ) : null}
      {error ? <Banner icon="alert-circle-outline" color={colors.red} text={error} /> : null}
      {options && options.length > 0 ? (
        <Button title={t('Send invite')} icon="paper-plane-outline" onPress={send} loading={sending} disabled={!gigId}
          style={{ marginTop: spacing.md }} />
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  h: { fontSize: 13, fontWeight: '700', color: colors.body, marginBottom: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.borderMid, backgroundColor: colors.white },
  optOn: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  optTitle: { fontSize: 15, fontWeight: '700', color: colors.dark },
  optMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  optState: { fontSize: 12, fontWeight: '700', color: colors.muted },
});
