// Comunicazione con il backend FastAPI.
// L'indirizzo si imposta con EXPO_PUBLIC_API_URL nei profili di eas.json
// (in sviluppo si usa da solo l'IP del PC). Si possono indicare PIÙ indirizzi separati
// da virgola, es. "http://192.168.1.17:8000,http://100.74.242.92:8000": l'app usa il primo
// che risponde e lo ricorda (rete locale quando sei a casa, Tailscale quando sei fuori).
import Constants from 'expo-constants';

// In sviluppo (Expo Go) il backend gira sullo stesso PC del server Expo:
// prendiamo il suo IP (es. "192.168.1.5:8081") e usiamo la porta 8000.
function devApiUrl() {
  if (!__DEV__) return null;
  const host =
    Constants.expoConfig?.hostUri?.split(':')[0] ||
    (typeof window !== 'undefined' ? window.location?.hostname : null);
  return host ? `http://${host}:8000` : null;
}

const API_URLS = (
  process.env.EXPO_PUBLIC_API_URL ||
  devApiUrl() ||
  Constants.expoConfig?.extra?.apiUrl ||
  'http://localhost:8000'
)
  .split(',')
  .map((u) => u.trim().replace(/\/$/, ''))
  .filter(Boolean);

let currentUrl = 0; // indice dell'ultimo indirizzo che ha risposto
export const getApiUrl = () => API_URLS[currentUrl];

// Con più indirizzi, quelli "di riserva" si provano dopo un'attesa breve
// (un IP locale non raggiungibile fuori casa altrimenti farebbe aspettare 45 s)
const FALLBACK_TIMEOUT_MS = 6000;

// Se il server non riconosce più il dispositivo (database ricreato), l'app si registra
// di nuovo in automatico e ripete la richiesta una volta. La funzione la imposta AppContext.
let reauthHandler = null;
const REQUEST_TIMEOUT_MS = 45000;
export function setReauthHandler(fn) {
  reauthHandler = fn;
}

// deviceId: identificativo segreto del dispositivo. Viaggia nell'header X-Device-Id,
// mai nell'indirizzo, così non finisce nei log dei server.
async function request(path, opts = {}) {
  const { method = 'GET', body, params, deviceId, retried } = opts;
  const query = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (deviceId) headers['X-Device-Id'] = deviceId;
  // Timeout: senza, una richiesta può restare appesa per sempre. 45 s lasciano tempo
  // al server gratuito di Render di "svegliarsi" (circa 30–50 s dopo una pausa).
  let res;
  let lastError;
  const n = API_URLS.length;
  for (let attempt = 0; attempt < n; attempt++) {
    const idx = (currentUrl + attempt) % n;
    const isLast = attempt === n - 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), isLast ? REQUEST_TIMEOUT_MS : FALLBACK_TIMEOUT_MS);
    try {
      res = await fetch(`${API_URLS[idx]}${path}${query}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      currentUrl = idx;
      break;
    } catch (e) {
      lastError = e;
      // Una scrittura scaduta per timeout potrebbe essere arrivata al server:
      // non la ripetiamo su un altro indirizzo per non crearla due volte.
      if (e?.name === 'AbortError' && method !== 'GET') break;
    } finally {
      clearTimeout(timer);
    }
  }
  if (!res) {
    if (lastError?.name === 'AbortError') {
      throw new Error('Il server non risponde. Riprova tra qualche secondo.');
    }
    throw new Error(`Server non raggiungibile (${API_URLS.join(' / ')}). Controlla la connessione.`);
  }
  if (res.status === 401 && deviceId && !retried && path !== '/users' && reauthHandler) {
    await reauthHandler(deviceId);
    return request(path, { ...opts, retried: true });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : `Errore ${res.status} da ${getApiUrl()}${path}`);
  }
  return data;
}

// Risveglio del server: su Render gratuito il backend si "addormenta" dopo 15 minuti senza
// richieste e impiega 30–50 s a ripartire. Una richiesta leggera appena si apre l'app lo fa
// partire mentre l'utente guarda ancora la schermata iniziale. Non blocca nulla e ignora gli errori.
let lastWake = 0;
export function wakeServer(minIntervalMs = 5 * 60 * 1000) {
  const now = Date.now();
  if (now - lastWake < minIntervalMs) return;
  lastWake = now;
  API_URLS.forEach((u) => fetch(`${u}/`, { method: 'GET' }).catch(() => {}));
}

export const api = {
  registerUser: (deviceId, nickname, profile) =>
    request('/users', { method: 'POST', body: { nickname, profile }, deviceId }),
  listReports: (profile, deviceId, scope = 'active') =>
    request('/reports', { params: { scope, profile }, deviceId }),
  getReport: (id, deviceId) => request(`/reports/${id}`, { deviceId }),
  nearby: (lat, lon, category, deviceId) =>
    request('/reports/nearby', { params: { lat, lon, category }, deviceId }),
  photoUrl: (id) => `${getApiUrl()}/reports/${id}/photo`,
  createReport: (data, deviceId) => request('/reports', { method: 'POST', body: data, deviceId }),
  vote: (id, deviceId, present) =>
    request(`/reports/${id}/vote`, { method: 'POST', body: { present }, deviceId }),
  deleteReport: (id, deviceId) => request(`/reports/${id}`, { method: 'DELETE', deviceId }),
  // near: punto di partenza, per preferire i risultati vicini
  geocode: (q, near) => request('/geocode', { params: { q, lat: near?.lat, lon: near?.lon } }),
  route: (start, end, profile) =>
    request('/route', {
      method: 'POST',
      body: { start: [start.lat, start.lon], end: [end.lat, end.lon], profile },
    }),
  myStats: (deviceId) => request('/stats/me', { deviceId }),
  cityStats: () => request('/stats/city'),
};
