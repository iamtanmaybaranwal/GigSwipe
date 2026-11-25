// Bottom sheet built on React Native's Modal. Handles the keyboard and back button.
import React from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { IconButton } from './ui';
import { t } from '../i18n';

export function Sheet({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={s.wrap}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('Close')} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}>
          <View style={s.handle} />
          <View style={s.head}>
            <Text style={s.title}>{title}</Text>
            <IconButton name="close" label={t('Close')} onPress={onClose} color={colors.muted} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl, maxHeight: '88%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderMid, alignSelf: 'center', marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 },
  title: { fontSize: 19, fontWeight: '800', color: colors.dark },
});
