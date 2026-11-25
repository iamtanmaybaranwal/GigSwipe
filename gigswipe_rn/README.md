# GigSwipe — React Native (Android)

The bare React Native version of GigSwipe (no Expo). It talks to the same backend in `../backend`.

- React Native **0.88.1** (New Architecture, Hermes), React 19, TypeScript
- Navigation: React Navigation 7 (native stack + bottom tabs)
- Maps: Leaflet + OpenStreetMap in `react-native-webview` (free, no API key or billing)
- Location: `@react-native-community/geolocation`
- Secure session storage: `react-native-keychain` (Android Keystore)
- Real-time chat: `socket.io-client`
- Icons: `@react-native-vector-icons/ionicons`
- Offline detection: `@react-native-community/netinfo`
- Photos: `react-native-image-picker` (camera + gallery, resized on the phone)
- Gig reminders + small settings storage: GigSwipe's own Turbo Native Module (`src/specs/NativeGigSwipe.ts` → `android/app/src/main/java/com/gigswipe/app/device/`)
- Languages: English + Hindi (`src/i18n/`)

---

## 1. One-time setup on your PC

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.11+ | `node -v` |
| JDK | **17** | Already in `D:\DevTools\jdk17`. Set `JAVA_HOME` to it (see below). |
| Android SDK | Platform 36/37, Build-tools, NDK | Already in `D:\DevTools\android-sdk`. Missing pieces download automatically on first build. |

Set `JAVA_HOME` permanently (PowerShell, run once, then **open a new terminal**):

```powershell
setx JAVA_HOME "D:\DevTools\jdk17"
```

> Your default `java` is JDK 25, which the Android build does not support. `JAVA_HOME` must point to JDK 17.

## 2. Configure

```powershell
cd gigswipe_rn
copy .env.example .env      # first time only
npm install
```

Edit `.env`:

```env
API_URL=http://localhost:3001            # debug builds (works over USB, see below)
API_URL_PRODUCTION=https://api.your-domain.com
CURRENCY_SYMBOL=₹                        # shown before pay amounts (same as backend/.env)
```

The map uses free OpenStreetMap tiles, so there's no key to set up. Before a big launch, point `MAP_TILE_URL` (and `MAP_TILE_ATTRIBUTION`) at a tile provider such as MapTiler. OpenStreetMap's own servers are meant for light use. Directions open the Google Maps app, which is free and needs no key.

## 3. Run on your phone with USB debugging

1. On the phone: **Settings → About phone → tap "Build number" 7 times**, then **Settings → Developer options → USB debugging: ON**.
2. Connect with a USB cable and tap **Allow** on the phone's "Allow USB debugging?" prompt.
3. Check it's detected: `adb devices` → shows your device as `device` (not `unauthorized`).
4. Start the backend in another terminal: `cd backend && npm run dev`
5. Run the app:

```powershell
cd gigswipe_rn
npm run android
```

`npm run android` automatically runs `adb reverse tcp:3001` and `tcp:8081`, so the phone reaches the backend and Metro on your PC through the USB cable. No Wi-Fi IP needed. If you unplug and replug the phone, run `npm run reverse` (or `npm run android` again).

The first build downloads Gradle dependencies and can take 10–20 minutes. Later builds take about a minute.

## 4. Useful commands

| Command | What it does |
|---|---|
| `npm run android` | Build, install and launch the debug app on the connected phone |
| `npm start` | Start Metro only (if the app is already installed) |
| `npm run start:clean` | Start Metro with a cleared cache (do this after editing `.env`) |
| `npm run reverse` | Re-create the USB port forwarding |
| `npm run typecheck` / `npm run lint` / `npm test` | Code checks |
| `npm run build:apk` | Release APK → `android/app/build/outputs/apk/release/` |
| `npm run build:aab` | Release bundle for the Play Store → `android/app/build/outputs/bundle/release/` |

## 5. Release builds (Play Store)

1. Create an upload key once:
   ```powershell
   keytool -genkeypair -v -storetype PKCS12 -keystore android/app/gigswipe-release.keystore -alias gigswipe -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Create `android/keystore.properties` (it is git-ignored. Back up both files somewhere safe, because losing them means you can't update the app):
   ```properties
   storeFile=gigswipe-release.keystore
   storePassword=YOUR_PASSWORD
   keyAlias=gigswipe
   keyPassword=YOUR_PASSWORD
   ```
3. Set `API_URL_PRODUCTION` to your **HTTPS** backend. Release builds block plain `http://`.
4. `npm run build:aab`, then upload the `.aab` in Google Play Console.

Without `keystore.properties`, release builds are signed with the debug key. That's fine for testing but **not** accepted by the Play Store.

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `Failed to get the SHA-1 for …` | Use the npm scripts (`npm start`, `npm run android`). They fix Windows drive-letter casing. |
| App shows "Can't reach GigSwipe" | Backend not running, or USB forwarding lost → `npm run reverse` |
| `Unsupported class file major version` / Gradle JDK errors | `JAVA_HOME` isn't JDK 17. Run `echo $env:JAVA_HOME` |
| `adb devices` shows `unauthorized` | Unlock the phone and accept the USB debugging prompt |
| Map is blank / shows a list | The phone has no internet, or the tile server is blocked. Check `MAP_TILE_URL` |
| Changed `.env` but nothing happened | `npm run start:clean` (Metro caches `.env` values) |

## Web app (PWA): iPhone, Android browsers, Windows, Mac

The same code also builds as an installable web app with react-native-web + Vite (`web/`).

| Command | What it does |
|---|---|
| `npm run web` | Dev server at http://localhost:5173 (uses `API_URL`) |
| `npm run build:web` | Production build in `web/dist` (uses `API_URL_PRODUCTION`) |
| `npm run preview:web` | Serve the production build locally |
| `npm run typecheck:web` | Type-check the web-only code |
| `npm run images:web` | Regenerate the icons + iPhone guide pictures (`APP_HOST=app.your-domain.com npm run images:web`) |

Phone-only pieces have `*.web.ts(x)` versions: browser storage instead of the Keystore, browser GPS, the file picker for photos, Leaflet directly instead of the WebView. Reminders are phone-only.

**Hosting (e.g. Hostinger):**
1. Create a subdomain such as `app.your-domain.com` and turn on SSL (HTTPS is required for location and installing).
2. Upload **everything inside `web/dist`**, including the hidden `.htaccess`, into that subdomain's folder (File Manager → `public_html/app` or the folder Hostinger shows).
3. Open the address. Android/Windows/Mac users get an "Install" button; iPhone users get a "How?" link to `/install-ios.html`, the illustrated 5-step guide (pictures in `/install-ios/step-1…5.png`).
4. To update: build again and replace the files. Installed apps update themselves on next launch.

## Translations

All text goes through `t('English text')` from `src/i18n`. The English text is the key, and `src/i18n/hi.ts` maps it to Hindi. A string without a Hindi entry simply shows in English. To add a language, copy `hi.ts` (e.g. to `ta.ts`), translate the values and add it to `LANGUAGES` in `src/i18n/index.ts`. Keep `{placeholders}` exactly as they are (a unit test checks this).

## Project structure

```
gigswipe_rn/
├── App.tsx                    # Providers, navigation, error boundary, offline banner
├── .env / .env.example        # Backend URLs + Maps key
├── scripts/rn.js              # Windows-safe CLI launcher + adb reverse
├── android/                   # Native Android project (package com.gigswipe.app)
└── src/
    ├── api/                   # Typed REST client (timeouts, auth, error messages)
    ├── components/            # UI kit, sheets (rating, hire code), location picker
    ├── context/AuthContext    # Session (Keystore-backed), auto sign-out on expiry
    ├── hooks/                 # Focus-aware data loading, socket events, auto location
    ├── i18n/                  # t() + Hindi dictionary
    ├── navigation/            # Root stack + worker/business tabs
    ├── screens/
    │   ├── auth/              # Welcome, Role, Login, Register
    │   ├── worker/            # Swipe feed, gig detail, map, matches, profile
    │   ├── business/          # Dashboard, post gig, messages, applicants, profile
    │   └── shared/            # Chat, public profile
    ├── services/              # Socket, location, secure storage, photos, reminders, native settings
    ├── specs/                 # Turbo Native Module spec (codegen)
    ├── theme/                 # Colours, spacing, typography
    └── utils/                 # Formatting, links, directions
```
