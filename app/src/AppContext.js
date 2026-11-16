// Stato condiviso dell'app: utente, profilo, posizione, ostacoli, percorso attivo,
// avvisi di prossimità e simulazione del tragitto.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { AppState } from 'react-native';

import { api, setReauthHandler, wakeServer } from './api';
import { initSpeech, speak } from './speech';
import { ALERT_RADIUS_M, CATEGORIES, DEFAULT_PROFILE, LEGACY_PROFILES, PROFILES } from './constants';
import { deviceLanguage, getLanguage, persons, setLanguage, t } from './i18n';
import { distanceM, locateOnRoute, pointAlong, randomId } from './utils';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const STORAGE_KEY = 'accessbz:user';
const SETTINGS_KEY = 'accessbz:settings';
const REANNOUNCE_AFTER_MS = 10 * 60 * 1000;
const ROUTE_THRESHOLD_M = 20;  // un ostacolo è "sul percorso" se dista meno di così (come nel backend)
const OFF_ROUTE_M = 35;        // oltre questa distanza dal percorso consideriamo l'utente fuori percorso
const LOOKAHEAD_M = 60;        // avvisa per gli ostacoli entro 60 m davanti
const BEHIND_TOLERANCE_M = 5;  // margine per l'imprecisione del GPS
const SIM_SPEED_MPS = 4; // velocità della simulazione (un po' più veloce di una camminata)

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null); // { deviceId, nickname, profile }
  // language: lingua dell'app (it/de). Prima scelta: la lingua del telefono.
  const [settings, setSettings] = useState({ voice: true, language: deviceLanguage() });
  // La lingua attiva va impostata prima di disegnare i testi: t() la legge da i18n.js
  setLanguage(settings.language);
  const [reports, setReports] = useState([]);
  const [reportsError, setReportsError] = useState(null);
  const [gpsPosition, setGpsPosition] = useState(null);
  const [simPosition, setSimPosition] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [alert, setAlert] = useState(null); // { report, distance }
  const [openReportId, setOpenReportId] = useState(null);
  const [focusPoint, setFocusPoint] = useState(null); // punto da centrare sulla mappa

  const announced = useRef({});
  const simTimer = useRef(null);

  const position = simPosition || gpsPosition;
  const deviceId = user ? user.deviceId : null;

  // ---------- risveglio del server ----------
  // Appena l'app si apre (anche prima della registrazione) e ogni volta che torna in primo piano
  useEffect(() => {
    wakeServer(0);
    initSpeech(); // prepara il motore vocale: il primo avviso parte senza ritardo
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') wakeServer();
    });
    return () => sub.remove();
  }, []);

  // ---------- caricamento iniziale ----------
  useEffect(() => {
    (async () => {
      try {
        const [u, s] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
        ]);
        if (u) {
          const stored = JSON.parse(u);
          // Profilo di una versione precedente (Pedone, Bicicletta): passa al nuovo profilo
          if (!PROFILES[stored.profile]) {
            stored.profile = LEGACY_PROFILES[stored.profile] || DEFAULT_PROFILE;
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored)).catch(() => {});
            api.registerUser(stored.deviceId, stored.nickname, stored.profile).catch(() => {});
          }
          setUser(stored);
        }
        if (s) setSettings((prev) => ({ ...prev, ...JSON.parse(s) }));
      } catch {}
      setReady(true);
    })();
  }, []);

  // Ri-registrazione automatica se durante l'uso il server risponde "Utente non registrato"
  const userRef = useRef(user);
  userRef.current = user;
  useEffect(() => {
    setReauthHandler(async (id) => {
      const u = userRef.current;
      if (!u) return;
      await api.registerUser(id, u.nickname, u.profile).catch(() => {});
    });
    return () => setReauthHandler(null);
  }, []);

  // ---------- GPS ----------
  useEffect(() => {
    if (!user) return;
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
        (loc) => setGpsPosition({ lat: loc.coords.latitude, lon: loc.coords.longitude }),
      );
    })();
    return () => sub?.remove();
  }, [user?.deviceId]);

  // ---------- utente ----------
  const saveUser = useCallback(async (next) => {
    setUser(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const register = useCallback(
    async (nickname, profile) => {
      const id = user?.deviceId || randomId();
      await api.registerUser(id, nickname, profile);
      await saveUser({ ...(user || {}), deviceId: id, nickname, profile });
    },
    [user, saveUser],
  );

  const setProfile = useCallback(
    async (profile) => {
      if (!user) return;
      await api.registerUser(user.deviceId, user.nickname, profile);
      await saveUser({ ...user, profile });
    },
    [user, saveUser],
  );

  // SOLO SVILUPPO: dimentica l'utente su questo telefono e torna alla schermata iniziale.
  // Al nuovo accesso viene generato un nuovo ID dispositivo (= nuovo utente).
  // I dati del vecchio utente restano sul server.
  const resetAccount = useCallback(async () => {
    clearInterval(simTimer.current);
    simTimer.current = null;
    setSimPosition(null);
    setActiveRoute(null);
    setAlert(null);
    setOpenReportId(null);
    setReports([]);
    reportsRequest.current += 1; // ignora eventuali risposte ancora in arrivo per il vecchio utente
    announced.current = {};
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const updateSettings = useCallback(async (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // ---------- segnalazioni ----------
  // Contatore delle richieste: se ne parte una nuova (es. cambio profilo),
  // la risposta di quella vecchia viene ignorata invece di sovrascrivere i dati nuovi.
  const reportsRequest = useRef(0);
  const refreshReports = useCallback(async () => {
    if (!user) return;
    const seq = ++reportsRequest.current;
    try {
      const list = await api.listReports(user.profile, deviceId);
      if (seq !== reportsRequest.current) return;
      setReports(list);
      setReportsError(null);
    } catch (e) {
      if (seq !== reportsRequest.current) return;
      setReportsError(e.message);
    }
  }, [user?.profile, deviceId]);

  useEffect(() => {
    refreshReports();
    const t = setInterval(refreshReports, 30000);
    return () => clearInterval(t);
  }, [refreshReports]);

  // ---------- avvisi di prossimità ----------
  // Durante la navigazione: ostacoli proiettati sul percorso (calcolati una volta sola)
  const onRoute = useMemo(() => {
    if (!activeRoute) return null;
    return reports
      .map((r) => ({ report: r, ...locateOnRoute(r, activeRoute.geometry) }))
      .filter((p) => p.dist <= ROUTE_THRESHOLD_M);
  }, [activeRoute, reports]);

  useEffect(() => {
    if (!position || !reports.length) return;
    const now = Date.now();
    const fresh = (r) => now - (announced.current[r.id] || 0) >= REANNOUNCE_AFTER_MS;
    let nearest = null;

    // 1) In navigazione e sul percorso: solo gli ostacoli DAVANTI, in ordine di arrivo
    let directional = false;
    if (onRoute) {
      const me = locateOnRoute(position, activeRoute.geometry);
      if (me.dist <= OFF_ROUTE_M) {
        directional = true;
        for (const p of onRoute) {
          const ahead = p.along - me.along;
          if (ahead < -BEHIND_TOLERANCE_M || ahead > LOOKAHEAD_M || !fresh(p.report)) continue;
          if (!nearest || ahead < nearest.distance) nearest = { report: p.report, distance: Math.max(0, ahead), ahead: true };
        }
      }
    }

    // 2) Altrimenti (o fuori dal percorso): tutti gli ostacoli nel raggio di 40 m
    if (!directional) {
      for (const r of reports) {
        const d = distanceM(position, r);
        if (d > ALERT_RADIUS_M || !fresh(r)) continue;
        if (!nearest || d < nearest.distance) nearest = { report: r, distance: d };
      }
    }
    if (!nearest) return;

    announced.current[nearest.report.id] = now;
    setAlert(nearest);
    if (settings.voice) {
      const label = CATEGORIES[nearest.report.category]?.label || t('common.obstacle');
      const meters = Math.max(5, Math.round(nearest.distance / 5) * 5);
      // In italiano "Tra 20 metri, lavori." (minuscolo); in tedesco i nomi restano maiuscoli
      const midLabel = getLanguage() === 'it' ? label.toLowerCase() : label;
      let text = nearest.ahead
        ? nearest.distance < 8
          ? t('voice.now', { l: label })
          : t('voice.ahead', { m: meters, l: midLabel })
        : t('voice.near', { l: label, m: meters });
      if (nearest.report.confirmations > 0) {
        text += t('voice.confirmed', { p: persons(nearest.report.confirmations) });
      }
      speak(text);
    }
  }, [position, reports, onRoute, settings.voice]);

  const dismissAlert = useCallback(() => setAlert(null), []);

  // ---------- simulazione del tragitto ----------
  const stopSimulation = useCallback(() => {
    clearInterval(simTimer.current);
    simTimer.current = null;
    setSimPosition(null);
  }, []);

  const startSimulation = useCallback(
    (geometry) => {
      stopSimulation();
      announced.current = {};
      let travelled = 0;
      const first = pointAlong(geometry, 0);
      setSimPosition({ lat: first.lat, lon: first.lon });
      simTimer.current = setInterval(() => {
        travelled += SIM_SPEED_MPS;
        const p = pointAlong(geometry, travelled);
        setSimPosition({ lat: p.lat, lon: p.lon });
        if (p.done) {
          clearInterval(simTimer.current);
          simTimer.current = null;
          if (settings.voice) speak(t('voice.arrived'));
        }
      }, 1000);
    },
    [stopSimulation, settings.voice],
  );

  useEffect(() => () => clearInterval(simTimer.current), []);

  const value = {
    ready,
    user,
    deviceId,
    register,
    setProfile,
    resetAccount,
    settings,
    updateSettings,
    language: settings.language,
    reports,
    reportsError,
    refreshReports,
    position,
    gpsPosition,
    simulating: !!simPosition,
    startSimulation,
    stopSimulation,
    activeRoute,
    setActiveRoute,
    alert,
    dismissAlert,
    openReportId,
    openReport: setOpenReportId,
    focusPoint,
    setFocusPoint,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
