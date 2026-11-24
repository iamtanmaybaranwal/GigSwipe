import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, PanResponder, Pressable, ScrollView, StyleSheet, Text, Vibration, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api, errorMessage, type Gig } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, shadow, tint } from '../../theme';
import { Avatar, Banner, EmptyState, ErrorView, IconButton, Loading, Pill } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { distanceLabel, plural, toast } from '../../utils/format';
import type { WorkerTabScreen } from '../../navigation/types';

const { width: SW } = Dimensions.get('window');
const SWIPE_THRESHOLD = SW * 0.28;
type Filter = 'all' | 'onsite' | 'remote';

export default function FeedScreen({ navigation }: WorkerTabScreen<'Discover'>) {
  const { user } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [applied, setApplied] = useState(0);
  const loadedOnce = useRef(false);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const { gigs: list } = await api.gigs.feed();
      setGigs(list);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
      loadedOnce.current = true;
    }
  }, []);

  // Reload when coming back to the tab (e.g. after changing range in Profile),
  // but don't reshuffle the deck every time a detail screen is closed.
  const lastLoc = useRef('');
  useFocusEffect(useCallback(() => {
    const key = `${user?.latitude},${user?.longitude},${user?.radiusMiles}`;
    if (!loadedOnce.current || key !== lastLoc.current) {
      lastLoc.current = key;
      load(!loadedOnce.current);
    }
  }, [load, user?.latitude, user?.longitude, user?.radiusMiles]));

  const visible = useMemo(
    () => gigs.filter(g => filter === 'all' || g.workMode === filter),
    [gigs, filter]
  );

  const removeGig = (id: string) => setGigs(p => p.filter(g => g.id !== id));

  const onSwipe = useCallback(async (gig: Gig, dir: 'left' | 'right') => {
    removeGig(gig.id);
    if (dir === 'left') return;
    Vibration.vibrate(15);
    try {
      const { alreadyApplied } = await api.applications.apply(gig.id);
      setApplied(n => n + 1);
      toast(alreadyApplied ? 'You already applied — see Matches' : `Applied to ${gig.title}. Chat is open in Matches.`);
    } catch (e) {
      toast(`Couldn't apply: ${errorMessage(e)}`);
      setGigs(p => [gig, ...p]); // put it back so they can try again
    }
  }, []);

  const hasLocation = user?.latitude != null && user?.longitude != null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.logo}>GigSwipe</Text>
        <View style={s.headerRight}>
          <IconButton name="map-outline" label="Map of nearby gigs" color={colors.accent} bg={colors.accentLight}
            onPress={() => navigation.navigate('GigsMap')} />
          <Pressable onPress={() => navigation.navigate('WorkerProfile')} accessibilityLabel="Your profile">
            <Avatar name={user?.name} color={user?.avatarColor} size={40} />
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters} style={{ flexGrow: 0 }}>
        {([['all', 'All gigs', 'apps-outline'], ['onsite', 'On-site', 'business-outline'], ['remote', 'Remote', 'home-outline']] as const)
          .map(([key, label, icon]) => (
            <Pressable key={key} onPress={() => setFilter(key)} style={[s.filter, filter === key && s.filterOn]}>
              <Icon name={icon} size={14} color={filter === key ? colors.white : colors.muted} />
              <Text style={[s.filterText, filter === key && { color: colors.white }]}>{label}</Text>
            </Pressable>
          ))}
      </ScrollView>

      {!hasLocation && (
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <Banner icon="locate-outline" text="Set your location to see the closest gigs first." action="Set up"
            onPress={() => navigation.navigate('WorkerProfile')} />
        </View>
      )}

      <View style={s.deckArea}>
        {loading ? (
          <Loading text="Finding gigs near you…" />
        ) : error && gigs.length === 0 ? (
          <ErrorView message={error} onRetry={() => load(true)} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title={gigs.length ? 'No gigs match this filter' : "You're all caught up!"}
            message={applied > 0
              ? `You applied to ${plural(applied, 'gig')}. Check Matches for replies.`
              : hasLocation ? 'New gigs are posted every day. Try a bigger range in your profile, or check back soon.'
              : 'New gigs are posted every day — check back soon.'}
            action="Refresh"
            onAction={() => load(true)}
          />
        ) : (
          <SwipeDeck
            gigs={visible}
            onSwipe={onSwipe}
            onOpen={g => navigation.navigate('GigDetail', { gigId: g.id })}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Swipe deck ────────────────────────────────────────────────────────────────
function SwipeDeck({ gigs, onSwipe, onOpen }: {
  gigs: Gig[]; onSwipe: (g: Gig, dir: 'left' | 'right') => void; onOpen: (g: Gig) => void;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const busy = useRef(false);
  const top = gigs[0]!;
  const topRef = useRef(top);
  topRef.current = top;
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  // New top card → reset the position before paint (prevents a flash of the old card)
  useLayoutEffect(() => {
    position.setValue({ x: 0, y: 0 });
    busy.current = false;
  }, [top.id, position]);

  const fling = useCallback((dir: 'left' | 'right') => {
    if (busy.current) return;
    busy.current = true;
    const gig = topRef.current;
    Animated.timing(position, {
      toValue: { x: (dir === 'right' ? 1 : -1) * SW * 1.4, y: 40 },
      duration: 240,
      useNativeDriver: true,
    }).start(() => onSwipeRef.current(gig, dir));
  }, [position]);

  const pan = useMemo(() => PanResponder.create({
    // Only claim clearly horizontal drags, so taps and vertical scrolls still work
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderMove: (_, g) => { if (!busy.current) position.setValue({ x: g.dx, y: g.dy * 0.15 }); },
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD || g.vx > 0.9) fling('right');
      else if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.9) fling('left');
      else Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () =>
      Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: true }).start(),
  }), [fling, position]);

  const rotate = position.x.interpolate({ inputRange: [-SW / 2, 0, SW / 2], outputRange: ['-12deg', '0deg', '12deg'], extrapolate: 'clamp' });
  const likeOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD * 0.6], outputRange: [0, 1], extrapolate: 'clamp' });
  const skipOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD * 0.6, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const nextScale = position.x.interpolate({ inputRange: [-SW / 2, 0, SW / 2], outputRange: [1, 0.95, 1], extrapolate: 'clamp' });

  return (
    <View style={{ flex: 1 }}>
      <View style={s.deck}>
        {gigs[1] ? (
          <Animated.View key={gigs[1].id} style={[s.cardWrap, { transform: [{ scale: nextScale }], opacity: 0.9 }]} pointerEvents="none">
            <GigCard gig={gigs[1]} />
          </Animated.View>
        ) : null}
        <Animated.View
          key={top.id}
          style={[s.cardWrap, { transform: [...position.getTranslateTransform(), { rotate }] }]}
          {...pan.panHandlers}
        >
          <GigCard gig={top} onOpen={() => onOpen(top)} />
          <Animated.View style={[s.stamp, s.stampLike, { opacity: likeOpacity }]} pointerEvents="none">
            <Text style={[s.stampText, { color: colors.green }]}>APPLY</Text>
          </Animated.View>
          <Animated.View style={[s.stamp, s.stampSkip, { opacity: skipOpacity }]} pointerEvents="none">
            <Text style={[s.stampText, { color: colors.red }]}>SKIP</Text>
          </Animated.View>
        </Animated.View>
      </View>

      <View style={s.actions}>
        <RoundAction icon="close" color={colors.red} bg={colors.redLight} size={64} label="Skip" onPress={() => fling('left')} />
        <RoundAction icon="information" color={colors.blue} bg={colors.blueLight} size={50} label="Details" onPress={() => onOpen(top)} />
        <RoundAction icon="heart" color={colors.green} bg={colors.greenLight} size={64} label="Apply" onPress={() => fling('right')} />
      </View>
      <Text style={s.remaining}>{plural(gigs.length, 'gig')} to go · swipe right to apply</Text>
    </View>
  );
}

function GigCard({ gig, onOpen }: { gig: Gig; onOpen?: () => void }) {
  const c = gig.businessColor || colors.accent;
  return (
    <View style={s.card}>
      <View style={[s.cardTop, { backgroundColor: tint(c, 0.12) }]}>
        <Avatar name={gig.businessName} color={c} size={48} square />
        <View style={{ flex: 1 }}>
          <Text style={s.biz} numberOfLines={1}>{gig.businessName}</Text>
          <Text style={s.posted}>{gig.postedAt}</Text>
        </View>
        <Pill text={gig.category} color={c} />
      </View>

      <View style={s.cardBody}>
        <Text style={s.title} numberOfLines={2}>{gig.title}</Text>
        <View style={s.stats}>
          <Stat icon="cash-outline" text={gig.pay} strong />
          <Stat icon="time-outline" text={gig.hours} />
          {gig.workMode === 'remote'
            ? <Stat icon="home-outline" text="Remote · work from home" />
            : <Stat icon="location-outline" text={[gig.location, distanceLabel(gig.distanceMiles)].filter(Boolean).join(' · ')} />}
        </View>
        <Text style={s.desc} numberOfLines={5}>{gig.description}</Text>
      </View>

      {onOpen ? (
        <Pressable onPress={onOpen} style={[s.detailsBtn, { borderColor: tint(c, 0.35) }]}>
          <Text style={[s.detailsText, { color: c }]}>View details</Text>
          <Icon name="arrow-forward" size={15} color={c} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Stat({ icon, text, strong }: { icon: IconName; text: string; strong?: boolean }) {
  return (
    <View style={s.stat}>
      <Icon name={icon} size={15} color={strong ? colors.green : colors.muted} />
      <Text style={[s.statText, strong && { color: colors.dark, fontWeight: '700' }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function RoundAction({ icon, color, bg, size, label, onPress }: {
  icon: IconName; color: string; bg: string; size: number; label: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [s.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, pressed && { transform: [{ scale: 0.92 }] }]}>
      <Icon name={icon} size={size * 0.42} color={color} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  logo: { fontSize: 26, fontWeight: '900', color: colors.accent, letterSpacing: -0.8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 10 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: radius.pill,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderMid },
  filterOn: { backgroundColor: colors.dark, borderColor: colors.dark },
  filterText: { fontSize: 13, fontWeight: '700', color: colors.muted },

  deckArea: { flex: 1 },
  deck: { flex: 1, marginHorizontal: 20, marginTop: 4 },
  cardWrap: { ...StyleSheet.absoluteFill },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.xxl, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderMid, ...shadow.raised },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  biz: { fontSize: 16, fontWeight: '800', color: colors.dark },
  posted: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cardBody: { flex: 1, padding: 20, paddingTop: 16 },
  title: { fontSize: 26, fontWeight: '800', color: colors.dark, letterSpacing: -0.5, marginBottom: 14 },
  stats: { gap: 10, marginBottom: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statText: { fontSize: 15, color: colors.body, flex: 1 },
  desc: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, margin: 16, marginTop: 0,
    height: 46, borderRadius: radius.md, borderWidth: 1.5 },
  detailsText: { fontSize: 15, fontWeight: '700' },

  stamp: { position: 'absolute', top: 26, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 3, backgroundColor: colors.white },
  stampLike: { left: 22, borderColor: colors.green, transform: [{ rotate: '-14deg' }] },
  stampSkip: { right: 22, borderColor: colors.red, transform: [{ rotate: '14deg' }] },
  stampText: { fontSize: 24, fontWeight: '900', letterSpacing: 2 },

  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 26, paddingTop: 18, paddingBottom: 6 },
  round: { alignItems: 'center', justifyContent: 'center', ...shadow.card },
  remaining: { textAlign: 'center', fontSize: 12, color: colors.subtle, paddingBottom: 12 },
});
