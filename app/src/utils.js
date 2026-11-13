// Funzioni di supporto: distanze, tempi, testi.

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

export function randomId() {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  return 'dev-' + Array.from({ length: 24 }, hex).join('');
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
