// Pick a photo (camera or gallery), shrink it on the phone, upload it.
// Photos are resized to at most 1280px and JPEG-compressed before upload, so a
// 12 MP camera shot (~4 MB) becomes ~200 KB — fast on slow mobile data.
import { Alert } from 'react-native';
import { launchCamera, launchImageLibrary, type ImagePickerResponse } from 'react-native-image-picker';
import { api, errorMessage } from '../api';
import { t } from '../i18n';

const OPTIONS = {
  mediaType: 'photo' as const,
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.8 as const, // PhotoQuality only allows steps of 0.1
  includeBase64: true,
  selectionLimit: 1,
};

type Source = 'camera' | 'library';

function chooseSource(allowRemove: boolean): Promise<Source | 'remove' | null> {
  return new Promise(resolve => {
    Alert.alert(t('Add a photo'), undefined, [
      { text: t('Take photo'), onPress: () => resolve('camera') },
      { text: t('Choose from gallery'), onPress: () => resolve('library') },
      ...(allowRemove ? [{ text: t('Remove photo'), style: 'destructive' as const, onPress: () => resolve('remove' as const) }] : []),
      { text: t('Cancel'), style: 'cancel' as const, onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

async function pick(source: Source): Promise<string | null> {
  let res: ImagePickerResponse;
  try {
    res = source === 'camera'
      ? await launchCamera({ ...OPTIONS, saveToPhotos: false, cameraType: 'back' })
      : await launchImageLibrary(OPTIONS);
  } catch {
    throw new Error(t('Could not open the camera or gallery.'));
  }
  if (res.didCancel) return null;
  if (res.errorCode) {
    throw new Error(res.errorCode === 'camera_unavailable'
      ? t('No camera is available on this device.')
      : res.errorCode === 'permission'
        ? t('GigSwipe needs permission to use the camera. You can allow it in Settings.')
        : t('Could not open the camera or gallery.'));
  }
  return res.assets?.[0]?.base64 ?? null;
}

/**
 * Lets the user pick a photo and uploads it.
 * Resolves to the uploaded path, `null` if they removed the photo, or `undefined` if cancelled.
 */
export async function pickAndUploadPhoto(opts: { allowRemove?: boolean } = {}): Promise<string | null | undefined> {
  const source = await chooseSource(!!opts.allowRemove);
  if (!source) return undefined;
  if (source === 'remove') return null;
  try {
    const base64 = await pick(source);
    if (!base64) return undefined;
    const { url } = await api.uploads.image(base64);
    return url;
  } catch (e) {
    Alert.alert(t('Photo not added'), errorMessage(e));
    return undefined;
  }
}
