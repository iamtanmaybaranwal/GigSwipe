import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import { errorMessage } from '../api';
import { Sheet } from './Sheet';
import { Button } from './ui';
import { Icon } from './Icon';

/** Business enters the 4-digit code the job seeker shows them in person. */
export function HireCodeSheet({ visible, workerName, gigTitle, onClose, onSubmit }: {
  visible: boolean; workerName: string; gigTitle: string; onClose: () => void;
  onSubmit: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (visible) {
      setCode(''); setError('');
      const t = setTimeout(() => input.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const submit = async () => {
    if (!/^\d{4}$/.test(code)) { setError('Enter all 4 digits.'); return; }
    setBusy(true); setError('');
    try {
      await onSubmit(code);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title="Confirm the hire" onClose={onClose}>
      <View style={s.info}>
        <Icon name="shield-checkmark-outline" size={20} color={colors.accent} />
        <Text style={s.infoText}>
          Ask <Text style={s.bold}>{workerName}</Text> to open GigSwipe → Matches and show you the
          4-digit code for <Text style={s.bold}>“{gigTitle}”</Text>. This confirms the right person is here.
        </Text>
      </View>

      <Pressable onPress={() => input.current?.focus()} style={s.boxes} accessibilityLabel="Hire code input">
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[s.box, code.length === i && s.boxActive, !!error && s.boxError]}>
            <Text style={s.digit}>{code[i] ?? ''}</Text>
          </View>
        ))}
        <TextInput
          ref={input}
          value={code}
          onChangeText={t => { setCode(t.replace(/\D/g, '').slice(0, 4)); setError(''); }}
          keyboardType="number-pad"
          maxLength={4}
          style={s.hidden}
          onSubmitEditing={submit}
          caretHidden
          autoComplete="off"
          importantForAutofill="no"
        />
      </Pressable>

      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button title="Confirm hire" icon="checkmark-circle-outline" variant="success" onPress={submit} loading={busy}
        disabled={code.length !== 4} style={{ marginTop: spacing.lg }} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  info: { flexDirection: 'row', gap: 10, backgroundColor: colors.accentLight, padding: spacing.md, borderRadius: radius.md },
  infoText: { ...font.small, color: colors.body, flex: 1 },
  bold: { fontWeight: '700', color: colors.dark },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: spacing.xxl },
  box: { width: 58, height: 66, borderRadius: radius.md, borderWidth: 2, borderColor: colors.borderMid,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  boxActive: { borderColor: colors.accent, backgroundColor: colors.white },
  boxError: { borderColor: colors.red },
  digit: { fontSize: 28, fontWeight: '800', color: colors.dark },
  // Transparent input laid over the boxes, so a tap anywhere opens the number pad
  hidden: { ...StyleSheet.absoluteFill, color: 'transparent', backgroundColor: 'transparent', fontSize: 1 },
  error: { color: colors.red, fontSize: 13, textAlign: 'center', marginTop: spacing.md },
});
