// Categorie, profili, durate e stati: devono corrispondere a backend/app/categories.py
// Le icone sono di Material Design Icons: stesso set nell'app e sulla mappa.
// Le etichette (label, short, hint) sono "getter": si leggono ogni volta nella lingua attiva (i18n.js).
import { t } from './i18n';

const tr = (obj, keys) => {
  for (const [prop, key] of Object.entries(keys)) {
    Object.defineProperty(obj, prop, { get: () => t(key), enumerable: true });
  }
  return obj;
};

export const CATEGORIES = {
  vehicle: tr({ icon: 'car-outline', tint: '#E0475B' }, { label: 'cat.vehicle', short: 'catShort.vehicle' }),
  works: tr({ icon: 'traffic-cone', tint: '#E8730C' }, { label: 'cat.works', short: 'catShort.works' }),
  construction: tr({ icon: 'crane', tint: '#C9881A' }, { label: 'cat.construction', short: 'catShort.construction' }),
  closed: tr({ icon: 'cancel', tint: '#B42318' }, { label: 'cat.closed', short: 'catShort.closed' }),
  elevator: tr({ icon: 'elevator-passenger-off', tint: '#7A5AF8' }, { label: 'cat.elevator', short: 'catShort.elevator' }),
  obstacle: tr({ icon: 'pine-tree', tint: '#2F8F5B' }, { label: 'cat.obstacle', short: 'catShort.obstacle' }),
  tables: tr({ icon: 'table-chair', tint: '#9A6B3F' }, { label: 'cat.tables', short: 'catShort.tables' }),
  bikes: tr({ icon: 'bicycle', tint: '#0E8A9A' }, { label: 'cat.bikes', short: 'catShort.bikes' }),
  snow: tr({ icon: 'snowflake', tint: '#2E90FA' }, { label: 'cat.snow', short: 'catShort.snow' }),
  other: tr({ icon: 'alert-circle-outline', tint: '#667085' }, { label: 'cat.other', short: 'catShort.other' }),
};

const ALL = Object.keys(CATEGORIES);
const STREET = ['works', 'construction', 'closed', 'obstacle', 'snow', 'other'];

export const PROFILES = {
  pedestrian: tr({ icon: 'walk', categories: STREET }, { label: 'profile.pedestrian', hint: 'profileHint.pedestrian' }),
  wheelchair: tr({ icon: 'wheelchair-accessibility', categories: ALL }, { label: 'profile.wheelchair', hint: 'profileHint.wheelchair' }),
  blind: tr({ icon: 'human-white-cane', categories: ALL }, { label: 'profile.blind', hint: 'profileHint.blind' }),
  stroller: tr({ icon: 'baby-carriage', categories: ALL }, { label: 'profile.stroller', hint: 'profileHint.stroller' }),
  bike: tr({ icon: 'bike', categories: STREET }, { label: 'profile.bike', hint: 'profileHint.bike' }),
};

export const DURATIONS = {
  minutes: tr({ icon: 'lightning-bolt-outline' }, { label: 'duration.minutes' }),
  hours: tr({ icon: 'clock-outline' }, { label: 'duration.hours' }),
  days: tr({ icon: 'calendar-outline' }, { label: 'duration.days' }),
  weeks: tr({ icon: 'calendar-range-outline' }, { label: 'duration.weeks' }),
  unknown: tr({ icon: 'help-circle-outline' }, { label: 'duration.unknown' }),
};

// Colori del ciclo di vita (verde -> ambra -> rosso -> grigio), come nel concept
export const STATUSES = {
  new: tr({ color: '#16A34A', soft: '#ECFDF3', rank: 1 }, { label: 'status.new' }),
  confirmed: tr({ color: '#D97706', soft: '#FFF7E6', rank: 2 }, { label: 'status.confirmed' }),
  persistent: tr({ color: '#DC2626', soft: '#FEF2F2', rank: 3 }, { label: 'status.persistent' }),
  resolved: tr({ color: '#64748B', soft: '#F1F5F9', rank: 0 }, { label: 'status.resolved' }),
  expired: tr({ color: '#94A3B8', soft: '#F1F5F9', rank: 0 }, { label: 'status.expired' }),
};

export const ACTIVE_STATUSES = ['new', 'confirmed', 'persistent'];

// Centro di Bolzano (Piazza Walther): centro della mappa e partenza della demo se il GPS è fuori regione
export const BZ_CENTER = { lat: 46.4983, lon: 11.3548 };

// Area servita: rettangolo che contiene tutto il Trentino-Alto Adige (uguale a backend/app/routing.py)
export const REGION_RECT = { minLat: 45.67, maxLat: 47.1, minLon: 10.38, maxLon: 12.48 };

// SOLO SVILUPPO: pulsante "Reset account" nel profilo. Metti false per la versione finale.
export const SHOW_ACCOUNT_RESET = true;

export const ALERT_RADIUS_M = 40; // distanza a cui scatta l'avviso vocale
