// Web / PWA entry point. Same App as the phone, rendered with react-native-web.
import { AppRegistry } from 'react-native';
import ioniconsFont from '@react-native-vector-icons/ionicons/fonts/Ionicons.ttf?url';
import App from '../App';
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
