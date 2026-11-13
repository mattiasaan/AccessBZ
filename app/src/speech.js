// Sintesi vocale di AccessBZ, basata su expo-speech, che usa il motore di sistema:
//  - Android: TextToSpeech (di solito "Servizi di sintesi vocale di Google", voci neurali)
//  - iOS: AVSpeechSynthesizer di Apple
//
// Due accorgimenti:
// 1) "Riscaldamento": il motore vocale impiega 1–3 s a partire la prima volta. Lo prepariamo
//    all'apertura dell'app, così il primo avviso parte subito.
// 2) Su iOS la voce predefinita è quella "compatta". Se sul telefono è installata una voce
//    italiana migliore (Avanzata o Premium, da Impostazioni > Accessibilità > Contenuti letti ad alta voce > Voci)
//    la usiamo. Su Android teniamo la voce predefinita del sistema, che è già ottima.
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

const LANGUAGE = 'it-IT';
let voiceId; // undefined = voce predefinita
let ready = null;

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
        const italian = voices.filter((v) => (v.language || '').toLowerCase().startsWith('it'));
        italian.sort((a, b) => rankIosVoice(b) - rankIosVoice(a));
        if (italian[0] && rankIosVoice(italian[0]) > 1) voiceId = italian[0].identifier;
        // Frase muta: carica la voce in memoria
        Speech.speak(' ', { language: LANGUAGE, voice: voiceId, volume: 0 });
      }
    } catch {
      // Se qualcosa va storto si usa semplicemente la voce predefinita
    }
  })();
  return ready;
}

export function speak(text, { rate = 0.95 } = {}) {
  Speech.stop();
  Speech.speak(text, { language: LANGUAGE, voice: voiceId, rate });
}

export function stopSpeaking() {
  Speech.stop();
}
