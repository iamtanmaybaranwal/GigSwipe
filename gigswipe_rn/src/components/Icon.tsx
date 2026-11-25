import React from 'react';
import { Ionicons, type IoniconsIconName } from '@react-native-vector-icons/ionicons/static';
import type { StyleProp, TextStyle } from 'react-native';

export type IconName = IoniconsIconName;

export function Icon({ name, size = 20, color, style }: {
  name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle>;
}) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
