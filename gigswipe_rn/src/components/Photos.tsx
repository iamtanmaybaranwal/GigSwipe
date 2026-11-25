// Gig photos: an editable grid (posting a gig) and a swipeable gallery (viewing one).
import React, { useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Image, Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mediaUrl } from '../api';
import { colors, radius } from '../theme';
import { t } from '../i18n';
import { pickAndUploadPhoto } from '../services/photos';
import { Icon } from './Icon';
import { IconButton } from './ui';

export function PhotoGridEditor({ photos, onChange, max }: { photos: string[]; onChange: (p: string[]) => void; max: number }) {
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const url = await pickAndUploadPhoto();
      if (url) onChange([...photos, url]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={s.grid}>
      {photos.map((p, i) => (
        <View key={p} style={s.tile}>
          <Image source={{ uri: mediaUrl(p) }} style={s.img} />
          <Pressable style={s.remove} onPress={() => onChange(photos.filter(x => x !== p))} hitSlop={6}
            accessibilityLabel={t('Remove photo')}>
            <Icon name="close" size={14} color={colors.white} />
          </Pressable>
          {i === 0 ? <View style={s.cover}><Text style={s.coverText}>{t('Cover')}</Text></View> : null}
        </View>
      ))}
      {photos.length < max ? (
        <Pressable style={[s.tile, s.add]} onPress={add} accessibilityLabel={t('Add a photo')}>
          {busy ? <ActivityIndicator color={colors.accent} /> : (
            <>
              <Icon name="camera-outline" size={24} color={colors.accent} />
              <Text style={s.addText}>{t('Add photo')}</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const { width: SW, height: SH } = Dimensions.get('window');

/** Horizontal photo strip; tapping opens a full-screen viewer. */
export function PhotoGallery({ photos, height = 220 }: { photos: string[]; height?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const insets = useSafeAreaInsets();
  if (!photos.length) return null;
  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        data={photos}
        keyExtractor={p => p}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / SW))}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => setOpen(index)}>
            <Image source={{ uri: mediaUrl(item) }} style={{ width: SW, height, backgroundColor: colors.surfaceAlt }} resizeMode="cover" />
          </Pressable>
        )}
      />
      {photos.length > 1 ? (
        <View style={s.dots}>
          {photos.map((p, i) => <View key={p} style={[s.dot, i === page && s.dotOn]} />)}
        </View>
      ) : null}

      <Modal visible={open != null} transparent animationType="fade" onRequestClose={() => setOpen(null)} statusBarTranslucent>
        <View style={s.viewer}>
          <FlatList
            horizontal
            pagingEnabled
            data={photos}
            initialScrollIndex={open ?? 0}
            getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
            keyExtractor={p => `full-${p}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Image source={{ uri: mediaUrl(item) }} style={{ width: SW, height: SH }} resizeMode="contain" />
            )}
          />
          <IconButton name="close" label={t('Close')} color={colors.white} bg="rgba(0,0,0,0.4)"
            onPress={() => setOpen(null)} style={[s.close, { top: insets.top + 8 }]} />
        </View>
      </Modal>
    </View>
  );
}

const TILE = (SW - 40 - 16) / 3;
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: TILE, height: TILE, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  img: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center', justifyContent: 'center' },
  cover: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(15,23,42,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  coverText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  add: { alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent,
    backgroundColor: colors.accentLight },
  addText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  dots: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotOn: { backgroundColor: colors.white, width: 16 },
  viewer: { flex: 1, backgroundColor: '#000' },
  close: { position: 'absolute', right: 12 },
});
