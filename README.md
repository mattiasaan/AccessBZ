# ♿ AccessBZ — Dynamic Accessibility Network

> La città è la stessa. Il percorso non lo è.

Mappa dinamica degli ostacoli urbani di Bolzano: segnalazioni con foto e durata stimata,
conferme della community, ciclo di vita temporale dell'ostacolo, memoria del luogo,
percorsi A/B che evitano gli ostacoli e avvisi vocali nella direzione di marcia.
Idea completa in [AccessBZ.md](AccessBZ.md).

L'app è in **italiano e tedesco** (testi, avvisi vocali e nomi dei luoghi nella ricerca): la lingua
si sceglie nella prima schermata o nel Profilo, e all'inizio segue quella del telefono.
Le traduzioni sono in [app/src/i18n.js](app/src/i18n.js).

| Cartella | Contenuto |
|---|---|
| `backend/` | API FastAPI + SQLAlchemy (SQLite in locale e su Raspberry Pi, PostgreSQL su Render) |
| `app/` | App Expo / React Native (mappa Leaflet + OpenStreetMap in WebView) |
| `render.yaml` | Deploy automatico del backend su Render |
| `deploy/raspberry-pi/` | Installazione del backend su Raspberry Pi con systemd |

## 1. Chiave OpenRouteService (percorsi)

1. Registrati gratis su <https://openrouteservice.org/dev/#/signup> e crea un token (piano Standard).
2. Copia `backend/.env.example` in `backend/.env` e incolla la chiave in `ORS_API_KEY`.
   Su Render la chiave si imposta nel pannello del servizio, non nel file.

Senza la chiave funziona tutto tranne la schermata **Percorso**.

## 2. Backend in locale

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python populate.py --reset
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Documentazione interattiva (solo in sviluppo): <http://localhost:8000/docs>. Test: `python -m pytest tests`.

### Dati di esempio: `populate.py`

Genera segnalazioni realistiche in **luoghi reali di Bolzano** presi da OpenStreetMap
([backend/data](backend/data/README.md)):

| Categoria | Dove | Quando |
|---|---|---|
| Veicolo sul marciapiede | attraversamenti, scuole, farmacie, negozi | picchi alle 7–8, 12–13, 17–18; meno nel weekend |
| Tavolini | bar, ristoranti, gelaterie | pranzo e sera, di più nel weekend |
| Bici e monopattini | rastrelliere, attraversamenti | mattina e pomeriggio |
| Lavori, chiusure | attraversamenti, percorsi pedonali | inizio alle 7–8 nei giorni feriali, durano giorni |
| Cantieri | aree di cantiere mappate in OSM | durano settimane |
| Ascensore guasto | i veri ascensori pubblici della città | durata incerta |
| Neve e ghiaccio (`--winter`) | ponti, scale, percorsi pedonali | mattina presto, solo nei giorni di neve |

Ogni categoria ha dei "punti caldi" che si ripetono (così la memoria del luogo ha senso), durate
realistiche, conferme e chiusure da parte di utenti diversi, e qualche segnalazione che scade.

```bash
python populate.py --reset                 # rigenera tutto (default: 45 giorni, scala 3)
python populate.py --refresh-if-stale 12   # rigenera solo i dati generati se hanno più di 12 ore
python populate.py --scale 4 --winter      # più segnalazioni, con neve e ghiaccio
python populate.py --refresh-osm           # riscarica i luoghi da OpenStreetMap
```

`--refresh-if-stale` non tocca mai le segnalazioni degli utenti veri: su Render e sul Pi gira
in automatico, così la mappa resta "viva" anche dopo giorni.

## 3. App in sviluppo (Expo Go su iPhone o Android)

Telefono e PC sulla stessa rete Wi-Fi. In sviluppo l'app usa da sola l'IP del PC (porta 8000).

```bash
cd app
npx expo start
```

Se qualcosa sembra "vecchio" dopo un cambio di configurazione: `npx expo start -c`.

## 4. Backend su Render (online, HTTPS)

Checklist completa, con i controlli e i limiti del piano gratuito: [DEPLOY-RENDER.md](DEPLOY-RENDER.md).

1. Su <https://dashboard.render.com>: **New → Blueprint** → repository `AccessBZ` (usa `render.yaml`).
2. Quando lo chiede, inserisci `ORS_API_KEY`.
3. Al primo avvio il database viene popolato da solo.
4. Se l'URL del servizio non è `https://accessbz-api.onrender.com`, aggiornalo in `app/eas.json`
   (profili `preview` e `production`) e in `app/app.json` → `extra.apiUrl`.

Piano gratuito: il server si "addormenta" dopo 15 minuti senza richieste e la prima risposta
arriva dopo circa 30–50 secondi (l'app aspetta fino a 45 s). Aprilo dal browser prima di una demo.
Il database gratuito di Render scade dopo 30 giorni.

## 5. Backend su Raspberry Pi (rete locale)

Sul Pi (Raspberry Pi OS, meglio 64 bit), in una cartella senza spazi nel percorso:

```bash
git clone https://github.com/mattiasaan/AccessBZ.git
cd AccessBZ
bash deploy/raspberry-pi/install.sh
```

Lo script installa tutto, chiede la chiave ORS, crea il database SQLite con i dati di esempio e
avvia due servizi systemd: `accessbz` (server, riparte da solo) e `accessbz-refresh.timer`
(ogni ora rigenera i dati di esempio se sono vecchi). Alla fine stampa l'indirizzo, ad esempio
`http://192.168.1.50:8000`: mettilo nel profilo `pi` di `app/eas.json`.

Comandi utili: `bash deploy/raspberry-pi/update.sh` (aggiorna e riavvia),
`journalctl -u accessbz -f` (log), `sudo systemctl restart accessbz`.

Il profilo `pi` può contenere più indirizzi separati da virgola, ad esempio IP locale e IP
Tailscale: `http://192.168.1.17:8000,http://100.74.242.92:8000`. L'app usa il primo che risponde
(a casa la rete locale, fuori casa Tailscale, se l'app Tailscale è attiva sul telefono).
Il Pi non ha HTTPS: per questo solo l'APK `pi` permette connessioni `http://`.

## 6. APK Android

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest init                                   # solo la prima volta
npx eas-cli@latest build -p android --profile preview     # APK collegato a Render
npx eas-cli@latest build -p android --profile pi          # APK collegato al Raspberry Pi
```

Alla fine EAS fornisce il link per scaricare l'APK: è il link da mettere nel modulo del concorso
(profilo `preview`). L'APK `pi` permette connessioni `http://` solo perché il Pi non ha HTTPS.

Prima della versione finale: in `app/src/constants.js` metti `SHOW_ACCOUNT_RESET = false`.

Le icone si rigenerano con `..\backend\.venv\Scripts\python scripts\make_icons.py` (dalla cartella `app`).

## Ciclo di vita di un ostacolo

| Stato | Quando |
|---|---|
| 🟢 Appena segnalato | nessuna conferma da altri utenti |
| 🟡 Confermato | almeno un altro utente dice "è ancora presente" |
| 🔴 Persistente | 3+ conferme, oppure dura più della durata prevista |
| ⚪ Risolto | l'autore oppure 2 utenti diversi dicono "non c'è più" |
| 🗑️ Scaduto | nessuna conferma entro il tempo massimo (1 h per "pochi minuti", 6 h per "qualche ora", 4 giorni, 4 settimane, 3 giorni se durata sconosciuta) |

La logica è in [backend/app/lifecycle.py](backend/app/lifecycle.py): nessuna AI, solo timestamp, durate e conferme.

## Sicurezza

Rate limiting per IP e per dispositivo, limite di 2 MB letto prima di caricare la richiesta,
foto verificate e ricodificate senza EXIF/GPS, nessun soprannome nelle risposte pubbliche (luogo + ora + nome permetterebbero di seguire una persona), ID del dispositivo solo nell'header `X-Device-Id`,
testi ripuliti, area di servizio limitata al Trentino-Alto Adige (i dati di esempio coprono Bolzano e dintorni), header di sicurezza, CORS chiuso in produzione,
`/docs` disattivato in produzione. Dettagli in [backend/app/security.py](backend/app/security.py).

## Dati e servizi usati

- Mappa e luoghi per i dati di esempio: © OpenStreetMap contributors (ODbL)
- Percorsi e ricerca indirizzi: openrouteservice.org (profili `wheelchair`, `foot-walking`, `cycling-regular`). Gli ostacoli attivi vengono passati come `avoid_polygons` per calcolare il percorso alternativo.
- Icone: Material Design Icons
