// Date + time picker in a bottom sheet (pure JS — no extra native library).
// Days: the next 120 days as a horizontal strip. Times: 30-minute slots grouped by part of day.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { t } from '../i18n';
import { formatTime, monthName, weekday } from '../utils/format';
import { Sheet } from './Sheet';
import { Button } from './ui';

const DAYS_AHEAD = 120;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const SLOTS = Array.from({ length: 48 }, (_, i) => i * 30); // minutes after midnight
const GROUPS: { label: string; from: number; to: number }[] = [
  { label: 'Early morning', from: 0, to: 5 * 60 },
  { label: 'Morning', from: 5 * 60, to: 12 * 60 },
  { label: 'Afternoon', from: 12 * 60, to: 17 * 60 },
  { label: 'Evening', from: 17 * 60, to: 21 * 60 },
  { label: 'Night', from: 21 * 60, to: 24 * 60 },
];

export function DateTimeSheet({ visible, title, value, min, onClose, onConfirm }: {
  visible: boolean; title: string; value: Date | null;
  /** Earliest selectable moment (defaults to now). */
  min?: Date;
  onClose: () => void; onConfirm: (d: Date) => void;
}) {
  const floor = min ?? new Date();
  const days = useMemo(() => {
    const first = startOfDay(floor);
    return Array.from({ length: DAYS_AHEAD }, (_, i) => new Date(first.getTime() + i * 86400000));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, floor.toDateString()]);

  const initial = value && value >= floor ? value : null;
  const [day, setDay] = useState<Date>(startOfDay(initial ?? floor));
  const [minutes, setMinutes] = useState<number | null>(initial ? initial.getHours() * 60 + initial.getMinutes() : null);
  const listRef = useRef<FlatList<Date>>(null);

  useEffect(() => {
    if (!visible) return;
    const v = value && value >= floor ? value : null;
    setDay(startOfDay(v ?? floor));
    setMinutes(v ? Math.round((v.getHours() * 60 + v.getMinutes()) / 30) * 30 % 1440 : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const at = (m: number) => new Date(day.getTime() + m * 60000);
  const selected = minutes != null ? at(minutes) : null;
  const dayIndex = Math.max(0, days.findIndex(d => d.toDateString() === day.toDateString()));

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <FlatList
        ref={listRef}
        horizontal
        data={days}
        keyExtractor={d => d.toISOString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        initialScrollIndex={dayIndex}
        getItemLayout={(_, i) => ({ length: 66, offset: 66 * i, index: i })}
        renderItem={({ item, index }) => {
          const on = item.toDateString() === day.toDateString();
          return (
            <Pressable onPress={() => setDay(item)} style={[s.day, on && s.dayOn]} accessibilityState={{ selected: on }}>
              <Text style={[s.dayTop, on && s.onText]}>{index === 0 ? t('Today') : index === 1 ? t('Tmrw') : weekday(item)}</Text>
              <Text style={[s.dayNum, on && s.onText]}>{item.getDate()}</Text>
              <Text style={[s.dayTop, on && s.onText]}>{monthName(item)}</Text>
            </Pressable>
          );
        }}
      />

      {GROUPS.map(g => {
        const slots = SLOTS.filter(m => m >= g.from && m < g.to);
        if (slots.every(m => at(m) < floor)) return null; // e.g. this morning has already passed
        return (
          <View key={g.label}>
            <Text style={s.group}>{t(g.label)}</Text>
            <View style={s.slots}>
              {slots.map(m => {
                const time = at(m);
                const past = time < floor;
                const on = minutes === m;
                return (
                  <Pressable key={m} disabled={past} onPress={() => setMinutes(m)}
                    style={[s.slot, on && s.dayOn, past && { opacity: 0.35 }]} accessibilityState={{ selected: on, disabled: past }}>
                    <Text style={[s.slotText, on && s.onText]}>{formatTime(time)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      <Button title={selected ? t('Set {time}', { time: formatTime(selected) }) : t('Pick a time')} disabled={!selected || selected < floor}
        onPress={() => { if (selected) { onConfirm(selected); onClose(); } }} style={{ marginTop: spacing.lg }} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  day: { width: 58, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderMid,
    alignItems: 'center', backgroundColor: colors.white },
  dayOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayTop: { fontSize: 11, fontWeight: '700', color: colors.muted },
  dayNum: { fontSize: 20, fontWeight: '800', color: colors.dark, marginVertical: 1 },
  onText: { color: colors.white },
  group: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '23%', height: 38, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.borderMid,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  slotText: { fontSize: 13, fontWeight: '700', color: colors.body },
});
