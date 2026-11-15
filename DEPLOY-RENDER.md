# 🚀 Avvio su Render e build dell'APK

Checklist da seguire in ordine. Il codice su `main` è già pronto: librerie verificate su
Python 3.12.7 (quello di Render), test superati, avvio in modalità produzione provato.

## 1. Backend su Render

1. Su <https://dashboard.render.com>: **New → Blueprint** → repository `AccessBZ`.
   Render legge [render.yaml](render.yaml) e crea il server `accessbz-api` e il database `accessbz-db`.
2. Quando lo chiede, inserisci `ORS_API_KEY` (la chiave di openrouteservice.org).
3. **Controlla l'indirizzo del servizio.** Se non è esattamente
   `https://accessbz-api.onrender.com`, aggiornalo prima della build in:
   - [app/eas.json](app/eas.json): profili `preview` e `production`;
   - [app/app.json](app/app.json): `extra.apiUrl`.
4. Apri l'indirizzo nel browser. Deve rispondere:
   ```json
   {"app":"AccessBZ","ok":true,"routing":true}
   ```
   Se `routing` è `false`, la chiave ORS manca o è sbagliata.
5. Aspetta circa 30 secondi: il popolamento parte 10 s dopo il server e crea le segnalazioni di
   esempio. Controlla che la mappa nell'app le mostri.

## 2. Prima della build

- [app/src/constants.js](app/src/constants.js): `SHOW_ACCOUNT_RESET`
  - `true` se ti serve ancora il pulsante "Reset account" (per esempio per girare il video);
  - `false` per la versione da consegnare al concorso.

  Se lo usi per il video: prima riprese, poi una seconda build con `false` per il link finale.

## 3. Build dell'APK

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

Alla fine EAS fornisce il link per scaricare l'APK: è il link da mettere nel modulo del concorso.

Installalo su un telefono e prova tutto il giro: profilo → mappa → percorso → segnalazione con
foto → conferma da un secondo dispositivo → avviso vocale.

## ⚠️ Limiti del piano gratuito

| Limite | Cosa fare |
|---|---|
| Il database scade **30 giorni** dopo la creazione | Segnati la data. Il link resta pubblicato su fabriziorocca.it: rinnovalo o passa al Raspberry Pi |
| Il server si addormenta dopo **15 minuti** senza richieste; la prima risposta arriva dopo 30–50 s | Aprilo dal browser prima delle riprese e prima della valutazione |
| **Un solo database gratuito** per account | Se ne hai già uno attivo, il Blueprint fallisce sul database: eliminalo prima |

## Se qualcosa non va

- **Deploy fallito:** su Render → servizio `accessbz-api` → **Logs**. Gli errori di avvio compaiono lì.
- **Mappa vuota:** nei log cerca la riga `Generate ... segnalazioni`. Se manca, riavvia il
  servizio (**Manual Deploy → Restart service**).
- **L'app non si collega:** verifica che l'indirizzo in `eas.json` sia quello vero del servizio,
  poi rifai la build (l'indirizzo è scritto dentro l'APK).
