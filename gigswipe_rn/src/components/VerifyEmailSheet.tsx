// Verify the signed-in user's email with a 6-digit code.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { api, errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { getLanguage, t } from '../i18n';
import { colors, font, spacing } from '../theme';
import { toast } from '../utils/format';
import { Sheet } from './Sheet';
import { Banner, Button, TextField } from './ui';

export function VerifyEmailSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, setUser } = useAuth();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);

  useEffect(() => { if (visible) { setSent(false); setCode(''); setError(''); } }, [visible]);
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const send = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.auth.sendEmailCode(getLanguage());
      if (r.alreadyVerified) { await finish(); return; }
      setSent(true);
      setWait(60);
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  const finish = async () => {
    const { user: me } = await api.auth.me();
    setUser(me);
    toast(t('Email verified'));
    onClose();
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) { setError(t('Please enter the 6-digit code.')); return; }
    setBusy(true); setError('');
    try {
      const { user: updated } = await api.auth.verifyEmail(code);
      setUser(updated);
      toast(t('Email verified'));
      onClose();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} title={t('Verify your email')} onClose={onClose}>
      <Text style={[font.small, s.p]}>
        {sent
          ? t('We sent a 6-digit code to {email}. It expires in 10 minutes. Check your spam folder too.', { email: user?.email ?? '' })
          : t('Verified accounts get a badge on their profile, so others know they are real.')}
      </Text>
      {sent ? (
        <TextField label={t('6-digit code')} icon="keypad-outline" value={code} keyboardType="number-pad" maxLength={6}
          onChangeText={v => { setCode(v.replace(/\D/g, '')); setError(''); }} placeholder="123456" autoComplete="one-time-code"
          returnKeyType="done" onSubmitEditing={verify} />
      ) : null}
      {error ? <Banner icon="alert-circle-outline" color={colors.red} text={error} /> : null}
      {sent ? (
        <>
          <Button title={t('Verify')} icon="checkmark" onPress={verify} loading={busy} style={{ marginTop: spacing.md }} />
          <Button title={wait > 0 ? t('Resend code in {n}s', { n: wait }) : t('Resend code')} variant="ghost"
            disabled={wait > 0 || busy} onPress={send} />
        </>
      ) : (
        <Button title={t('Send code to {email}', { email: user?.email ?? '' })} icon="mail-outline" onPress={send} loading={busy}
          style={{ marginTop: spacing.md }} />
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({ p: { marginBottom: spacing.lg } });
