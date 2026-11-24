import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useAutoLocation, useSocketEvent } from '../hooks';
import { api } from '../api';
import { colors } from '../theme';
import { Icon, type IconName } from '../components/Icon';
import type { BusinessTabParams, RootStackParams, WorkerTabParams } from './types';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import RoleScreen from '../screens/auth/RoleScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import FeedScreen from '../screens/worker/FeedScreen';
import MatchesScreen from '../screens/worker/MatchesScreen';
import WorkerProfileScreen from '../screens/worker/WorkerProfileScreen';
import GigDetailScreen from '../screens/worker/GigDetailScreen';
import GigsMapScreen from '../screens/worker/GigsMapScreen';
import DashboardScreen from '../screens/business/DashboardScreen';
import PostGigScreen from '../screens/business/PostGigScreen';
import MessagesScreen from '../screens/business/MessagesScreen';
import BusinessProfileScreen from '../screens/business/BusinessProfileScreen';
import ApplicantsScreen from '../screens/business/ApplicantsScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import UserProfileScreen from '../screens/shared/UserProfileScreen';

const Stack = createNativeStackNavigator<RootStackParams>();
const WorkerTab = createBottomTabNavigator<WorkerTabParams>();
const BusinessTab = createBottomTabNavigator<BusinessTabParams>();

const tabOptions = (icon: IconName, iconActive: IconName, title: string, badge?: number) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) =>
    <Icon name={focused ? iconActive : icon} size={23} color={color} />,
  tabBarBadge: badge ? (badge > 99 ? '99+' : badge) : undefined,
});

const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.subtle,
  tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.borderMid },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
  tabBarBadgeStyle: { backgroundColor: colors.accent, fontSize: 10 },
};

/** Total unread messages, kept live by socket events. */
function useUnreadCount() {
  const [count, setCount] = useState(0);
  const refresh = React.useCallback(() => {
    api.applications.inbox()
      .then(({ conversations }) => setCount(conversations.reduce((n, c) => n + (c.unreadCount || 0), 0)))
      .catch(() => {});
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  useSocketEvent('inbox_update', refresh);
  useSocketEvent('application_update', refresh);
  useSocketEvent('connection_change', (up: boolean) => { if (up) refresh(); });
  return { count, refresh };
}

function WorkerTabs() {
  useAutoLocation();
  const unread = useUnreadCount();
  return (
    <WorkerTab.Navigator screenOptions={tabScreenOptions} screenListeners={{ focus: unread.refresh }}>
      <WorkerTab.Screen name="Discover" component={FeedScreen} options={tabOptions('layers-outline', 'layers', 'Discover')} />
      <WorkerTab.Screen name="Matches" component={MatchesScreen} options={tabOptions('chatbubbles-outline', 'chatbubbles', 'Matches', unread.count)} />
      <WorkerTab.Screen name="WorkerProfile" component={WorkerProfileScreen} options={tabOptions('person-outline', 'person', 'Profile')} />
    </WorkerTab.Navigator>
  );
}

function BusinessTabs() {
  useAutoLocation();
  const unread = useUnreadCount();
  return (
    <BusinessTab.Navigator screenOptions={tabScreenOptions} screenListeners={{ focus: unread.refresh }}>
      <BusinessTab.Screen name="Dashboard" component={DashboardScreen} options={tabOptions('briefcase-outline', 'briefcase', 'My Gigs')} />
      <BusinessTab.Screen name="PostGig" component={PostGigScreen} options={tabOptions('add-circle-outline', 'add-circle', 'Post Gig')} />
      <BusinessTab.Screen name="Messages" component={MessagesScreen} options={tabOptions('chatbubbles-outline', 'chatbubbles', 'Messages', unread.count)} />
      <BusinessTab.Screen name="BusinessProfile" component={BusinessProfileScreen} options={tabOptions('storefront-outline', 'storefront', 'Profile')} />
    </BusinessTab.Navigator>
  );
}

function Splash() {
  return (
    <View style={s.splash}>
      <View style={s.logo}><Text style={s.logoG}>G</Text></View>
      <Text style={s.brand}>GigSwipe</Text>
    </View>
  );
}

export default function RootNavigator() {
  const { status, user } = useAuth();
  if (status === 'loading') return <Splash />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.surface } }}>
      {status !== 'signedIn' || !user ? (
        <Stack.Group>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Role" component={RoleScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          {user.role === 'worker'
            ? <Stack.Screen name="WorkerTabs" component={WorkerTabs} />
            : <Stack.Screen name="BusinessTabs" component={BusinessTabs} />}
          <Stack.Screen name="GigDetail" component={GigDetailScreen} />
          <Stack.Screen name="GigsMap" component={GigsMapScreen} />
          <Stack.Screen name="Applicants" component={ApplicantsScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, gap: 16 },
  logo: { width: 88, height: 88, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  logoG: { fontSize: 48, fontWeight: '900', color: colors.white },
  brand: { fontSize: 28, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },
});
