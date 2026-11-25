// Generates the PWA icons and the illustrated "Add to Home Screen" guide for
// iPhone (web/public/icons/*, web/public/install-ios/*). Run: npm run images:web
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..', 'public');
fs.mkdirSync(path.join(pub, 'icons'), { recursive: true });
fs.mkdirSync(path.join(pub, 'install-ios'), { recursive: true });

// The web app's address shown in the guide pictures. Change it to your real domain, then run: npm run images:web
const APP_HOST = process.env.APP_HOST || 'app.gigswipe.in';

const FONT = "Segoe UI, Arial, Helvetica, sans-serif";
const ACCENT = '#FF5864';
const NAVY = '#0F172A';

function png(svg, file, width) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' } });
  fs.writeFileSync(file, r.render().asPng());
  fs.writeFileSync(file.replace(/\.png$/, '.svg'), svg);
}

// ── App icon ──────────────────────────────────────────────────────────────────
const icon = (size, { padding = 0, rounded = true } = {}) => {
  const inner = size - padding * 2;
  const r = rounded ? inner * 0.23 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${padding ? `<rect width="${size}" height="${size}" fill="${ACCENT}"/>` : ''}
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${r}" fill="${ACCENT}"/>
  <text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="${inner * 0.6}" fill="#fff">G</text>
</svg>`;
};
png(icon(512), path.join(pub, 'icons', 'icon-512.png'), 512);
png(icon(512), path.join(pub, 'icons', 'icon-192.png'), 192);
png(icon(512, { padding: 70, rounded: false }), path.join(pub, 'icons', 'maskable-512.png'), 512);
png(icon(180, { rounded: false }), path.join(pub, 'icons', 'apple-touch-icon.png'), 180); // iOS rounds it itself
png(icon(64), path.join(pub, 'icons', 'favicon-32.png'), 32);

// ── iPhone guide illustrations ────────────────────────────────────────────────
// A simplified iPhone (390×844 points) with Safari, plus a red arrow + ring on the
// exact thing to tap. Rendered at 2× for sharp images.
const W = 390, H = 844;

const statusBar = (dark = false) => `
  <text x="34" y="34" font-family="${FONT}" font-size="16" font-weight="700" fill="${dark ? '#fff' : NAVY}">9:41</text>
  <rect x="${W - 62}" y="22" width="26" height="13" rx="4" fill="none" stroke="${dark ? '#fff' : NAVY}" stroke-width="1.5"/>
  <rect x="${W - 60}" y="24" width="19" height="9" rx="2" fill="${dark ? '#fff' : NAVY}"/>
  <rect x="${W - 34}" y="26" width="2" height="5" rx="1" fill="${dark ? '#fff' : NAVY}"/>
  <path d="M${W - 92} 33 a9 9 0 0 1 16 0" fill="none" stroke="${dark ? '#fff' : NAVY}" stroke-width="2"/>
  <path d="M${W - 88} 33 a5 5 0 0 1 8 0" fill="none" stroke="${dark ? '#fff' : NAVY}" stroke-width="2"/>`;

const frame = (content, { dark = false } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 24}" height="${H + 24}" viewBox="-12 -12 ${W + 24} ${H + 24}">
  <defs>
    <clipPath id="screen"><rect x="0" y="0" width="${W}" height="${H}" rx="48"/></clipPath>
    <marker id="head" markerUnits="userSpaceOnUse" markerWidth="26" markerHeight="26" refX="18" refY="13" orient="auto">
      <path d="M0 0 L26 13 L0 26 L6 13 z" fill="${ACCENT}"/>
    </marker>
  </defs>
  <rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" rx="56" fill="#111827"/>
  <g clip-path="url(#screen)">
    <rect width="${W}" height="${H}" fill="${dark ? '#1E293B' : '#fff'}"/>
    ${content}
    ${statusBar(dark)}
    <rect x="${W / 2 - 62}" y="11" width="124" height="34" rx="17" fill="#000"/>
    <rect x="${W / 2 - 67}" y="${H - 13}" width="134" height="5" rx="3" fill="${dark ? '#fff' : NAVY}" opacity="0.85"/>
  </g>
</svg>`;

/**
 * Red ring around the target, and a curved arrow from (sx, sy) to it.
 * The label sits just beyond the arrow's start (labelAt: 'below' | 'above').
 */
const pointer = (cx, cy, { r = 30, sx, sy, bend = 40, label = '', labelAt = 'below' } = {}) => {
  const d = Math.hypot(sx - cx, sy - cy);
  const ex = cx + (sx - cx) * (r + 8) / d;
  const ey = cy + (sy - cy) * (r + 8) / d;
  // control point: midpoint pushed sideways
  const mx = (sx + ex) / 2, my = (sy + ey) / 2;
  const nx = -(ey - sy) / d, ny = (ex - sx) / d;
  const qx = mx + nx * bend, qy = my + ny * bend;
  const lw = Math.round(label.length * 9.6 + 40);
  const lx = Math.max(14 + lw / 2, Math.min(W - 14 - lw / 2, sx));
  const ly = labelAt === 'below' ? sy + 12 : sy - 52;
  return `
  <circle cx="${cx}" cy="${cy}" r="${r + 9}" fill="${ACCENT}" opacity="0.14"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ACCENT}" stroke-width="4"/>
  <path d="M${sx} ${sy} Q${qx} ${qy} ${ex} ${ey}" fill="none" stroke="${ACCENT}" stroke-width="5" stroke-linecap="round" marker-end="url(#head)"/>
  ${label ? `<rect x="${lx - lw / 2}" y="${ly}" width="${lw}" height="40" rx="20" fill="${ACCENT}"/>
  <text x="${lx}" y="${ly + 26}" text-anchor="middle" font-family="${FONT}" font-size="17" font-weight="800" fill="#fff">${label}</text>` : ''}`;
};

// Pieces of the GigSwipe welcome page inside Safari
const pagePreview = (top = 100) => `
  <rect x="${W / 2 - 40}" y="${top + 60}" width="80" height="80" rx="22" fill="${ACCENT}"/>
  <text x="${W / 2}" y="${top + 116}" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="46" fill="#fff">G</text>
  <text x="${W / 2}" y="${top + 185}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="30" fill="${NAVY}">GigSwipe</text>
  <text x="${W / 2}" y="${top + 220}" text-anchor="middle" font-family="${FONT}" font-size="17" fill="#64748B">Local gigs.</text>
  <text x="${W / 2}" y="${top + 244}" text-anchor="middle" font-family="${FONT}" font-size="17" fill="#64748B">One swipe away.</text>
  ${[0, 1, 2].map(i => `
    <rect x="34" y="${top + 290 + i * 58}" width="38" height="38" rx="11" fill="#FFF1F2"/>
    <rect x="86" y="${top + 294 + i * 58}" width="${150 - i * 20}" height="11" rx="5" fill="#0F172A" opacity="0.85"/>
    <rect x="86" y="${top + 314 + i * 58}" width="${230 - i * 15}" height="9" rx="4" fill="#94A3B8"/>`).join('')}
  <rect x="28" y="${top + 480}" width="${W - 56}" height="50" rx="14" fill="${ACCENT}"/>
  <text x="${W / 2}" y="${top + 511}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="17" fill="#fff">Get started →</text>`;

const pageCompact = () => `
  <rect x="${W / 2 - 36}" y="110" width="72" height="72" rx="20" fill="${ACCENT}"/>
  <text x="${W / 2}" y="160" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="42" fill="#fff">G</text>
  <text x="${W / 2}" y="224" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="28" fill="${NAVY}">GigSwipe</text>
  <text x="${W / 2}" y="256" text-anchor="middle" font-family="${FONT}" font-size="16" fill="#64748B">Local gigs. One swipe away.</text>
  <rect x="28" y="296" width="${W - 56}" height="48" rx="14" fill="${ACCENT}" opacity="0.9"/>
  <text x="${W / 2}" y="326" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="16" fill="#fff">Get started →</text>`;

// Safari's bottom address bar + toolbar (iOS 17/18 layout)
const SHARE = { x: W / 2, y: H - 58 };
const safariBottom = (url = APP_HOST) => `
  <rect x="0" y="${H - 150}" width="${W}" height="150" fill="#F2F2F7"/>
  <rect x="0" y="${H - 150}" width="${W}" height="1" fill="#D1D5DB"/>
  <rect x="14" y="${H - 138}" width="${W - 28}" height="48" rx="14" fill="#fff" stroke="#E5E7EB"/>
  <text x="34" y="${H - 108}" font-family="${FONT}" font-size="16" fill="${NAVY}">aA</text>
  <path d="M${W / 2 - 64} ${H - 120} v-3 a5 5 0 0 1 10 0 v3" fill="none" stroke="#6B7280" stroke-width="1.8"/>
  <rect x="${W / 2 - 66}" y="${H - 121}" width="14" height="11" rx="2" fill="#6B7280"/>
  <text x="${W / 2 + 8}" y="${H - 108}" text-anchor="middle" font-family="${FONT}" font-size="16" fill="${NAVY}">${url}</text>
  <path d="M${W - 44} ${H - 120} a8 8 0 1 0 3 6" fill="none" stroke="${NAVY}" stroke-width="2"/>
  <!-- toolbar: back, forward, share, bookmarks, tabs -->
  <path d="M42 ${H - 66} l-9 9 l9 9" fill="none" stroke="#2563EB" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M112 ${H - 66} l9 9 l-9 9" fill="none" stroke="#9CA3AF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <g stroke="#2563EB" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${SHARE.x - 9} ${SHARE.y - 6} h-4 v19 h26 v-19 h-4"/>
    <path d="M${SHARE.x} ${SHARE.y + 4} v-20 M${SHARE.x - 6} ${SHARE.y - 10} l6 -6 l6 6"/>
  </g>
  <path d="M${W - 122} ${H - 68} h16 a4 4 0 0 1 4 4 v18 l-12 -7 l-12 7 v-18 a4 4 0 0 1 4 -4z" fill="none" stroke="#2563EB" stroke-width="2.2"/>
  <rect x="${W - 58}" y="${H - 70}" width="20" height="20" rx="4" fill="none" stroke="#2563EB" stroke-width="2.2"/>
  <rect x="${W - 53}" y="${H - 65}" width="20" height="20" rx="4" fill="#F2F2F7" stroke="#2563EB" stroke-width="2.2"/>`;

// Step 1 — open the link in Safari
const step1 = frame(`
  ${pageCompact()}
  ${safariBottom()}
  ${pointer(W / 2 + 8, H - 114, { r: 34, sx: 110, sy: 520, bend: -50, label: 'Open link in Safari', labelAt: 'above' })}`);

// Step 2 — tap Share
const step2 = frame(`
  ${pageCompact()}
  ${safariBottom()}
  ${pointer(SHARE.x, SHARE.y, { r: 28, sx: 110, sy: 520, bend: -60, label: 'Tap Share', labelAt: 'above' })}`);

// Step 3 — share sheet: "Add to Home Screen"
const rows = ['Copy', 'Add to Reading List', 'Add Bookmark', 'Find on Page', 'Add to Home Screen'];
const ROW_TOP = 400, ROW_H = 50;
const ADD_ROW = rows.indexOf('Add to Home Screen');
const sheetIcon = (name, x, y) => {
  if (name === 'Add to Home Screen') {
    return `<rect x="${x - 12}" y="${y - 12}" width="24" height="24" rx="6" fill="none" stroke="${NAVY}" stroke-width="2"/>
      <path d="M${x} ${y - 6} v12 M${x - 6} ${y} h12" stroke="${NAVY}" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  return `<rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="5" fill="none" stroke="#6B7280" stroke-width="1.8"/>`;
};
const step3 = frame(`
  ${pagePreview(70)}
  <rect width="${W}" height="${H}" fill="#000" opacity="0.35"/>
  <rect x="0" y="150" width="${W}" height="${H}" rx="16" fill="#F2F2F7"/>
  <rect x="${W / 2 - 20}" y="160" width="40" height="5" rx="3" fill="#C7C7CC"/>
  <rect x="16" y="182" width="44" height="44" rx="11" fill="${ACCENT}"/>
  <text x="38" y="213" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="26" fill="#fff">G</text>
  <text x="72" y="200" font-family="${FONT}" font-weight="700" font-size="16" fill="${NAVY}">GigSwipe</text>
  <text x="72" y="220" font-family="${FONT}" font-size="14" fill="#6B7280">${APP_HOST} · Options ›</text>
  ${['AirDrop', 'Messages', 'Mail', 'WhatsApp'].map((n, i) => `
    <circle cx="${52 + i * 95}" cy="285" r="29" fill="${['#3B82F6', '#22C55E', '#60A5FA', '#25D366'][i]}"/>
    <text x="${52 + i * 95}" y="336" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${NAVY}">${n}</text>`).join('')}
  <rect x="16" y="${ROW_TOP - 10}" width="${W - 32}" height="${rows.length * ROW_H}" rx="12" fill="#fff"/>
  ${rows.map((n, i) => `
    ${i ? `<rect x="32" y="${ROW_TOP - 10 + i * ROW_H}" width="${W - 64}" height="1" fill="#E5E7EB"/>` : ''}
    ${i === ADD_ROW ? `<rect x="18" y="${ROW_TOP - 8 + i * ROW_H}" width="${W - 36}" height="${ROW_H - 4}" rx="10" fill="#FFF1F2"/>` : ''}
    <text x="34" y="${ROW_TOP + 22 + i * ROW_H}" font-family="${FONT}" font-size="17" font-weight="${i === ADD_ROW ? 700 : 400}" fill="${NAVY}">${n}</text>
    ${sheetIcon(n, W - 46, ROW_TOP + 15 + i * ROW_H)}`).join('')}
  ${pointer(W - 46, ROW_TOP + 15 + ADD_ROW * ROW_H, { r: 26, sx: 150, sy: 740, bend: 60, label: 'Add to Home Screen', labelAt: 'below' })}`);

// Step 4 — "Add" (top right)
const ADD = { x: W - 44, y: 88 };
const step4 = frame(`
  <rect width="${W}" height="${H}" fill="#F2F2F7"/>
  <text x="24" y="94" font-family="${FONT}" font-size="17" fill="#2563EB">Cancel</text>
  <text x="${W / 2}" y="94" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="17" fill="${NAVY}">Add to Home Screen</text>
  <text x="${ADD.x}" y="94" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="17" fill="#2563EB">Add</text>
  <rect x="16" y="130" width="${W - 32}" height="96" rx="12" fill="#fff"/>
  <rect x="30" y="144" width="68" height="68" rx="16" fill="${ACCENT}"/>
  <text x="64" y="191" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="40" fill="#fff">G</text>
  <text x="114" y="172" font-family="${FONT}" font-size="18" fill="${NAVY}">GigSwipe</text>
  <rect x="114" y="182" width="${W - 150}" height="1" fill="#E5E7EB"/>
  <text x="114" y="204" font-family="${FONT}" font-size="14" fill="#6B7280">https://${APP_HOST}/</text>
  <rect x="16" y="244" width="${W - 32}" height="52" rx="12" fill="#fff"/>
  <text x="34" y="276" font-family="${FONT}" font-size="17" fill="${NAVY}">Open as Web App</text>
  <rect x="${W - 84}" y="256" width="51" height="31" rx="16" fill="#34C759"/>
  <circle cx="${W - 49}" cy="271.5" r="13.5" fill="#fff"/>
  <text x="34" y="324" font-family="${FONT}" font-size="13" fill="#6B7280">An icon will be added to your Home Screen so you</text>
  <text x="34" y="342" font-family="${FONT}" font-size="13" fill="#6B7280">can quickly access this website.</text>
  ${pointer(ADD.x, ADD.y - 6, { r: 28, sx: 200, sy: 460, bend: 70, label: 'Tap Add', labelAt: 'below' })}`);

// Step 5 — open from the Home Screen
const apps = [
  ['Phone', '#22C55E'], ['Messages', '#22C55E'], ['Camera', '#6B7280'], ['Photos', '#F59E0B'],
  ['Maps', '#3B82F6'], ['Weather', '#38BDF8'], ['Clock', '#111827'], ['Notes', '#FACC15'],
  ['Settings', '#9CA3AF'], ['App Store', '#3B82F6'], ['Safari', '#0EA5E9'], ['Calendar', '#EF4444'],
  ['GigSwipe', ACCENT],
];
const GS = { x: 0, y: 0 };
const step5 = frame(`
  <rect width="${W}" height="${H}" fill="url(#wall)"/>
  <defs><linearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366F1"/><stop offset="1" stop-color="#EC4899"/></linearGradient></defs>
  ${apps.map(([n, c], i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 30 + col * 88, y = 90 + row * 104;
    if (n === 'GigSwipe') { GS.x = x + 31; GS.y = y + 31; }
    return `<rect x="${x}" y="${y}" width="62" height="62" rx="15" fill="${c}"/>
      ${n === 'GigSwipe' ? `<text x="${x + 31}" y="${y + 45}" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="38" fill="#fff">G</text>` : ''}
      <text x="${x + 31}" y="${y + 80}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#fff">${n}</text>`;
  }).join('')}
  <rect x="16" y="${H - 116}" width="${W - 32}" height="92" rx="30" fill="#fff" opacity="0.3"/>
  ${pointer(GS.x, GS.y, { r: 40, sx: 250, sy: 560, bend: 50, label: 'Open GigSwipe', labelAt: 'below' })}`, { dark: true });

const steps = { 'step-1': step1, 'step-2': step2, 'step-3': step3, 'step-4': step4, 'step-5': step5 };
for (const [name, svg] of Object.entries(steps)) png(svg, path.join(pub, 'install-ios', `${name}.png`), 828);
console.log('icons + install-ios images written to', pub);
