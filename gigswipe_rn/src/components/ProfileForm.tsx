// Shared pieces for the editable profile screens.
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';
import { Button, Card, SectionTitle } from './ui';
import { Icon } from './Icon';
import { ChangePasswordSheet } from './ChangePasswordSheet';
import { TextField } from './ui';

/** Tag list editor (skills, portfolio links). */
export function ListEditor({ items, onChange, placeholder, max, maxLength, hint }: {
  items: string[]; onChange: (v: string[]) => void; placeholder: string; max: number; maxLength: number; hint?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.some(i => i.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    if (items.length >= max) { Alert.alert('Limit reached', `You can add up to ${max}.`); return; }
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <View>
      {items.length > 0 && (
        <View style={s.chips}>
          {items.map(item => (
            <Pressable key={item} style={s.chip} onPress={() => onChange(items.filter(i => i !== item))}
              accessibilityLabel={`Remove ${item}`}>
              <Text style={s.chipText} numberOfLines={1}>{item}</Text>
              <Icon name="close" size={14} color={colors.accent} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={s.addRow}>
        <TextField value={draft} onChangeText={setDraft} placeholder={placeholder} maxLength={maxLength}
          onSubmitEditing={add} returnKeyType="done" style={{ flex: 1, marginBottom: 0 }} autoCapitalize="sentences" />
        <Pressable style={s.addBtn} onPress={add} accessibilityLabel="Add">
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
      <Button title="Discard" variant="outline" size="md" onPress={onDiscard} disabled={saving} style={{ flex: 1 }} />
      <Button title="Save changes" icon="checkmark" size="md" onPress={onSave} loading={saving} style={{ flex: 2 }} />
    </View>
  );
}

export function AccountCard() {
  const { user, signOut } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  return (
    <Card style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }}>
      <SectionTitle icon="settings-outline" title="Account" style={{ marginTop: 0 }} />
      <View style={s.accountRow}>
        <Icon name="mail-outline" size={17} color={colors.muted} />
        <Text style={s.accountText}>{user?.email}</Text>
      </View>
      <Pressable style={s.accountRow} onPress={() => setPwOpen(true)}>
        <Icon name="key-outline" size={17} color={colors.muted} />
        <Text style={[s.accountText, { color: colors.dark, fontWeight: '600' }]}>Change password</Text>
        <Icon name="chevron-forward" size={16} color={colors.subtle} />
      </Pressable>
      <Pressable style={s.accountRow} onPress={() =>
        Alert.alert('Sign out?', 'You can sign back in any time.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
        ])}>
        <Icon name="log-out-outline" size={17} color={colors.red} />
        <Text style={[s.accountText, { color: colors.red, fontWeight: '700' }]}>Sign out</Text>
      </Pressable>
      <ChangePasswordSheet visible={pwOpen} onClose={() => setPwOpen(false)} />
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
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  accountText: { flex: 1, fontSize: 14, color: colors.muted },
});
