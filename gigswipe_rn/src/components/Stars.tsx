import React from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '../theme';
import { Icon } from './Icon';

/** Read-only stars (supports halves) or, with onChange, a tappable picker. */
export function Stars({ value, size = 16, onChange, gap = 2 }: {
  value: number; size?: number; onChange?: (v: number) => void; gap?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap }} accessibilityRole={onChange ? 'adjustable' : 'image'}
      accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => {
        const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
        const star = <Icon name={name} size={size} color={value >= i - 0.5 ? colors.amber : colors.borderMid} />;
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} accessibilityLabel={`${i} star${i > 1 ? 's' : ''}`}>
            {star}
          </Pressable>
        ) : <View key={i}>{star}</View>;
      })}
    </View>
  );
}
