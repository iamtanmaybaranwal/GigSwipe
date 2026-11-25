import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { colors, font, radius } from '../../theme';
import { Banner, Button, IconButton, TextField } from '../../components/ui';
import { isValidEmail } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';
import { t } from '../../i18n';

export default function LoginScreen({ navigation }: RootScreen<'Login'>) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pwdRef = useRef<TextInputInstance>(null);

  const canSubmit = isValidEmail(email) && password.length > 0;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true); setError('');
    try {
      const { token, user } = await api.auth.login(email.trim(), password);
      await signIn(token, user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <IconButton name="arrow-back" label={t('Go back')} onPress={() => navigation.goBack()} style={{ marginLeft: 8 }} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.logo}><Text style={s.logoG}>G</Text></View>
          <Text style={font.h1}>{t('Welcome back')}</Text>
          <Text style={[font.body, { color: colors.muted, marginTop: 4, marginBottom: 28 }]}>{t('Sign in to your GigSwipe account')}</Text>

          <TextField
            label={t('Email address')} icon="mail-outline" value={email} onChangeText={v => { setEmail(v); setError(''); }}
            placeholder={t('you@email.com')} keyboardType="email-address" autoCapitalize="none" autoComplete="email"
            textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => pwdRef.current?.focus()}
            error={email.length > 3 && !isValidEmail(email) ? t('Enter a valid email address') : null}
          />
          <TextField
            ref={pwdRef}
            label={t('Password')} icon="lock-closed-outline" value={password} onChangeText={v => { setPassword(v); setError(''); }}
            placeholder={t('Your password')} secure autoCapitalize="none" autoComplete="password"
            returnKeyType="go" onSubmitEditing={submit}
          />
          <Text style={s.forgot} onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() || undefined })}
            accessibilityRole="link">{t('Forgot password?')}</Text>

          {error ? <Banner icon="alert-circle-outline" text={error} color={colors.red} /> : null}

          <Button title={t('Sign in')} iconRight="arrow-forward" onPress={submit} loading={busy} disabled={!canSubmit} style={{ marginTop: 16 }} />
          <Button title={t('New here? Create an account')} variant="ghost" onPress={() => navigation.navigate('Role')} style={{ marginTop: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', fontSize: 14, fontWeight: '700', color: colors.accent, paddingVertical: 6, marginBottom: 4 },
  safe: { flex: 1, backgroundColor: colors.white },
  body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  logo: { width: 60, height: 60, borderRadius: radius.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoG: { fontSize: 32, fontWeight: '900', color: colors.white },
});
