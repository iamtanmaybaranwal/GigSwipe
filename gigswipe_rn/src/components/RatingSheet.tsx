import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';
import { errorMessage } from '../api';
import { Sheet } from './Sheet';
import { Stars } from './Stars';
import { Button, TextField } from './ui';
import { t } from '../i18n';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export function RatingSheet({ visible, targetName, gigTitle, onClose, onSubmit }: {
  visible: boolean; targetName: string; gigTitle: string; onClose: () => void;
  /** Should throw with a user-friendly message on failure. */
  onSubmit: (stars: number, review: string) => Promise<void>;
}) {
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) { setStars(0); setReview(''); setError(''); }
  }, [visible]);

  const submit = async () => {
    if (!stars) { setError(t('Tap a star to choose a rating.')); return; }
    setBusy(true); setError('');
    try {
      await onSubmit(stars, review.trim());
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title={t('Leave a review')} onClose={onClose}>
      <Text style={s.who}>{targetName}</Text>
      <Text style={s.gig}>for “{gigTitle}”</Text>
      <View style={s.stars}>
        <Stars value={stars} size={38} gap={8} onChange={v => { setStars(v); setError(''); }} />
        <Text style={s.starLabel}>{stars ? t(LABELS[stars]!) : t('Tap to rate')}</Text>
      </View>
      <TextField
        label={t('Review (optional)')}
        value={review}
        onChangeText={setReview}
        placeholder={t('What was it like working together?')}
        multiline
        maxLength={500}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button title={t('Submit review')} icon="star" onPress={submit} loading={busy} style={{ marginTop: spacing.sm }} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  who: { ...font.h3, textAlign: 'center' },
  gig: { ...font.small, textAlign: 'center', marginTop: 2 },
  stars: { alignItems: 'center', marginVertical: spacing.xl, gap: 8 },
  starLabel: { fontSize: 14, fontWeight: '700', color: colors.amber },
  error: { color: colors.red, fontSize: 13, marginBottom: 4 },
});
