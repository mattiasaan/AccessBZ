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

async function request(path, { method = 'GET', body, params } = {}) {
  const query = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  let res;
  try {
    res = await fetch(`${API_URL}${path}${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Server non raggiungibile (${API_URL}). Controlla la connessione.`);
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
    request('/users', { method: 'POST', body: { device_id: deviceId, nickname, profile } }),
  listReports: (profile, deviceId, scope = 'active') =>
    request('/reports', { params: { scope, profile, device_id: deviceId } }),
  getReport: (id, deviceId) => request(`/reports/${id}`, { params: { device_id: deviceId } }),
  nearby: (lat, lon, category, deviceId) =>
    request('/reports/nearby', { params: { lat, lon, category, device_id: deviceId } }),
  photoUrl: (id) => `${API_URL}/reports/${id}/photo`,
  createReport: (data) => request('/reports', { method: 'POST', body: data }),
  vote: (id, deviceId, present) =>
    request(`/reports/${id}/vote`, { method: 'POST', body: { device_id: deviceId, present } }),
  deleteReport: (id, deviceId) =>
    request(`/reports/${id}`, { method: 'DELETE', params: { device_id: deviceId } }),
  geocode: (q) => request('/geocode', { params: { q } }),
  route: (start, end, profile) =>
    request('/route', {
      method: 'POST',
      body: { start: [start.lat, start.lon], end: [end.lat, end.lon], profile },
    }),
  myStats: (deviceId) => request('/stats/me', { params: { device_id: deviceId } }),
  cityStats: () => request('/stats/city'),
};
