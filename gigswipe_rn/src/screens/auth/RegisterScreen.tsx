import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { colors, font } from '../../theme';
import { Banner, Button, Header, Pill, TextField } from '../../components/ui';
import { isValidEmail } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';

export default function RegisterScreen({ route }: RootScreen<'Register'>) {
  const { role } = route.params;
  const isWorker = role === 'worker';
  const { signIn } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [extra, setExtra] = useState(''); // profession (worker) or business name (business)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const errors = {
    name: !name.trim() ? 'Your name is required' : null,
    email: !isValidEmail(email) ? 'Enter a valid email address' : null,
    password: password.length < 8 ? 'Use at least 8 characters' : null,
    confirm: confirm !== password ? 'Passwords do not match' : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true); setError('');
    try {
      const { token, user } = await api.auth.register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        ...(isWorker ? { major: extra.trim() } : { businessName: extra.trim() || undefined }),
      });
      await signIn(token, user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const show = (k: keyof typeof errors, v: string) => (touched || v.length > 0) ? errors[k] : null;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Header title="Create account" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pill text={isWorker ? 'Job Seeker' : 'Job Giver'} icon={isWorker ? 'person-outline' : 'storefront-outline'}
            color={isWorker ? colors.accent : colors.navy} />
          <Text style={[font.h2, { marginTop: 12 }]}>{isWorker ? 'Start finding work nearby' : 'Start hiring nearby'}</Text>
          <Text style={[font.small, { marginTop: 4, marginBottom: 22 }]}>It takes less than a minute.</Text>

          <TextField label="Full name *" icon="person-outline" value={name} onChangeText={setName}
            placeholder="Jordan Taylor" autoComplete="name" error={show('name', name)} maxLength={80} />
          <TextField label="Email *" icon="mail-outline" value={email} onChangeText={setEmail}
            placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email"
            error={show('email', email)} />
          <TextField label="Password *" icon="lock-closed-outline" value={password} onChangeText={setPassword}
            placeholder="At least 8 characters" secure autoCapitalize="none" autoComplete="new-password"
            error={show('password', password)} />
          <TextField label="Confirm password *" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm}
            placeholder="Repeat your password" secure autoCapitalize="none" error={show('confirm', confirm)} />

          {isWorker ? (
            <TextField label="What do you do? (optional)" icon="briefcase-outline" value={extra} onChangeText={setExtra}
              placeholder="e.g. Barista, Electrician, Designer, Student" maxLength={120} />
          ) : (
            <TextField label="Business name (optional)" icon="storefront-outline" value={extra} onChangeText={setExtra}
              placeholder="Leave empty if you're hiring as an individual" maxLength={100} />
          )}

          {error ? <Banner icon="alert-circle-outline" text={error} color={colors.red} /> : null}

          <Button title="Create account" onPress={submit} loading={busy} style={{ marginTop: 16 }} />
          <Text style={s.legal}>By creating an account you agree to the Terms of Service and Privacy Policy.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  legal: { fontSize: 12, color: colors.subtle, textAlign: 'center', marginTop: 14, lineHeight: 17 },
});
