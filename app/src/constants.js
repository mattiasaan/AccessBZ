// Categorie, profili, durate e stati: devono corrispondere a backend/app/categories.py
// Le icone sono di Material Design Icons: stesso set nell'app e sulla mappa.

export const CATEGORIES = {
  vehicle: { icon: 'car-outline', label: 'Veicolo sul marciapiede', short: 'Veicolo', tint: '#E0475B' },
  works: { icon: 'traffic-cone', label: 'Lavori', short: 'Lavori', tint: '#E8730C' },
  construction: { icon: 'crane', label: 'Cantiere', short: 'Cantiere', tint: '#C9881A' },
  closed: { icon: 'cancel', label: 'Passaggio chiuso', short: 'Chiuso', tint: '#B42318' },
  elevator: { icon: 'elevator-passenger-off', label: 'Ascensore fuori servizio', short: 'Ascensore', tint: '#7A5AF8' },
  obstacle: { icon: 'pine-tree', label: 'Ostacolo fisico', short: 'Ostacolo', tint: '#2F8F5B' },
  tables: { icon: 'table-chair', label: 'Tavolini sul passaggio', short: 'Tavolini', tint: '#9A6B3F' },
  bikes: { icon: 'bicycle', label: 'Bici o monopattini', short: 'Bici', tint: '#0E8A9A' },
  snow: { icon: 'snowflake', label: 'Neve o ghiaccio', short: 'Ghiaccio', tint: '#2E90FA' },
  other: { icon: 'alert-circle-outline', label: 'Altro problema', short: 'Altro', tint: '#667085' },
};

const ALL = Object.keys(CATEGORIES);
const STREET = ['works', 'construction', 'closed', 'obstacle', 'snow', 'other'];

export const PROFILES = {
  pedestrian: { icon: 'walk', label: 'Pedone', hint: 'Lavori, chiusure e ostacoli', categories: STREET },
  wheelchair: { icon: 'wheelchair-accessibility', label: 'Carrozzina', hint: 'Scale, rampe, ascensori', categories: ALL },
  blind: { icon: 'human-white-cane', label: 'Ipovedente', hint: 'Ostacoli e avvisi vocali', categories: ALL },
  stroller: { icon: 'baby-carriage', label: 'Passeggino', hint: 'Scale, rampe e ascensori', categories: ALL },
  bike: { icon: 'bike', label: 'Bicicletta', hint: 'Lavori, chiusure e deviazioni', categories: STREET },
};

export const DURATIONS = {
  minutes: { icon: 'lightning-bolt-outline', label: 'Pochi minuti' },
  hours: { icon: 'clock-outline', label: 'Qualche ora' },
  days: { icon: 'calendar-outline', label: 'Alcuni giorni' },
  weeks: { icon: 'calendar-range-outline', label: 'Alcune settimane' },
  unknown: { icon: 'help-circle-outline', label: 'Non lo so' },
};

// Colori del ciclo di vita (verde -> ambra -> rosso -> grigio), come nel concept
export const STATUSES = {
  new: { label: 'Appena segnalato', color: '#16A34A', soft: '#ECFDF3', rank: 1 },
  confirmed: { label: 'Confermato', color: '#D97706', soft: '#FFF7E6', rank: 2 },
  persistent: { label: 'Persistente', color: '#DC2626', soft: '#FEF2F2', rank: 3 },
  resolved: { label: 'Risolto', color: '#64748B', soft: '#F1F5F9', rank: 0 },
  expired: { label: 'Scaduto', color: '#94A3B8', soft: '#F1F5F9', rank: 0 },
};

export const ACTIVE_STATUSES = ['new', 'confirmed', 'persistent'];

// Centro di Bolzano (Piazza Walther): punto di partenza della demo
export const BZ_CENTER = { lat: 46.4983, lon: 11.3548 };

export const ALERT_RADIUS_M = 40; // distanza a cui scatta l'avviso vocale
