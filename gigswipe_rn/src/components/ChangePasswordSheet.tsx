import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { api, errorMessage } from '../api';
import { colors, spacing } from '../theme';
import { toast } from '../utils/format';
import { Sheet } from './Sheet';
import { Button, TextField } from './ui';
import { t } from '../i18n';

export function ChangePasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) { setCurrent(''); setNext(''); setConfirm(''); setError(''); }
  }, [visible]);

  const submit = async () => {
    if (next.length < 8) return setError(t('New password must be at least 8 characters.'));
    if (next !== confirm) return setError(t('New passwords do not match.'));
    setBusy(true); setError('');
    try {
      await api.auth.changePassword(current, next);
      toast(t('Password updated'));
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title={t('Change password')} onClose={onClose}>
      <TextField label={t('Current password')} icon="lock-closed-outline" secure value={current} onChangeText={setCurrent} autoCapitalize="none" />
      <TextField label={t('New password')} icon="key-outline" secure value={next} onChangeText={setNext} autoCapitalize="none" hint={t('At least 8 characters')} />
      <TextField label={t('Confirm new password')} icon="key-outline" secure value={confirm} onChangeText={setConfirm} autoCapitalize="none" />
      {error ? <Text style={{ color: colors.red, fontSize: 13, marginBottom: 6 }}>{error}</Text> : null}
      <Button title={t('Update password')} onPress={submit} loading={busy} disabled={!current || !next || !confirm} style={{ marginTop: spacing.sm }} />
    </Sheet>
  );
}
