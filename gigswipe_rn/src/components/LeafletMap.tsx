// Free map: Leaflet + OpenStreetMap tiles inside a WebView. No Google key or billing.
//
// The page is created once; pins and the user's position are pushed in with
// injectJavaScript, so updating them never reloads the map. Taps come back
// through window.ReactNativeWebView.postMessage.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';

import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../config';
import { colors } from '../theme';

export interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  /** Short text on the pin, e.g. "₹800" */
  label: string;
}

interface Props {
  pins: MapPin[];
  /** Blue dot (and optional range circle) for the viewer */
  me?: { latitude: number; longitude: number; radiusMiles?: number | null } | null;
  selectedId?: string | null;
  onPinPress: (id: string) => void;
  onMapPress?: () => void;
  /** Leaflet couldn't load (offline / blocked) — the caller can show a list instead */
  onError?: () => void;
}

const MILE = 1609.34;

// Leaflet 1.9.4 from unpkg, pinned with Subresource Integrity hashes so a
// tampered CDN file is refused by the WebView.
const HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #E5E7EB; }
  .pin { position: relative; transform: translate(-50%, -100%); white-space: nowrap; }
  .pin span { display: inline-block; padding: 5px 9px; border-radius: 14px; color: #fff; font: 700 12px/1 -apple-system, Roboto, sans-serif;
    border: 2px solid #fff; box-shadow: 0 2px 6px rgba(15,23,42,.35); }
  .pin:after { content: ''; position: absolute; left: 50%; bottom: -6px; margin-left: -6px; border: 6px solid transparent;
    border-top-color: var(--c); border-bottom: 0; }
  .pin.sel span { transform: scale(1.18); box-shadow: 0 0 0 3px rgba(15,23,42,.25), 0 4px 10px rgba(15,23,42,.4); }
  .leaflet-div-icon { background: transparent; border: 0; }
</style>
</head><body>
<div id="map"></div>
<script>
  function send(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  window.onerror = function (msg) { send({ type: 'error', message: String(msg) }); };
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""
  onerror="send({ type: 'error', message: 'leaflet failed to load' })"></script>
<script>
(function () {
  if (!window.L) return;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([20.59, 78.96], 4);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer(__TILE_URL__, { maxZoom: 19, attribution: __TILE_ATTRIBUTION__ }).addTo(map);
  var markers = {}, meLayer = null, rangeLayer = null, fitted = false, selected = null;

  map.on('click', function () { send({ type: 'map' }); });

  function icon(p, sel) {
    var c = /^#[0-9a-f]{3,8}$/i.test(p.color) ? p.color : '#FF5864';
    return L.divIcon({ className: '', iconSize: null,
      html: '<div class="pin' + (sel ? ' sel' : '') + '" style="--c:' + c + '"><span style="background:' + c + '">' + esc(p.label) + '</span></div>' });
  }

  window.gs = {
    setPins: function (pins) {
      var keep = {};
      pins.forEach(function (p) {
        keep[p.id] = true;
        if (markers[p.id]) { markers[p.id].setLatLng([p.latitude, p.longitude]).setIcon(icon(p, p.id === selected)); markers[p.id]._p = p; return; }
        var m = L.marker([p.latitude, p.longitude], { icon: icon(p, p.id === selected), riseOnHover: true }).addTo(map);
        m._p = p;
        m.on('click', function (e) { L.DomEvent.stopPropagation(e); send({ type: 'pin', id: p.id }); });
        markers[p.id] = m;
      });
      Object.keys(markers).forEach(function (id) { if (!keep[id]) { map.removeLayer(markers[id]); delete markers[id]; } });
      if (!fitted) this.fit();
    },
    setMe: function (me) {
      if (meLayer) { map.removeLayer(meLayer); meLayer = null; }
      if (rangeLayer) { map.removeLayer(rangeLayer); rangeLayer = null; }
      if (!me) return;
      if (me.radiusMeters) rangeLayer = L.circle([me.latitude, me.longitude], { radius: me.radiusMeters, color: '#3B82F6', weight: 1, fillOpacity: 0.06, interactive: false }).addTo(map);
      meLayer = L.circleMarker([me.latitude, me.longitude], { radius: 8, color: '#fff', weight: 3, fillColor: '#3B82F6', fillOpacity: 1, interactive: false }).addTo(map);
      if (!fitted) this.fit();
    },
    select: function (id) {
      selected = id;
      Object.keys(markers).forEach(function (k) { markers[k].setIcon(icon(markers[k]._p, k === id)); });
      if (id && markers[id]) { markers[id].setZIndexOffset(1000); map.panTo(markers[id].getLatLng(), { animate: true }); }
    },
    fit: function () {
      var pts = Object.keys(markers).map(function (k) { return markers[k].getLatLng(); });
      if (meLayer) pts.push(meLayer.getLatLng());
      if (rangeLayer && pts.length <= 1) { map.fitBounds(rangeLayer.getBounds(), { padding: [20, 20] }); fitted = true; return; }
      if (pts.length === 1) { map.setView(pts[0], 14); fitted = true; }
      else if (pts.length > 1) { map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 }); fitted = true; }
    }
  };
  send({ type: 'ready' });
})();
</script>
</body></html>`;

export function LeafletMap({ pins, me, selectedId, onPinPress, onMapPress, onError }: Props) {
  const ref = useRef<React.ComponentRef<typeof WebView>>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onPinPress, onMapPress, onError });
  handlers.current = { onPinPress, onMapPress, onError };

  const html = useMemo(
    () => HTML.replace('__TILE_URL__', JSON.stringify(MAP_TILE_URL)).replace('__TILE_ATTRIBUTION__', JSON.stringify(MAP_TILE_ATTRIBUTION)),
    []
  );

  const run = useCallback((js: string) => ref.current?.injectJavaScript(`try{${js}}catch(e){}true;`), []);

  useEffect(() => {
    if (ready) run(`window.gs.setMe(${JSON.stringify(me ? { ...me, radiusMeters: me.radiusMiles ? me.radiusMiles * MILE : 0 } : null)})`);
  }, [ready, me, run]);
  useEffect(() => {
    if (ready) run(`window.gs.setPins(${JSON.stringify(pins)})`);
  }, [ready, pins, run]);
  useEffect(() => {
    if (ready) run(`window.gs.select(${JSON.stringify(selectedId ?? null)})`);
  }, [ready, selectedId, run]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type?: string; id?: string };
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'pin' && msg.id) handlers.current.onPinPress(msg.id);
    else if (msg.type === 'map') handlers.current.onMapPress?.();
    else if (msg.type === 'error') handlers.current.onError?.();
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={ref}
        source={{ html, baseUrl: 'https://gigswipe.app/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        // OpenStreetMap asks apps to identify themselves
        applicationNameForUserAgent="GigSwipe/1.0"
        // Links inside the map (e.g. the © OpenStreetMap credit) open in the browser
        onShouldStartLoadWithRequest={req => {
          if (req.url.startsWith('https://gigswipe.app') || req.url === 'about:blank') return true;
          if (/^https?:\/\//.test(req.url)) Linking.openURL(req.url).catch(() => {});
          return false;
        }}
        onError={() => handlers.current.onError?.()}
        style={{ backgroundColor: colors.surfaceAlt }}
      />
    </View>
  );
}
