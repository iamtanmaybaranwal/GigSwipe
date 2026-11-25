// Shared pieces for the editable profile screens.
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { LANGUAGES, setLanguage, t, useLanguage } from '../i18n';
import { refreshReminders, remindersEnabled, setRemindersEnabled } from '../services/reminders';
import { colors, radius, spacing } from '../theme';
import { toast } from '../utils/format';
import { Button, Card, Chip, SectionTitle, TextField, ToggleRow } from './ui';
import { Icon } from './Icon';
import { ChangePasswordSheet } from './ChangePasswordSheet';
import { VerifyEmailSheet } from './VerifyEmailSheet';

/** Tag list editor (skills, portfolio links). */
export function ListEditor({ items, onChange, placeholder, max, maxLength, hint }: {
  items: string[]; onChange: (v: string[]) => void; placeholder: string; max: number; maxLength: number; hint?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.some(i => i.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    if (items.length >= max) { Alert.alert(t('Limit reached'), t('You can add up to {n}.', { n: max })); return; }
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <View>
      {items.length > 0 && (
        <View style={s.chips}>
          {items.map(item => (
            <Pressable key={item} style={s.chip} onPress={() => onChange(items.filter(i => i !== item))}
              accessibilityLabel={t('Remove {item}', { item })}>
              <Text style={s.chipText} numberOfLines={1}>{item}</Text>
              <Icon name="close" size={14} color={colors.accent} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={s.addRow}>
        <TextField value={draft} onChangeText={setDraft} placeholder={placeholder} maxLength={maxLength}
          onSubmitEditing={add} returnKeyType="done" style={{ flex: 1, marginBottom: 0 }} autoCapitalize="sentences" />
        <Pressable style={s.addBtn} onPress={add} accessibilityLabel={t('Add')}>
          <Icon name="add" size={24} color={colors.white} />
        </Pressable>
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Sticky "Save changes" bar shown only when the form has unsaved edits. */
export function SaveBar({ dirty, saving, onSave, onDiscard }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void }) {
  if (!dirty) return null;
  return (
    <View style={s.saveBar}>
      <Button title={t('Discard')} variant="outline" size="md" onPress={onDiscard} disabled={saving} style={{ flex: 1 }} />
      <Button title={t('Save changes')} icon="checkmark" size="md" onPress={onSave} loading={saving} style={{ flex: 2 }} />
    </View>
  );
}

export function AccountCard() {
  const { user, setUser, signOut } = useAuth();
  const lang = useLanguage();
  const [pwOpen, setPwOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [reminders, setReminders] = useState(remindersEnabled);
  const [savingVisible, setSavingVisible] = useState(false);
  const isWorker = user?.role === 'worker';

  const toggleReminders = (on: boolean) => {
    setReminders(on);
    setRemindersEnabled(on);
    refreshReminders();
  };
  const toggleDiscoverable = async (on: boolean) => {
    setSavingVisible(true);
    try {
      const { user: updated } = await api.auth.updateProfile({ discoverable: on });
      setUser(updated);
      toast(on ? t('Job givers can now find you and invite you to gigs.') : t('Your profile is hidden from search.'));
    } catch (e) { toast(errorMessage(e)); }
    finally { setSavingVisible(false); }
  };

  return (
    <Card style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }}>
      <SectionTitle icon="settings-outline" title={t('Settings')} style={{ marginTop: 0 }} />
      <View style={s.langRow}>
        <Icon name="language-outline" size={17} color={colors.muted} />
        <Text style={[s.accountText, { color: colors.dark, fontWeight: '600' }]}>{t('Language')}</Text>
        {LANGUAGES.map(l => (
          <Chip key={l.code} label={l.native} selected={lang === l.code} onPress={() => setLanguage(l.code)} style={{ height: 32 }} />
        ))}
      </View>
      <ToggleRow icon="notifications-outline" title={t('Gig reminders')} value={reminders} onChange={toggleReminders}
        subtitle={t('A notification the day before and 1 hour before a gig you are booked for.')} />
      {isWorker ? (
        <ToggleRow icon="eye-outline" title={t('Let job givers find me')} value={user?.discoverable !== false}
          onChange={toggleDiscoverable} disabled={savingVisible}
          subtitle={t('Show your profile in "Find people" so job givers nearby can invite you. Your exact location is never shown.')} />
      ) : null}

      <SectionTitle icon="person-circle-outline" title={t('Account')} />
      <Pressable style={s.accountRow} onPress={user?.emailVerified ? undefined : () => setVerifyOpen(true)}>
        <Icon name="mail-outline" size={17} color={colors.muted} />
        <Text style={s.accountText} numberOfLines={1}>{user?.email}</Text>
        {user?.emailVerified
          ? <Text style={s.verified}>✓ {t('Verified')}</Text>
          : <Text style={s.verify}>{t('Verify')}</Text>}
      </Pressable>
      <Pressable style={s.accountRow} onPress={() => setPwOpen(true)}>
        <Icon name="key-outline" size={17} color={colors.muted} />
        <Text style={[s.accountText, { color: colors.dark, fontWeight: '600' }]}>{t('Change password')}</Text>
        <Icon name="chevron-forward" size={16} color={colors.subtle} />
      </Pressable>
      <Pressable style={s.accountRow} onPress={() =>
        Alert.alert(t('Sign out?'), t('You can sign back in any time.'), [
          { text: t('Cancel'), style: 'cancel' },
          { text: t('Sign out'), style: 'destructive', onPress: () => signOut() },
        ])}>
        <Icon name="log-out-outline" size={17} color={colors.red} />
        <Text style={[s.accountText, { color: colors.red, fontWeight: '700' }]}>{t('Sign out')}</Text>
      </Pressable>
      <ChangePasswordSheet visible={pwOpen} onClose={() => setPwOpen(false)} />
      <VerifyEmailSheet visible={verifyOpen} onClose={() => setVerifyOpen(false)} />
    </Card>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accentLight, paddingLeft: 12, paddingRight: 8,
    paddingVertical: 7, borderRadius: radius.pill, maxWidth: '100%' },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.accent, flexShrink: 1 },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  addBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  saveBar: { flexDirection: 'row', gap: 10, padding: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.borderMid },
  verified: { fontSize: 13, fontWeight: '700', color: colors.green },
  verify: { fontSize: 13, fontWeight: '800', color: colors.accent },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  accountText: { flex: 1, fontSize: 14, color: colors.muted },
});
