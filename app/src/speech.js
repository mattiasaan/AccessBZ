// Sintesi vocale di AccessBZ, basata su expo-speech, che usa il motore di sistema:
//  - Android: TextToSpeech (di solito "Servizi di sintesi vocale di Google", voci neurali)
//  - iOS: AVSpeechSynthesizer di Apple
//
// Due accorgimenti:
// 1) "Riscaldamento": il motore vocale impiega 1–3 s a partire la prima volta. Lo prepariamo
//    all'apertura dell'app, così il primo avviso parte subito.
// 2) Su iOS la voce predefinita è quella "compatta". Se sul telefono è installata una voce
//    migliore nella lingua dell'app (italiano o tedesco) (Avanzata o Premium, da Impostazioni > Accessibilità > Contenuti letti ad alta voce > Voci)
//    la usiamo. Su Android teniamo la voce predefinita del sistema, che è già ottima.
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

import { getLanguage } from './i18n';

const LOCALES = { it: 'it-IT', de: 'de-DE' };
const voiceIds = {}; // lingua -> voce iOS migliore (assente = voce predefinita)
let ready = null;

const current = () => {
  const lang = getLanguage();
  return { language: LOCALES[lang] || LOCALES.it, voice: voiceIds[lang] };
};

function rankIosVoice(v) {
  const id = (v.identifier || '').toLowerCase();
  if (id.includes('premium')) return 3;
  if (id.includes('enhanced') || v.quality === Speech.VoiceQuality.Enhanced) return 2;
  return 1;
}

export function initSpeech() {
  if (ready) return ready;
  ready = (async () => {
    try {
      // Su Android questa chiamata avvia anche il motore TextToSpeech
      const voices = await Speech.getAvailableVoicesAsync();
      if (Platform.OS === 'ios') {
        for (const lang of Object.keys(LOCALES)) {
          const list = voices.filter((v) => (v.language || '').toLowerCase().startsWith(lang));
          list.sort((a, b) => rankIosVoice(b) - rankIosVoice(a));
          if (list[0] && rankIosVoice(list[0]) > 1) voiceIds[lang] = list[0].identifier;
        }
        // Frase muta: carica la voce in memoria
        Speech.speak(' ', { ...current(), volume: 0 });
      }
    } catch {
      // Se qualcosa va storto si usa semplicemente la voce predefinita
    }
  })();
  return ready;
}

export function speak(text, { rate = 0.95 } = {}) {
  Speech.stop();
  Speech.speak(text, { ...current(), rate });
}

export function stopSpeaking() {
  Speech.stop();
}
