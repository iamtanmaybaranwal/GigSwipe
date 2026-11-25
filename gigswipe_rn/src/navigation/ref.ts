// Lets code outside screens (notifications, deep links) navigate.
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParams } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParams>();
