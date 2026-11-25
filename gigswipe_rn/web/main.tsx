// Web / PWA entry point. Same App as the phone, rendered with react-native-web.
import { AppRegistry } from 'react-native';
import ioniconsFont from '@react-native-vector-icons/ionicons/fonts/Ionicons.ttf?url';
import App from '../App';
import { registerSW } from 'virtual:pwa-register';
import { setupInstallPrompt } from './install';

// Icon font (the phone app bundles it natively)
const style = document.createElement('style');
style.textContent = `@font-face { font-family: 'Ionicons'; src: url(${ioniconsFont}) format('truetype'); font-display: block; }`;
document.head.appendChild(style);

AppRegistry.registerComponent('GigSwipe', () => App);
AppRegistry.runApplication('GigSwipe', {
  // react-native-web accepts a DOM element as the root (RN's types only know native tags)
  rootTag: document.getElementById('root') as never, initialProps: {} });

setupInstallPrompt();

// Updates go live without reopening the app: look for a new version every
// minute and whenever the app comes back to the screen. When one is found the
// new service worker takes over and the page reloads into it.
const UPDATE_CHECK_MS = 60 * 1000;
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => { if (navigator.onLine) registration.update().catch(() => {}); };
    setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  },
});
