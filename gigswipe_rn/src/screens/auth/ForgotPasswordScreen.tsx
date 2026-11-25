// Forgot password: email → 6-digit code → new password (signs you in).
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getLanguage, t } from '../../i18n';
import { colors, font } from '../../theme';
import { Banner, Button, Header, TextField } from '../../components/ui';
import { isValidEmail, toast } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';

const RESEND_SECONDS = 60;

export default function ForgotPasswordScreen({ route }: RootScreen<'ForgotPassword'>) {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const sendCode = async () => {
    if (!isValidEmail(email)) { setError(t('Enter a valid email address')); return; }
    setBusy(true); setError('');
    try {
      await api.auth.forgotPassword(email.trim(), getLanguage());
      setStep('code');
      setWait(RESEND_SECONDS);
      toast(t('If an account exists for this email, we have sent a 6-digit code to it.'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!/^\d{6}$/.test(code)) { setError(t('Please enter the 6-digit code.')); return; }
    if (password.length < 8) { setError(t('Use at least 8 characters')); return; }
    if (password !== confirm) { setError(t('Passwords do not match')); return; }
    setBusy(true); setError('');
    try {
      const { token, user } = await api.auth.resetPassword(email.trim(), code, password);
      toast(t('Password changed. You are signed in.'));
      await signIn(token, user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title={t('Reset password')} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {step === 'email' ? (
            <>
              <Text style={font.h2}>{t('Forgot your password?')}</Text>
              <Text style={[font.small, s.sub]}>{t("Enter your account's email. We'll send you a 6-digit code.")}</Text>
              <TextField label={t('Email address')} icon="mail-outline" value={email} onChangeText={v => { setEmail(v); setError(''); }}
                placeholder={t('you@email.com')} keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                returnKeyType="send" onSubmitEditing={sendCode} />
              {error ? <Banner icon="alert-circle-outline" color={colors.red} text={error} /> : null}
              <Button title={t('Send code')} icon="mail-outline" onPress={sendCode} loading={busy} style={{ marginTop: 16 }} />
            </>
          ) : (
            <>
              <Text style={font.h2}>{t('Check your email')}</Text>
              <Text style={[font.small, s.sub]}>
                {t('We sent a 6-digit code to {email}. It expires in 10 minutes. Check your spam folder too.', { email: email.trim() })}
              </Text>
              <TextField label={t('6-digit code')} icon="keypad-outline" value={code} keyboardType="number-pad" maxLength={6}
                onChangeText={v => { setCode(v.replace(/\D/g, '')); setError(''); }} placeholder="123456" autoComplete="one-time-code"
                textContentType="oneTimeCode" />
              <TextField label={t('New password')} icon="key-outline" secure value={password} autoCapitalize="none"
                onChangeText={v => { setPassword(v); setError(''); }} hint={t('At least 8 characters')} autoComplete="new-password" />
              <TextField label={t('Confirm new password')} icon="key-outline" secure value={confirm} autoCapitalize="none"
                onChangeText={v => { setConfirm(v); setError(''); }} returnKeyType="go" onSubmitEditing={reset} />
              {error ? <Banner icon="alert-circle-outline" color={colors.red} text={error} /> : null}
              <Button title={t('Change password')} icon="checkmark" onPress={reset} loading={busy} style={{ marginTop: 16 }} />
              <Button title={wait > 0 ? t('Resend code in {n}s', { n: wait }) : t('Resend code')} variant="ghost"
                disabled={wait > 0 || busy} onPress={sendCode} style={{ marginTop: 4 }} />
              <Button title={t('Use a different email')} variant="ghost" color={colors.muted}
                onPress={() => { setStep('email'); setCode(''); setError(''); }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  body: { padding: 24 },
  sub: { marginTop: 6, marginBottom: 22 },
});
