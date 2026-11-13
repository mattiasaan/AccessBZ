# ♿ AccessBZ — Dynamic Accessibility Network

> La città è la stessa. Il percorso non lo è.

Mappa dinamica degli ostacoli urbani di Bolzano: segnalazioni con foto e durata stimata,
conferme della community, ciclo di vita temporale dell'ostacolo, percorsi A/B che evitano
gli ostacoli e avvisi vocali di prossimità. Idea completa in [AccessBZ.md](AccessBZ.md).

| Cartella | Contenuto |
|---|---|
| `backend/` | API FastAPI + SQLAlchemy (SQLite in locale, PostgreSQL su Render) |
| `app/` | App Expo / React Native (mappa Leaflet + OpenStreetMap in WebView) |
| `render.yaml` | Deploy automatico del backend su Render |

## 1. Chiave OpenRouteService (percorsi)

1. Registrati gratis su <https://openrouteservice.org/dev/#/signup>.
2. Copia la chiave API (piano gratuito).
3. Impostala nella variabile `ORS_API_KEY` (in locale e su Render).

Senza la chiave funziona tutto tranne la schermata **Percorso**.

## 2. Backend in locale

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python seed.py --reset          # dati DEMO nel centro di Bolzano
set ORS_API_KEY=la_tua_chiave   # PowerShell: $env:ORS_API_KEY="la_tua_chiave"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Documentazione interattiva delle API: <http://localhost:8000/docs>. Test: `python -m pytest tests`.

## 3. App in sviluppo (Expo Go su iPhone o Android)

Il telefono deve essere sulla stessa rete Wi-Fi del PC. Trova l'IP del PC con `ipconfig`.

```bash
cd app
set EXPO_PUBLIC_API_URL=http://192.168.1.XX:8000   # PowerShell: $env:EXPO_PUBLIC_API_URL="http://192.168.1.XX:8000"
npx expo start
```

Inquadra il QR code con Expo Go.

## 4. Backend online su Render

1. Carica la cartella del progetto su un repository GitHub.
2. Su Render: **New → Blueprint** → scegli il repository (usa `render.yaml`).
3. Imposta `ORS_API_KEY` nelle variabili d'ambiente del servizio `accessbz-api`.
4. Copia l'URL del servizio (es. `https://accessbz-api.onrender.com`) in `app/app.json` → `expo.extra.apiUrl`.

Nota: sul piano gratuito il server si "addormenta" dopo 15 minuti senza richieste e il primo
avvio richiede circa 1 minuto. Aprilo dal browser prima di una demo. Il database gratuito di Render
scade dopo 30 giorni.

## 5. APK per la giuria

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

Alla fine EAS fornisce il link da cui scaricare l'APK: è il link da mettere nel modulo del concorso.

## Ciclo di vita di un ostacolo

| Stato | Quando |
|---|---|
| 🟢 Appena segnalato | nessuna conferma da altri utenti |
| 🟡 Confermato | almeno un altro utente dice "è ancora presente" |
| 🔴 Persistente | 3+ conferme, oppure dura più della durata prevista |
| ⚪ Risolto | l'autore oppure 2 utenti diversi dicono "non c'è più" |
| 🗑️ Scaduto | nessuna conferma entro il tempo massimo (1 h per "pochi minuti", 6 h per "qualche ora", 4 giorni, 4 settimane, 3 giorni se durata sconosciuta) |

La logica è in [backend/app/lifecycle.py](backend/app/lifecycle.py): nessuna AI, solo timestamp, durate e conferme.

## Dati e servizi usati

- Mappa: © OpenStreetMap contributors (Leaflet)
- Percorsi e ricerca indirizzi: openrouteservice.org (profili `wheelchair`, `foot-walking`, `cycling-regular`). Gli ostacoli attivi vengono passati come `avoid_polygons` per calcolare il percorso alternativo.
- Le segnalazioni demo create da `seed.py` sono **simulate** e marcate come "Dato dimostrativo".
