// Web version of the photo picker: the browser's file chooser (on phones it
// offers both the camera and the gallery), shrunk to max 1280px JPEG before upload.
import { Alert } from 'react-native';
import { api, errorMessage } from '../api';
import { t } from '../i18n';

const MAX = 1280;

function chooseFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    let done = false;
    const finish = (f: File | null) => { if (!done) { done = true; resolve(f); input.remove(); } };
    input.onchange = () => finish(input.files?.[0] ?? null);
    // Detect "cancel": focus returns to the page without a file
    window.addEventListener('focus', () => setTimeout(() => finish(input.files?.[0] ?? null), 800), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(t('The image could not be read.')));
      i.src = url;
    });
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]!;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function askRemoveOrReplace(): Promise<'remove' | 'replace' | null> {
  return new Promise(resolve => {
    Alert.alert(t('Add a photo'), undefined, [
      { text: t('Choose from gallery'), onPress: () => resolve('replace') },
      { text: t('Remove photo'), style: 'destructive', onPress: () => resolve('remove') },
      { text: t('Cancel'), style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

/** Same contract as the native version: path, null (removed) or undefined (cancelled). */
export async function pickAndUploadPhoto(opts: { allowRemove?: boolean } = {}): Promise<string | null | undefined> {
  if (opts.allowRemove) {
    const choice = await askRemoveOrReplace();
    if (!choice) return undefined;
    if (choice === 'remove') return null;
  }
  const file = await chooseFile();
  if (!file) return undefined;
  try {
    const { url } = await api.uploads.image(await shrink(file));
    return url;
  } catch (e) {
    Alert.alert(t('Photo not added'), errorMessage(e));
    return undefined;
  }
}
