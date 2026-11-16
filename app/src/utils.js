// Funzioni di supporto: distanze, tempi, testi.
import * as Crypto from 'expo-crypto';

import { REGION_RECT } from './constants';

// Il punto è nell'area servita (Trentino-Alto Adige)?
export function inRegion(p) {
  return !!p && p.lat >= REGION_RECT.minLat && p.lat <= REGION_RECT.maxLat
    && p.lon >= REGION_RECT.minLon && p.lon <= REGION_RECT.maxLon;
}

export function distanceM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatMinutes(min) {
  if (min == null) return '—';
  if (min < 1) return 'meno di un minuto';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60 ? `${min % 60} min` : ''}`.trim();
  const d = Math.round(h / 24);
  return d === 1 ? '1 giorno' : `${d} giorni`;
}

export function timeAgo(iso) {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return `${formatMinutes(min)} fa`.replace('meno di un minuto fa', 'adesso');
}

export function formatDistance(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// Identificativo segreto del dispositivo: UUID crittograficamente casuale
// (Math.random non è sicuro: i suoi valori si possono prevedere).
export function randomId() {
  return 'dev-' + Crypto.randomUUID();
}

// Proietta un punto su una linea [[lat, lon], ...].
// Ritorna { dist: distanza dalla linea in m, along: metri dalla partenza lungo la linea }.
// Stessa logica di backend/app/routing.py (approssimazione piana, ottima in città).
export function locateOnRoute(point, line) {
  const kx = 111320 * Math.cos((point.lat * Math.PI) / 180);
  const ky = 110540;
  const px = point.lon * kx;
  const py = point.lat * ky;
  let best = { dist: Infinity, along: 0 };
  let travelled = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = line[i][1] * kx, ay = line[i][0] * ky;
    const bx = line[i + 1][1] * kx, by = line[i + 1][0] * ky;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (len * len)));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < best.dist) best = { dist: d, along: travelled + t * len };
    travelled += len;
  }
  return best;
}

// Punto a una certa distanza lungo una linea [[lat, lon], ...] (per la simulazione)
export function pointAlong(line, meters) {
  let left = meters;
  for (let i = 0; i < line.length - 1; i++) {
    const a = { lat: line[i][0], lon: line[i][1] };
    const b = { lat: line[i + 1][0], lon: line[i + 1][1] };
    const seg = distanceM(a, b);
    if (left <= seg) {
      const t = seg === 0 ? 0 : left / seg;
      return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, done: false };
    }
    left -= seg;
  }
  const last = line[line.length - 1];
  return { lat: last[0], lon: last[1], done: true };
}
