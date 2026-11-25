// Builds the GigSwipe web app / PWA (Android, iPhone, Windows, Mac) from the
// same source as the phone app, using react-native-web.
//
//   npm run web          → dev server at http://localhost:5173
//   npm run build:web    → static files in web/dist (upload them to any web host)
//
// The backend address comes from ../.env (API_URL for dev, API_URL_PRODUCTION
// for the build). An environment variable with the same name overrides .env.
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const appRoot = path.resolve(__dirname, '..');
const shim = (name: string) => path.resolve(__dirname, 'shims', name);
const webFirst = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];

/** `import { API_URL } from '@env'` — same values the phone app gets from react-native-dotenv. */
function envModule(): Plugin {
  const parse = (file: string) => {
    const out: Record<string, string> = {};
    if (!fs.existsSync(file)) return out;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m) continue;
      let v = m[2]!.replace(/\s+#.*$/, '');
      if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
      out[m[1]!] = v;
    }
    return out;
  };
  return {
    name: 'gigswipe-env',
    resolveId: id => (id === '@env' ? '\0gigswipe-env' : null),
    load(id) {
      if (id !== '\0gigswipe-env') return null;
      const env = parse(path.join(appRoot, '.env'));
      for (const k of Object.keys(env)) if (process.env[k]) env[k] = process.env[k]!;
      for (const k of ['API_URL_PRODUCTION', 'API_URL']) if (process.env[k] && !env[k]) env[k] = process.env[k]!;
      return Object.entries(env).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`).join('\n');
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: __dirname,
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [
    envModule(),
    react(),
    VitePWA({
      registerType: 'autoUpdate', // new versions replace the old one on next open
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'install-ios/*.png'],
      manifest: {
        id: '/',
        name: 'GigSwipe',
        short_name: 'GigSwipe',
        description: 'Local gigs, one swipe away. Find work nearby or hire people near you.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#FF5864',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ttf,woff2,png,svg,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/install-ios/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  resolve: {
    extensions: webFirst,
    alias: [
      { find: /^react-native$/, replacement: shim('react-native.ts') },
    ],
  },
  define: {
    __DEV__: JSON.stringify(mode !== 'production'),
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: webFirst,
      loader: { '.js': 'jsx' },
      define: { global: 'globalThis' },
    },
  },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
  },
}));
