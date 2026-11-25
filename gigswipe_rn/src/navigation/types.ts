import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { Role } from '../api/types';

export type WorkerTabParams = {
  Discover: undefined;
  Matches: undefined;
  WorkerProfile: undefined;
};

export type BusinessTabParams = {
  Dashboard: undefined;
  PostGig: undefined;
  FindWorkers: undefined;
  Messages: undefined;
  BusinessProfile: undefined;
};

export type RootStackParams = {
  // Signed out
  Welcome: undefined;
  Role: undefined;
  Login: undefined;
  Register: { role: Role };
  ForgotPassword: { email?: string } | undefined;
  // Signed in
  WorkerTabs: NavigatorScreenParams<WorkerTabParams> | undefined;
  BusinessTabs: NavigatorScreenParams<BusinessTabParams> | undefined;
  GigDetail: { gigId: string };
  GigsMap: undefined;
  SavedGigs: undefined;
  GigEditor: { gigId: string; mode: 'edit' | 'duplicate' };
  Applicants: { gigId: string; title?: string };
  Chat: { applicationId: string };
  UserProfile: { userId: string };
};

export type RootScreen<T extends keyof RootStackParams> = NativeStackScreenProps<RootStackParams, T>;

export type WorkerTabScreen<T extends keyof WorkerTabParams> = CompositeScreenProps<
  BottomTabScreenProps<WorkerTabParams, T>,
  NativeStackScreenProps<RootStackParams>
>;

export type BusinessTabScreen<T extends keyof BusinessTabParams> = CompositeScreenProps<
  BottomTabScreenProps<BusinessTabParams, T>,
  NativeStackScreenProps<RootStackParams>
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParams {}
  }
}
