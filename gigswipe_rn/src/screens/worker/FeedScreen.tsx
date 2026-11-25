import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api, errorMessage, mediaUrl, type Gig } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n';
import { colors, radius, shadow, tint } from '../../theme';
import { Avatar, Banner, EmptyState, ErrorView, IconButton, Loading, Pill } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { AvailableNowPill } from '../../components/AvailableNow';
import {
  activeFilterCount, DATE_OPTIONS, DEFAULT_FEED_PREFS, FeedFilterSheet, loadFeedPrefs, saveFeedPrefs, toFeedQuery, type FeedPrefs,
} from '../../components/FeedFilterSheet';
import { distanceLabel, formatSchedule, payText, plural, startsIn, toast, timeAgo } from '../../utils/format';
import type { WorkerTabScreen } from '../../navigation/types';

const { width: SW, height: SH } = Dimensions.get('window');
const SWIPE_X = SW * 0.28;
const SWIPE_UP = SH * 0.14;
type SwipeDir = 'left' | 'right' | 'up';
type UndoEntry = { gig: Gig; dir: SwipeDir; applicationId?: string };
const MAX_UNDO = 10;

export default function FeedScreen({ navigation }: WorkerTabScreen<'Discover'>) {
  const { user } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(0);
  const [filters, setFilters] = useState<FeedPrefs>(loadFeedPrefs);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [undo, setUndo] = useState<UndoEntry[]>([]);
  const [undoing, setUndoing] = useState(false);
  const loadedOnce = useRef(false);
  const reqId = useRef(0);

  const load = useCallback(async (showSpinner = false, f: FeedPrefs = filters) => {
    const id = ++reqId.current;
    if (showSpinner) setLoading(true);
    try {
      const { gigs: list } = await api.gigs.feed(toFeedQuery(f));
      if (id !== reqId.current) return;
      setGigs(list);
      setError(null);
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e));
    } finally {
      if (id === reqId.current) setLoading(false);
      loadedOnce.current = true;
    }
  }, [filters]);

  const applyFilters = (next: FeedPrefs) => {
    setFilters(next);
    saveFeedPrefs(next);
    setUndo([]);
    load(true, next);
  };

  // Reload when coming back to the tab after the location/range changed,
  // but don't reshuffle the deck every time a detail screen is closed.
  const lastLoc = useRef('');
  useFocusEffect(useCallback(() => {
    const key = `${user?.latitude},${user?.longitude},${user?.radiusMiles}`;
    if (!loadedOnce.current || key !== lastLoc.current) {
      lastLoc.current = key;
      load(!loadedOnce.current);
    }
  }, [load, user?.latitude, user?.longitude, user?.radiusMiles]));

  // Search as you type (debounced)
  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => applyFilters({ ...filters, q: search }), 450);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const pushUndo = (e: UndoEntry) => setUndo(u => [e, ...u].slice(0, MAX_UNDO));
  const putBack = (gig: Gig) => setGigs(p => [gig, ...p.filter(g => g.id !== gig.id)]);

  const onSwipe = useCallback(async (gig: Gig, dir: SwipeDir) => {
    setGigs(p => p.filter(g => g.id !== gig.id));
    if (dir === 'left') { pushUndo({ gig, dir }); return; }
    Vibration.vibrate(15);
    if (dir === 'up') {
      try {
        await api.saved.add(gig.id);
        pushUndo({ gig, dir });
        toast(t('Saved for later. Find it under the bookmark at the top.'));
      } catch (e) {
        toast(t("Couldn't save: {error}", { error: errorMessage(e) }));
        putBack(gig);
      }
      return;
    }
    try {
      const { application, alreadyApplied } = await api.applications.apply(gig.id);
      setApplied(n => n + 1);
      pushUndo({ gig, dir, applicationId: alreadyApplied ? undefined : application.id });
      toast(alreadyApplied ? t('You already applied. See Matches.') : t('Applied to {title}. Chat is open in Matches.', { title: gig.title }));
    } catch (e) {
      toast(t("Couldn't apply: {error}", { error: errorMessage(e) }));
      putBack(gig); // so they can try again
    }
  }, []);

  const undoLast = async () => {
    const last = undo[0];
    if (!last || undoing) return;
    setUndoing(true);
    try {
      if (last.dir === 'up') await api.saved.remove(last.gig.id);
      if (last.dir === 'right' && last.applicationId) {
        await api.applications.withdraw(last.applicationId);
        setApplied(n => Math.max(0, n - 1));
      }
      setUndo(u => u.slice(1));
      putBack(last.gig);
      toast(last.dir === 'right' ? t('Application withdrawn') : last.dir === 'up' ? t('Removed from saved') : t('Gig brought back'));
    } catch (e) {
      toast(errorMessage(e));
      setUndo(u => u.slice(1));
    } finally {
      setUndoing(false);
    }
  };

  const hasLocation = user?.latitude != null && user?.longitude != null;
  const filterCount = activeFilterCount(filters);
  const quickDate = (key: FeedPrefs['date']) => applyFilters({ ...filters, date: filters.date === key ? 'any' : key });
  const quickMode = (key: FeedPrefs['mode']) => applyFilters({ ...filters, mode: filters.mode === key ? 'any' : key });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.logo}>GigSwipe</Text>
        <View style={s.headerRight}>
          <AvailableNowPill />
          <IconButton name="bookmark-outline" label={t('Saved gigs')} color={colors.dark} bg={colors.white}
            onPress={() => navigation.navigate('SavedGigs')} />
          <IconButton name="map-outline" label={t('Map of nearby gigs')} color={colors.accent} bg={colors.accentLight}
            onPress={() => navigation.navigate('GigsMap')} />
          <Pressable onPress={() => navigation.navigate('WorkerProfile')} accessibilityLabel={t('Your profile')}>
            <Avatar name={user?.name} color={user?.avatarColor} photo={user?.photoUrl} size={38} />
          </Pressable>
        </View>
      </View>

      <View style={s.searchRow}>
        <View style={s.search}>
          <Icon name="search" size={17} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('Search gigs, skills, places…')}
            placeholderTextColor={colors.placeholder} style={s.searchInput} returnKeyType="search" maxLength={60}
            onSubmitEditing={() => applyFilters({ ...filters, q: search })} />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel={t('Clear search')}>
              <Icon name="close-circle" size={18} color={colors.subtle} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={[s.filterBtn, filterCount > 0 && s.filterBtnOn]} onPress={() => setFilterOpen(true)}
          accessibilityLabel={t('Filters')}>
          <Icon name="options-outline" size={20} color={filterCount ? colors.white : colors.dark} />
          {filterCount ? <View style={s.badge}><Text style={s.badgeText}>{filterCount}</Text></View> : null}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quick} style={{ flexGrow: 0 }}>
        {DATE_OPTIONS.filter(o => o.key !== 'any').map(o => (
          <QuickChip key={o.key} label={t(o.label)} on={filters.date === o.key} onPress={() => quickDate(o.key)} />
        ))}
        <QuickChip label={t('On-site')} icon="business-outline" on={filters.mode === 'onsite'} onPress={() => quickMode('onsite')} />
        <QuickChip label={t('Remote')} icon="home-outline" on={filters.mode === 'remote'} onPress={() => quickMode('remote')} />
      </ScrollView>

      {!hasLocation && (
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <Banner icon="locate-outline" text={t('Set your location to see the closest gigs first.')} action={t('Set up')}
            onPress={() => navigation.navigate('WorkerProfile')} />
        </View>
      )}

      <View style={s.deckArea}>
        {loading ? (
          <Loading text={t('Finding gigs near you…')} />
        ) : error && gigs.length === 0 ? (
          <ErrorView message={error} onRetry={() => load(true)} />
        ) : gigs.length === 0 ? (
          <View style={{ flex: 1 }}>
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={filterCount || filters.q ? t('No gigs match your filters') : t("You're all caught up!")}
              message={filterCount || filters.q
                ? t('Try removing a filter or searching for something else.')
                : applied > 0
                  ? t('You applied to {gigs}. Check Matches for replies.', { gigs: plural(applied, 'gig') })
                  : hasLocation ? t('New gigs are posted every day. Try a bigger range in your profile, or check back soon.')
                  : t('New gigs are posted every day. Check back soon.')}
              action={filterCount || filters.q ? t('Clear filters') : t('Refresh')}
              onAction={() => { if (filterCount || filters.q) { setSearch(''); applyFilters(DEFAULT_FEED_PREFS); } else load(true); }}
            />
            {undo.length ? <UndoBar onPress={undoLast} busy={undoing} /> : null}
          </View>
        ) : (
          <SwipeDeck
            gigs={gigs}
            onSwipe={onSwipe}
            onOpen={g => navigation.navigate('GigDetail', { gigId: g.id })}
            canUndo={undo.length > 0 && !undoing}
            onUndo={undoLast}
          />
        )}
      </View>

      <FeedFilterSheet visible={filterOpen} value={filters} profileRadius={user?.radiusMiles}
        onClose={() => setFilterOpen(false)} onApply={applyFilters} />
    </SafeAreaView>
  );
}

function QuickChip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} style={[s.qchip, on && s.qchipOn]} accessibilityState={{ selected: on }}>
      {icon ? <Icon name={icon} size={14} color={on ? colors.white : colors.muted} /> : null}
      <Text style={[s.qchipText, on && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

function UndoBar({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <Pressable style={s.undoBar} onPress={onPress} disabled={busy}>
      <Icon name="arrow-undo" size={16} color={colors.accent} />
      <Text style={s.undoText}>{t('Undo last swipe')}</Text>
    </Pressable>
  );
}

// ── Swipe deck ────────────────────────────────────────────────────────────────
function SwipeDeck({ gigs, onSwipe, onOpen, canUndo, onUndo }: {
  gigs: Gig[]; onSwipe: (g: Gig, dir: SwipeDir) => void; onOpen: (g: Gig) => void; canUndo: boolean; onUndo: () => void;
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

  const fling = useCallback((dir: SwipeDir) => {
    if (busy.current) return;
    busy.current = true;
    const gig = topRef.current;
    Animated.timing(position, {
      toValue: dir === 'up' ? { x: 0, y: -SH } : { x: (dir === 'right' ? 1 : -1) * SW * 1.4, y: 40 },
      duration: 240,
      useNativeDriver: true,
    }).start(() => onSwipeRef.current(gig, dir));
  }, [position]);

  const springBack = useCallback(
    () => Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: true }).start(),
    [position]
  );

  const pan = useMemo(() => PanResponder.create({
    // Claim horizontal drags (skip / apply) and clear upward drags (save) only,
    // so taps on the card's buttons still work.
    onMoveShouldSetPanResponder: (_, g) =>
      (Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2) || (g.dy < -12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2),
    onPanResponderMove: (_, g) => { if (!busy.current) position.setValue({ x: g.dx, y: Math.min(g.dy, 40) }); },
    onPanResponderRelease: (_, g) => {
      const vertical = Math.abs(g.dy) > Math.abs(g.dx);
      if (vertical && (g.dy < -SWIPE_UP || g.vy < -1.1)) fling('up');
      else if (!vertical && (g.dx > SWIPE_X || g.vx > 0.9)) fling('right');
      else if (!vertical && (g.dx < -SWIPE_X || g.vx < -0.9)) fling('left');
      else springBack();
    },
    onPanResponderTerminate: springBack,
  }), [fling, position, springBack]);

  const rotate = position.x.interpolate({ inputRange: [-SW / 2, 0, SW / 2], outputRange: ['-12deg', '0deg', '12deg'], extrapolate: 'clamp' });
  const likeOpacity = position.x.interpolate({ inputRange: [0, SWIPE_X * 0.6], outputRange: [0, 1], extrapolate: 'clamp' });
  const skipOpacity = position.x.interpolate({ inputRange: [-SWIPE_X * 0.6, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const saveOpacity = position.y.interpolate({ inputRange: [-SWIPE_UP * 0.7, 0], outputRange: [1, 0], extrapolate: 'clamp' });
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
            <Text style={[s.stampText, { color: colors.green }]}>{t('APPLY')}</Text>
          </Animated.View>
          <Animated.View style={[s.stamp, s.stampSkip, { opacity: skipOpacity }]} pointerEvents="none">
            <Text style={[s.stampText, { color: colors.red }]}>{t('SKIP')}</Text>
          </Animated.View>
          <Animated.View style={[s.stamp, s.stampSave, { opacity: saveOpacity }]} pointerEvents="none">
            <Text style={[s.stampText, { color: colors.blue }]}>{t('SAVE')}</Text>
          </Animated.View>
        </Animated.View>
      </View>

      <View style={s.actions}>
        <RoundAction icon="arrow-undo" color={colors.amber} bg={colors.amberLight} size={44} label={t('Undo last swipe')}
          onPress={onUndo} disabled={!canUndo} />
        <RoundAction icon="close" color={colors.red} bg={colors.redLight} size={62} label={t('Skip')} onPress={() => fling('left')} />
        <RoundAction icon="bookmark" color={colors.blue} bg={colors.blueLight} size={50} label={t('Save for later')} onPress={() => fling('up')} />
        <RoundAction icon="heart" color={colors.green} bg={colors.greenLight} size={62} label={t('Apply')} onPress={() => fling('right')} />
        <RoundAction icon="information" color={colors.muted} bg={colors.surfaceAlt} size={44} label={t('Details')} onPress={() => onOpen(top)} />
      </View>
      <Text style={s.remaining}>{t('{gigs} to go · right to apply · up to save', { gigs: plural(gigs.length, 'gig') })}</Text>
    </View>
  );
}

function GigCard({ gig, onOpen }: { gig: Gig; onOpen?: () => void }) {
  const c = gig.businessColor || colors.accent;
  const cover = gig.photos?.[0];
  return (
    <View style={s.card}>
      {cover ? (
        <View>
          <Image source={{ uri: mediaUrl(cover) }} style={s.cover} resizeMode="cover" />
          {gig.photos.length > 1 ? (
            <View style={s.photoCount}><Icon name="images-outline" size={12} color={colors.white} /><Text style={s.photoCountText}>{gig.photos.length}</Text></View>
          ) : null}
        </View>
      ) : null}
      <View style={[s.cardTop, { backgroundColor: tint(c, 0.12) }]}>
        <Avatar name={gig.businessName} color={c} photo={gig.businessPhotoUrl} size={cover ? 40 : 48} square />
        <View style={{ flex: 1 }}>
          <Text style={s.biz} numberOfLines={1}>{gig.businessName}</Text>
          <Text style={s.posted}>{timeAgo(gig.createdAt)}</Text>
        </View>
        <Pill text={t(gig.category)} color={c} />
      </View>

      <View style={s.cardBody}>
        <Text style={[s.title, cover && { fontSize: 22, marginBottom: 10 }]} numberOfLines={2}>{gig.title}</Text>
        <View style={s.stats}>
          <Stat icon="cash-outline" text={payText(gig)} strong />
          {gig.startAt
            ? <Stat icon="calendar-outline" text={`${formatSchedule(gig.startAt, gig.endAt)}`} />
            : gig.hours ? <Stat icon="time-outline" text={gig.hours} /> : <Stat icon="time-outline" text={t('Flexible timing')} />}
          {gig.workMode === 'remote'
            ? <Stat icon="home-outline" text={t('Remote · work from home')} />
            : <Stat icon="location-outline" text={[gig.location, distanceLabel(gig.distanceMiles)].filter(Boolean).join(' · ')} />}
        </View>
        <View style={s.tags}>
          {gig.startAt ? <Pill text={startsIn(gig.startAt, gig.endAt)} color={colors.amber} icon="time-outline" /> : null}
          {gig.openings > 1 ? <Pill text={t('{n} spots left', { n: gig.spotsLeft })} color={colors.blue} icon="people-outline" /> : null}
        </View>
        <Text style={s.desc} numberOfLines={cover ? 2 : 4}>{gig.description}</Text>
      </View>

      {onOpen ? (
        <Pressable onPress={onOpen} style={[s.detailsBtn, { borderColor: tint(c, 0.35) }]}>
          <Text style={[s.detailsText, { color: c }]}>{t('View details')}</Text>
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

function RoundAction({ icon, color, bg, size, label, onPress, disabled }: {
  icon: IconName; color: string; bg: string; size: number; label: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        pressed && !disabled && { transform: [{ scale: 0.92 }] }, disabled && { opacity: 0.35 }]}>
      <Icon name={icon} size={size * 0.42} color={color} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  logo: { fontSize: 22, fontWeight: '900', color: colors.accent, letterSpacing: -0.8, flexShrink: 1, marginRight: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: radius.md,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderMid },
  searchInput: { flex: 1, fontSize: 14, color: colors.dark, paddingVertical: 0 },
  filterBtn: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderMid },
  filterBtnOn: { backgroundColor: colors.dark, borderColor: colors.dark },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.white },

  quick: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  qchip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, height: 32, borderRadius: radius.pill,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderMid },
  qchipOn: { backgroundColor: colors.dark, borderColor: colors.dark },
  qchipText: { fontSize: 12, fontWeight: '700', color: colors.muted },

  deckArea: { flex: 1 },
  deck: { flex: 1, marginHorizontal: 16, marginTop: 2 },
  cardWrap: { ...StyleSheet.absoluteFill },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.xxl, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderMid, ...shadow.raised },
  cover: { width: '100%', height: 150, backgroundColor: colors.surfaceAlt },
  photoCount: { position: 'absolute', right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(15,23,42,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  photoCountText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  biz: { fontSize: 16, fontWeight: '800', color: colors.dark },
  posted: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cardBody: { flex: 1, padding: 18, paddingTop: 14 },
  title: { fontSize: 25, fontWeight: '800', color: colors.dark, letterSpacing: -0.5, marginBottom: 12 },
  stats: { gap: 9, marginBottom: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statText: { fontSize: 15, color: colors.body, flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  desc: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, margin: 14, marginTop: 0,
    height: 44, borderRadius: radius.md, borderWidth: 1.5 },
  detailsText: { fontSize: 15, fontWeight: '700' },

  stamp: { position: 'absolute', top: 26, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 3, backgroundColor: colors.white },
  stampLike: { left: 22, borderColor: colors.green, transform: [{ rotate: '-14deg' }] },
  stampSkip: { right: 22, borderColor: colors.red, transform: [{ rotate: '14deg' }] },
  stampSave: { alignSelf: 'center', top: undefined, bottom: 90, borderColor: colors.blue },
  stampText: { fontSize: 24, fontWeight: '900', letterSpacing: 2 },

  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, paddingTop: 14, paddingBottom: 4 },
  round: { alignItems: 'center', justifyContent: 'center', ...shadow.card },
  remaining: { textAlign: 'center', fontSize: 12, color: colors.subtle, paddingBottom: 10 },
  undoBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', marginBottom: 24,
    paddingHorizontal: 16, height: 40, borderRadius: radius.pill, backgroundColor: colors.accentLight },
  undoText: { fontSize: 14, fontWeight: '700', color: colors.accent },
});
