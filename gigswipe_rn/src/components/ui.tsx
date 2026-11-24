// Small, reusable building blocks used across every screen.
import React, { useState } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, font, radius, shadow, spacing, tint } from '../theme';
import { initials } from '../utils/format';
import { Icon, type IconName } from './Icon';

// ── Button ────────────────────────────────────────────────────────────────────
type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger' | 'success' | 'soft';

export function Button({
  title, onPress, variant = 'primary', icon, iconRight, loading, disabled, style, size = 'lg', color,
}: {
  title: string; onPress?: () => void; variant?: Variant; icon?: IconName; iconRight?: IconName;
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; size?: 'sm' | 'md' | 'lg';
  /** Override the brand colour (e.g. a business's colour). */
  color?: string;
}) {
  const base = color ?? colors.accent;
  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: base, fg: colors.white },
    dark: { bg: colors.navy, fg: colors.white },
    outline: { bg: colors.white, fg: base, border: tint(base, 0.4) },
    ghost: { bg: 'transparent', fg: base },
    danger: { bg: colors.redLight, fg: colors.red, border: tint(colors.red, 0.25) },
    success: { bg: colors.green, fg: colors.white },
    soft: { bg: tint(base, 0.1), fg: base },
  };
  const p = palette[variant];
  const h = size === 'lg' ? 54 : size === 'md' ? 44 : 34;
  const off = disabled || loading;

  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      android_ripple={{ color: tint(p.fg, 0.15) }}
      style={({ pressed }) => [
        s.btn,
        { height: h, backgroundColor: p.bg, borderColor: p.border ?? 'transparent', borderWidth: p.border ? 1.5 : 0,
          paddingHorizontal: size === 'sm' ? 12 : 18, borderRadius: size === 'sm' ? radius.sm : radius.md },
        (variant === 'primary' || variant === 'dark' || variant === 'success') && !off && shadow.card,
        off && { opacity: 0.5 },
        pressed && !off && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 15 : 18} color={p.fg} />}
          <Text style={[s.btnText, { color: p.fg, fontSize: size === 'sm' ? 13 : size === 'md' ? 15 : 16 }]} numberOfLines={1}>
            {title}
          </Text>
          {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 18} color={p.fg} />}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, color = colors.dark, bg = 'transparent', size = 22, label, style, disabled }: {
  name: IconName; onPress?: () => void; color?: string; bg?: string; size?: number; label: string;
  style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [s.iconBtn, { backgroundColor: bg }, pressed && { opacity: 0.6 }, disabled && { opacity: 0.4 }, style]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
export function Header({ title, subtitle, right, onBack, back = true }: {
  title?: string; subtitle?: string; right?: React.ReactNode; onBack?: () => void; back?: boolean;
}) {
  const nav = useNavigation();
  return (
    <View style={s.header}>
      {back ? (
        <IconButton name="arrow-back" label="Go back" onPress={onBack ?? (() => nav.canGoBack() && nav.goBack())} />
      ) : <View style={{ width: 44 }} />}
      <View style={s.headerCenter}>
        {title ? <Text style={s.headerTitle} numberOfLines={1}>{title}</Text> : null}
        {subtitle ? <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={s.headerRight}>{right ?? <View style={{ width: 44 }} />}</View>
    </View>
  );
}

// ── Inputs ────────────────────────────────────────────────────────────────────
export function TextField({
  label, icon, error, hint, secure, maxLength, value, multiline, style, onFocus, onBlur, ref, ...rest
}: Omit<TextInputProps, 'style'> & {
  label?: string; icon?: IconName; error?: string | null; hint?: string; secure?: boolean;
  style?: StyleProp<ViewStyle>; ref?: React.Ref<TextInputInstance>;
}) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.field, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[
        s.inputRow,
        multiline && { alignItems: 'flex-start', paddingVertical: 10 },
        focused && { borderColor: colors.accent, backgroundColor: colors.white },
        !!error && { borderColor: colors.red },
      ]}>
        {icon ? <Icon name={icon} size={18} color={focused ? colors.accent : colors.muted} style={multiline ? { marginTop: 2 } : undefined} /> : null}
        <TextInput
          ref={ref}
          value={value}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={secure && hidden}
          maxLength={maxLength}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...rest}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e => { setFocused(false); onBlur?.(e); }}
          style={[s.input, multiline && { minHeight: 96, paddingTop: 0 }]}
        />
        {secure ? (
          <Pressable onPress={() => setHidden(h => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <View style={s.fieldFoot}>
        {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : <View />}
        {maxLength && (multiline || (value?.length ?? 0) > maxLength * 0.8) ? (
          <Text style={s.counter}>{value?.length ?? 0}/{maxLength}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Display ───────────────────────────────────────────────────────────────────
export function Avatar({ name, color, size = 44, square }: { name?: string; color?: string; size?: number; square?: boolean }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: square ? size * 0.3 : size / 2,
      backgroundColor: color || colors.accent, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: colors.white, fontWeight: '800', fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

export function Pill({ text, color = colors.accent, icon, solid }: { text: string; color?: string; icon?: IconName; solid?: boolean }) {
  return (
    <View style={[s.pill, { backgroundColor: solid ? color : tint(color, 0.12) }]}>
      {icon ? <Icon name={icon} size={12} color={solid ? colors.white : color} /> : null}
      <Text style={[s.pillText, { color: solid ? colors.white : color }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} android_ripple={{ color: colors.surfaceAlt }}
        style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ icon, title, right, style }: {
  icon?: IconName; title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.sectionTitle, style]}>
      {icon ? <Icon name={icon} size={15} color={colors.accent} /> : null}
      <Text style={s.sectionTitleText}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, message, action, onAction }: {
  icon: IconName; title: string; message?: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Icon name={icon} size={40} color={colors.accent} /></View>
      <Text style={s.emptyTitle}>{title}</Text>
      {message ? <Text style={s.emptyMsg}>{message}</Text> : null}
      {action && onAction ? <Button title={action} onPress={onAction} size="md" style={{ marginTop: spacing.lg, alignSelf: 'center' }} /> : null}
    </View>
  );
}

export function Loading({ text }: { text?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={colors.accent} />
      {text ? <Text style={[font.small, { marginTop: 12 }]}>{text}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState icon="cloud-offline-outline" title="Couldn't load this" message={message}
      action={onRetry ? 'Try again' : undefined} onAction={onRetry} />
  );
}

export function Banner({ icon, text, color = colors.blue, action, onPress }: {
  icon: IconName; text: string; color?: string; action?: string; onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.banner, { backgroundColor: tint(color, 0.08), borderColor: tint(color, 0.25) }]}>
      <Icon name={icon} size={18} color={color} />
      <Text style={[s.bannerText, { color: colors.body }]}>{text}</Text>
      {action ? <Text style={[s.bannerAction, { color }]}>{action}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  btnText: { fontWeight: '700' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 56, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.dark },
  headerSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },

  field: { marginBottom: 6 },
  label: { ...font.label, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.surfaceAlt, paddingHorizontal: 14, minHeight: 52 },
  input: { flex: 1, fontSize: 15, color: colors.dark, paddingVertical: 10 },
  fieldFoot: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 18, marginTop: 3 },
  error: { fontSize: 12, color: colors.red, flex: 1 },
  hint: { fontSize: 12, color: colors.subtle, flex: 1 },
  counter: { fontSize: 11, color: colors.subtle, marginLeft: 8 },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderMid, ...shadow.card },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitleText: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  emptyIcon: { width: 84, height: 84, borderRadius: 28, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { ...font.h3, textAlign: 'center' },
  emptyMsg: { ...font.small, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1 },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  bannerAction: { fontSize: 13, fontWeight: '800' },
});
