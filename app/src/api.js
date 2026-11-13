// Comunicazione con il backend FastAPI.
// L'indirizzo si imposta in app.json -> expo.extra.apiUrl
// (oppure con la variabile EXPO_PUBLIC_API_URL durante lo sviluppo).
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

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  devApiUrl() ||
  Constants.expoConfig?.extra?.apiUrl ||
  'http://localhost:8000'
).replace(/\/$/, '');

// Se il server non riconosce più il dispositivo (database ricreato), l'app si registra
// di nuovo in automatico e ripete la richiesta una volta. La funzione la imposta AppContext.
let reauthHandler = null;
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
  let res;
  try {
    res = await fetch(`${API_URL}${path}${query}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Server non raggiungibile (${API_URL}). Controlla la connessione.`);
  }
  if (res.status === 401 && deviceId && !retried && path !== '/users' && reauthHandler) {
    await reauthHandler(deviceId);
    return request(path, { ...opts, retried: true });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : `Errore ${res.status} da ${API_URL}${path}`);
  }
  return data;
}

export const api = {
  registerUser: (deviceId, nickname, profile) =>
    request('/users', { method: 'POST', body: { nickname, profile }, deviceId }),
  listReports: (profile, deviceId, scope = 'active') =>
    request('/reports', { params: { scope, profile }, deviceId }),
  getReport: (id, deviceId) => request(`/reports/${id}`, { deviceId }),
  nearby: (lat, lon, category, deviceId) =>
    request('/reports/nearby', { params: { lat, lon, category }, deviceId }),
  photoUrl: (id) => `${API_URL}/reports/${id}/photo`,
  createReport: (data, deviceId) => request('/reports', { method: 'POST', body: data, deviceId }),
  vote: (id, deviceId, present) =>
    request(`/reports/${id}/vote`, { method: 'POST', body: { present }, deviceId }),
  deleteReport: (id, deviceId) => request(`/reports/${id}`, { method: 'DELETE', deviceId }),
  geocode: (q) => request('/geocode', { params: { q } }),
  route: (start, end, profile) =>
    request('/route', {
      method: 'POST',
      body: { start: [start.lat, start.lon], end: [end.lat, end.lon], profile },
    }),
  myStats: (deviceId) => request('/stats/me', { deviceId }),
  cityStats: () => request('/stats/city'),
};
