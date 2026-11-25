// Web version of the map: Leaflet runs directly in the page (no WebView needed).
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../config';

export interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  label: string;
}

interface Props {
  pins: MapPin[];
  me?: { latitude: number; longitude: number; radiusMiles?: number | null } | null;
  selectedId?: string | null;
  onPinPress: (id: string) => void;
  onMapPress?: () => void;
  onError?: () => void;
}

const MILE = 1609.34;
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const safeColor = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : '#FF5864');

const icon = (p: MapPin, sel: boolean) => L.divIcon({
  className: '',
  iconSize: undefined,
  html: `<div class="gs-pin${sel ? ' sel' : ''}" style="--c:${safeColor(p.color)}"><span style="background:${safeColor(p.color)}">${esc(p.label)}</span></div>`,
});

const CSS = `
.gs-pin{position:relative;transform:translate(-50%,-100%);white-space:nowrap;cursor:pointer}
.gs-pin span{display:inline-block;padding:5px 9px;border-radius:14px;color:#fff;font:700 12px/1 system-ui,-apple-system,Roboto,sans-serif;border:2px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35)}
.gs-pin:after{content:'';position:absolute;left:50%;bottom:-6px;margin-left:-6px;border:6px solid transparent;border-top-color:var(--c);border-bottom:0}
.gs-pin.sel span{transform:scale(1.18);box-shadow:0 0 0 3px rgba(15,23,42,.25),0 4px 10px rgba(15,23,42,.4)}`;

export function LeafletMap({ pins, me, selectedId, onPinPress, onMapPress }: Props) {
  const host = useRef<React.ComponentRef<typeof View>>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, { m: L.Marker; p: MapPin }>());
  const meLayers = useRef<L.Layer[]>([]);
  const fitted = useRef(false);
  const handlers = useRef({ onPinPress, onMapPress });
  handlers.current = { onPinPress, onMapPress };

  // Create the map once
  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return;
    if (!document.getElementById('gs-pin-css')) {
      const st = document.createElement('style');
      st.id = 'gs-pin-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const m = L.map(el, { zoomControl: false }).setView([20.59, 78.96], 4);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    L.tileLayer(MAP_TILE_URL, { maxZoom: 19, attribution: MAP_TILE_ATTRIBUTION }).addTo(m);
    m.on('click', () => handlers.current.onMapPress?.());
    map.current = m;
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(el);
    const ms = markers.current;
    return () => { resize.disconnect(); m.remove(); map.current = null; ms.clear(); };
  }, []);

  const fit = () => {
    const m = map.current;
    if (!m || fitted.current) return;
    const pts = [...markers.current.values()].map(x => x.m.getLatLng());
    if (me) pts.push(L.latLng(me.latitude, me.longitude));
    if (pts.length === 1) { m.setView(pts[0]!, 14); fitted.current = true; }
    else if (pts.length > 1) { m.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 }); fitted.current = true; }
  };

  // Pins
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const keep = new Set(pins.map(p => p.id));
    for (const [id, x] of markers.current) if (!keep.has(id)) { x.m.remove(); markers.current.delete(id); }
    for (const p of pins) {
      const existing = markers.current.get(p.id);
      if (existing) { existing.m.setLatLng([p.latitude, p.longitude]).setIcon(icon(p, p.id === selectedId)); existing.p = p; continue; }
      const mk = L.marker([p.latitude, p.longitude], { icon: icon(p, p.id === selectedId) }).addTo(m);
      mk.on('click', e => { L.DomEvent.stopPropagation(e); handlers.current.onPinPress(p.id); });
      markers.current.set(p.id, { m: mk, p });
    }
    fit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins]);

  // The viewer's position and range
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    meLayers.current.forEach(l => l.remove());
    meLayers.current = [];
    if (!me) return;
    if (me.radiusMiles) {
      meLayers.current.push(L.circle([me.latitude, me.longitude], { radius: me.radiusMiles * MILE, color: '#3B82F6', weight: 1, fillOpacity: 0.06, interactive: false }).addTo(m));
    }
    meLayers.current.push(L.circleMarker([me.latitude, me.longitude], { radius: 8, color: '#fff', weight: 3, fillColor: '#3B82F6', fillOpacity: 1, interactive: false }).addTo(m));
    fit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // Selection highlight
  useEffect(() => {
    for (const [id, x] of markers.current) x.m.setIcon(icon(x.p, id === selectedId));
    const sel = selectedId ? markers.current.get(selectedId) : null;
    if (sel && map.current) { sel.m.setZIndexOffset(1000); map.current.panTo(sel.m.getLatLng()); }
  }, [selectedId]);

  return <View ref={host} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#E5E7EB' }} />;
}
