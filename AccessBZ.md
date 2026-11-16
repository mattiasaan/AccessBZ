# AccessBZ

Created: August 9, 2026 10:50 PM
Tags: idea

# ♿ AccessBZ — Dynamic Accessibility Network

> **La città è la stessa. Il percorso non lo è.**
> 

---

# 🎯 Concept

AccessBZ è un'applicazione per rendere la mobilità urbana più accessibile attraverso una **mappa dinamica degli ostacoli e delle condizioni reali della città**.

L'app permette agli utenti di:

- trovare percorsi adatti alle proprie esigenze;
- visualizzare ostacoli e problemi presenti lungo il percorso;
- segnalare problemi temporanei;
- sapere da quanto tempo un ostacolo è presente;
- stimare quanto potrebbe durare;
- confermare o smentire le segnalazioni di altri utenti;
- ricevere avvisi vocali quando si avvicinano a un ostacolo;
- scegliere il proprio profilo di mobilità.

Il progetto non vuole essere semplicemente:

> "Google Maps per persone con disabilità."
> 

Il concetto centrale è:

> **una mappa che descrive lo stato attuale della città, non solamente la sua geografia.**
> 

---

# 💡 Il problema

Le mappe tradizionali descrivono principalmente:

- strade;
- edifici;
- percorsi;
- mezzi pubblici;
- luoghi.

Ma una città reale cambia continuamente.

Un percorso che ieri era accessibile potrebbe oggi avere:

- 🚗 un'auto sul marciapiede;
- 🚧 lavori;
- 🏗️ un cantiere;
- 🚫 una strada chiusa;
- 🛗 un ascensore fuori servizio;
- 🪑 tavolini che occupano il passaggio;
- 🌳 un albero caduto;
- ❄️ neve o ghiaccio;
- 🚲 biciclette/parcheggi che bloccano il passaggio.

Questi problemi possono essere particolarmente importanti per:

- persone in carrozzina;
- persone ipovedenti;
- persone anziane;
- persone con difficoltà motorie;
- genitori con passeggini.

Le segnalazioni però le può fare chiunque: chi cammina senza difficoltà vede l'auto sulla rampa
e, segnalandola, aiuta chi da lì non può passare.

---

# 🌆 Il concetto fondamentale

Una mappa tradizionale dice:

> **"Questa strada esiste."**
> 

AccessBZ vuole dire:

> **"Questa strada è percorribile da te, adesso?"**
> 

---

# 👤 Profili: per chi usi AccessBZ?

AccessBZ nasce per le persone per cui un ostacolo in città è un problema vero.
All'inizio l'utente sceglie **per chi usa l'app**: il profilo decide che tipo di percorso
viene calcolato.

> **Se vuoi solo aiutare con le segnalazioni, scegli chi vuoi aiutare.**

## ♿ Carrozzina

Priorità:

- rampe;
- scale;
- ascensori;
- pendenze;
- larghezza dei passaggi;
- superfici problematiche;
- ostacoli sul marciapiede.

---

## 🦯 Ipovedente

Priorità:

- ostacoli;
- lavori;
- attraversamenti;
- deviazioni;
- ostacoli improvvisi.

Possibilità di utilizzare la **sintesi vocale**.

---

## 🧓 Anziani

Priorità:

- scalinate (un gradino si fa, una rampa di scale no);
- neve e ghiaccio, per il rischio di cadute;
- ascensori fuori servizio;
- marciapiedi occupati che costringono a scendere in strada.

Il percorso è a piedi ma **evita le scale**.

---

## 👶 Passeggino

Priorità:

- scale;
- rampe;
- ascensori;
- marciapiedi;
- passaggi stretti.

---

---

# 🗺️ 1. Dynamic City Map

La schermata principale è una mappa della città.

Gli ostacoli vengono visualizzati con marker differenti.

### Possibili categorie

🚗 **Veicolo sul marciapiede**

🚧 **Lavori**

🏗️ **Cantiere**

🚫 **Passaggio chiuso**

🛗 **Ascensore fuori servizio**

🌳 **Ostacolo fisico**

❄️ **Neve/ghiaccio**

⚠️ **Problema di accessibilità**

---

# ⏱️ 2. Segnalazioni dinamiche

Questa è una delle caratteristiche centrali del progetto.

Non tutte le segnalazioni hanno la stessa durata.

### Esempio

🚗 Auto sul marciapiede

> Durata prevista: **< 2 ore**
> 

---

🚧 Lavori stradali

> Durata prevista: **3 giorni**
> 

---

🏗️ Cantiere

> Durata prevista: **3 settimane**
> 

---

🛗 Ascensore guasto

> Durata: **sconosciuta**
> 

# 🔄 Ciclo di vita dell'ostacolo

Ogni segnalazione può avere uno stato.

### 🟢 APPENA SEGNALATO

Un utente ha appena creato la segnalazione.

↓

### 🟡 CONFERMATO

Uno o più utenti hanno confermato che l'ostacolo è realmente presente.

↓

### 🔴 PERSISTENTE

L'ostacolo continua a essere presente nel tempo.

↓

### ⚪ RISOLTO

Un utente conferma che il problema non esiste più.

↓

### 🗑️ SCADUTO

La segnalazione supera il tempo massimo previsto e viene rimossa automaticamente se non viene riconfermata.

---

# 📸 3. Segnalazione di un ostacolo

L'utente può creare rapidamente una segnalazione.

### Flusso

**+ SEGNALA**

↓

Scegli categoria:

- 🚗 auto
- 🚧 lavori
- 🚫 passaggio chiuso
- 🛗 ascensore
- 🌳 ostacolo
- ⚠️ altro

↓

📸 Foto opzionale

↓

📍 Posizione GPS

↓

⏱️ Durata stimata

↓

**PUBBLICA**

---

# ⏱️ Durata stimata

Quando viene creata una segnalazione, l'utente può indicare la durata prevista.

Esempio:

### Quanto durerà?

- ⚡ pochi minuti
- 🕐 qualche ora
- 📅 alcuni giorni
- 🗓️ alcune settimane
- ❓ non lo so

In futuro il sistema potrebbe stimare automaticamente la durata sulla base dello storico.

---

# 👥 4. Conferme della community

La community non serve solamente a creare contenuti.

Serve anche a **mantenere aggiornati i dati**.

Esempio:

> 🚗 Auto sul marciapiede
> 
> 
> Segnalato 12 minuti fa
> 
> **È ancora presente?**
> 
> 🟢 Sì
> 
> 🔴 No
> 

Se molte persone confermano:

> 🔴 OSTACOLO PERSISTENTE
> 

Se nessuno lo riconferma:

> ⚪ la segnalazione può scadere.
> 

---

# 📊 5. Memoria temporale della città

Questa è una delle funzionalità più interessanti da sviluppare in futuro.

AccessBZ può raccogliere informazioni sulla durata degli ostacoli.

Esempio:

### Via Roma

Questo mese:

- 27 ostacoli segnalati;
- durata media: 43 minuti;
- 8 segnalazioni di veicoli sul marciapiede;
- 3 lavori stradali;
- 4 passaggi bloccati.

Questo permette di trasformare le segnalazioni in **dati sulla vivibilità della città**.

---

# 🧠 Possibile previsione degli ostacoli

Con abbastanza dati, il sistema potrebbe stimare:

> 🚗 Questo tipo di ostacolo in questa zona dura mediamente **35 minuti**.
> 

Oppure:

> 🚧 I lavori in questa strada sono normalmente presenti tra le 08:00 e le 18:00.
> 

Non è necessario utilizzare AI.

È sufficiente inizialmente utilizzare:

- storico;
- frequenza;
- durata;
- conferme;
- posizione;
- categoria.

---

# 🔊 6. Assistente vocale

Per gli utenti ipovedenti questa può diventare una delle funzioni più importanti.

Quando l'utente si avvicina a un ostacolo:

> 🔊 **"Attenzione. Ostacolo tra 10 metri."**
> 

Oppure:

> 🔊 **"Tra 20 metri il marciapiede è interrotto. Percorso alternativo disponibile."**
> 

---

# 📍 Proximity Warning

Il sistema utilizza:

- GPS;
- posizione dell'ostacolo;
- direzione di movimento;
- distanza.

Quando l'utente entra in una determinata area:

**→ avviso vocale**

---

# 🧭 7. Percorso personalizzato

L'utente può inserire una destinazione.

AccessBZ considera:

- ostacoli;
- accessibilità;
- profilo dell'utente;
- segnalazioni recenti.

E propone un percorso.

Esempio:

### Percorso A

⏱️ 12 min

⚠️ 3 ostacoli

---

### Percorso B

⏱️ 14 min

🟢 0 ostacoli rilevati

---

L'utente può quindi scegliere:

> **"Preferisco impiegare 2 minuti in più ma evitare gli ostacoli."**
> 

# 👁️ 8. Anteprima del percorso

Una funzione molto importante per differenziarsi dalle normali mappe.

Prima di partire l'utente può vedere:

> **Cosa troverò lungo il percorso?**
> 

Esempio:

```
🏠 PARTENZA
      │
      🟢
      │
      🚧 lavori
      │
      ♿ rampa
      │
      🚗 ostacolo
      │
      🟢
      │
🏥 DESTINAZIONE
```

Questo permette di capire **la situazione del percorso prima di percorrerlo**.

---

# 🌐 9. Informazioni statiche + dinamiche

AccessBZ dovrebbe distinguere due tipi di informazioni.

## 🏢 Informazioni statiche

Cambiano raramente:

- presenza di scale;
- presenza di ascensore;
- presenza di rampa;
- larghezza del passaggio;
- pendenza;
- accessibilità di un edificio.

---

## 🔄 Informazioni dinamiche

Cambiano continuamente:

- auto parcheggiate male;
- lavori;
- cantieri;
- ascensori guasti;
- passaggi bloccati;
- deviazioni;
- ostacoli temporanei.

Il vero valore del progetto sta soprattutto nella seconda categoria.

---

# 🏙️ 10. La città vista da utenti diversi

Uno degli elementi concettuali più forti:

> **La città è la stessa. Il percorso non lo è.**
> 

La stessa strada può essere:

🟢 normale per chi cammina senza difficoltà

🔴 impraticabile per una persona in carrozzina

🟡 problematica per una persona ipovedente

🟠 faticosa e rischiosa per una persona anziana

AccessBZ personalizza quindi la rappresentazione della città in base alle esigenze dell'utente.

---

# 📱 Struttura dell'app

## 🗺️ MAP

- mappa;
- posizione;
- ostacoli;
- filtri;
- Safe/Accessible Places;
- percorso.

---

## 🧭 ROUTE

- destinazione;
- percorso consigliato;
- alternative;
- ostacoli lungo il percorso;
- anteprima;
- modalità navigazione.

---

## ➕ REPORT

- categoria;
- foto;
- posizione;
- durata stimata;
- descrizione opzionale.

---

## 👤 PROFILE

- profilo di mobilità;
- impostazioni vocali;
- preferenze;
- storico delle segnalazioni;
- privacy.

---

# 🧩 Possibili Accessible Places

La mappa potrebbe contenere anche luoghi con informazioni sull'accessibilità.

Esempio:

### 🏥 Ospedale

- ♿ ingresso accessibile
- 🛗 ascensore
- 🚻 bagno accessibile
- 🅿️ parcheggio disabili

Ma questa componente deve rimanere **secondaria rispetto alla parte dinamica**.

Non vogliamo trasformare AccessBZ in un semplice database di luoghi accessibili.

---

# 🚨 Esempio completo

## Scenario

Una persona in carrozzina deve raggiungere una farmacia.

---

### STEP 1

Inserisce:

> 📍 Farmacia
> 

---

### STEP 2

AccessBZ calcola il percorso.

Percorso più veloce:

> ⏱️ 8 min
> 
> 
> 🔴 2 ostacoli
> 

Percorso accessibile:

> ⏱️ 11 min
> 
> 
> 🟢 0 ostacoli conosciuti
> 

---

### STEP 3

L'utente sceglie il secondo percorso.

---

### STEP 4

Durante il tragitto arriva un avviso:

> 🔊 "Attenzione. Tra 15 metri è presente un ostacolo sul lato destro."
> 

---

### STEP 5

L'utente verifica che l'ostacolo sia ancora presente.

Premendo:

**CONFERMA**

aggiorna la segnalazione.

---

### STEP 6

Più avanti trova un altro problema che non era presente sulla mappa.

Scatta una foto.

> 🚗 Veicolo sul marciapiede
> 

---

### STEP 7

La community può successivamente confermare o chiudere la segnalazione.

---

# 📊 Dashboard personale

L'utente può vedere:

> **Le mie segnalazioni**
> 
> 
> 📍 23 segnalazioni
> 
> ✅ 19 risolte
> 
> 👥 47 confermate dalla community
> 
> ⏱️ 12 min durata media
> 
> ♿ 8 problemi di accessibilità
> 
> 🚧 6 lavori
> 
> 🚗 5 veicoli
> 

La dashboard serve soprattutto a mostrare l'impatto della community.

---

# 🏙️ Dashboard cittadina

Possibile funzionalità futura.

Esempio:

> **Accessibilità Bolzano**
> 
> 
> 🟢 94% dei percorsi senza ostacoli segnalati
> 
> ⚠️ 38 ostacoli attivi
> 
> 🚧 12 cantieri
> 
> 🛗 4 ascensori fuori servizio
> 
> 🚗 22 ostacoli temporanei
> 
> 📈 -18% ostacoli rispetto al mese scorso
> 

Questi dati possono essere molto interessanti anche per:

- amministrazioni;
- associazioni;
- organizzatori di eventi;
- cittadini.

---

# 🎮 Gamification — DA VALUTARE

La gamification può incentivare la partecipazione, ma deve essere utilizzata con attenzione.

Possibili elementi:

- 🏅 badge;
- 🌟 reputazione;
- 📸 qualità delle segnalazioni;
- ✅ segnalazioni confermate;
- 🛠️ problemi risolti grazie alla community.

Evitare una semplice classifica:

> "Chi ha fatto più segnalazioni?"
> 

Potrebbe incentivare segnalazioni inutili.

Meglio premiare **la qualità e l'utilità**.

---

# 🔐 Privacy

Le segnalazioni devono evitare di raccogliere dati personali inutili.

Possibili principi:

- posizione utilizzata solamente per localizzare il problema;
- possibilità di non pubblicare informazioni personali;
- foto senza volti quando possibile;
- niente storico pubblico degli spostamenti dell'utente;
- possibilità di eliminare le proprie segnalazioni.

---

# 🧠 AI — NON NECESSARIA

L'app non deve dipendere dall'intelligenza artificiale.

L'algoritmo principale può funzionare con:

- GPS;
- database;
- timestamp;
- categorie;
- conferme;
- durata;
- storico.

In futuro l'AI potrebbe essere utilizzata per:

- classificare automaticamente una foto;
- rilevare un ostacolo;
- suggerire la categoria;
- stimare la durata.

Ma **non deve essere il cuore del progetto**.

---

# 🚫 Cose da evitare

AccessBZ non deve diventare:

- ❌ un clone di Google Maps;
- ❌ una semplice guida turistica;
- ❌ un database statico di luoghi accessibili;
- ❌ una semplice app di segnalazioni;
- ❌ una copia di Eyes4Me;
- ❌ un progetto che dipende da migliaia di utenti;
- ❌ un'app basata principalmente sull'AI.

Il cuore deve rimanere:

> **informazioni dinamiche + accessibilità + community + tempo reale.**
> 

# 🏆 Perché può funzionare per il contest

## 1. Rispetto dell'obiettivo

È direttamente orientata a migliorare la vita quotidiana della comunità e rendere la città più accessibile.

## 2. Originalità

La differenza rispetto a una normale mappa è:

> **la rappresentazione temporale degli ostacoli.**
> 

Un ostacolo non è semplicemente presente o assente.

Ha:

- origine;
- durata;
- conferme;
- stato;
- eventuale risoluzione.

## 3. Fattibilità

L'MVP può essere costruito senza avere migliaia di utenti reali.

Durante la demo è possibile simulare:

- segnalazioni;
- utenti;
- conferme;
- ostacoli;
- percorsi.

## 4. Presentazione

La demo permette di mostrare un problema immediatamente comprensibile.

## 5. Immagini e creatività

Grande spazio per:

- mappe;
- marker;
- foto degli ostacoli;
- percorsi;
- dashboard;
- grafici;
- schermate vocali;
- stato degli ostacoli.

---

# 🎬 Demo del contest

## Scenario

> "Devo raggiungere una farmacia in carrozzina."
> 

---

### 1 — Profilo

Seleziono:

**♿ Carrozzina**

---

### 2 — Destinazione

Inserisco:

> 💊 Farmacia
> 

---

### 3 — Confronto percorsi

AccessBZ mostra:

> 🔴 Percorso A — 8 min — 2 ostacoli
> 
> 
> 🟢 Percorso B — 11 min — nessun ostacolo conosciuto
> 

Scelgo B.

---

### 4 — Durante il percorso

L'app segnala:

> 🔊 "Attenzione. Ostacolo tra 15 metri."
> 

---

### 5 — Segnalazione

Arrivo davanti a un'auto che blocca il marciapiede.

Scatto una foto.

> 🚗 Veicolo sul marciapiede
> 

---

### 6 — Community

Un secondo account conferma:

> ✅ Ostacolo ancora presente
> 

---

### 7 — Risoluzione

Dopo un certo periodo:

> 🟢 Ostacolo rimosso
> 

La segnalazione diventa:

**RISOLTA**

---

### 8 — Dashboard

Mostrare:

> "Questo ostacolo è rimasto attivo per 47 minuti."
> 

Questo chiude il cerchio della caratteristica temporale.

---

# 🧩 MVP

## MUST HAVE

- [ ]  
    
    Registrazione/login
    
- [ ]  
    
    Mappa
    
- [ ]  
    
    GPS
    
- [ ]  
    
    Profili di mobilità
    
- [ ]  
    
    Marker degli ostacoli
    
- [ ]  
    
    Creazione segnalazione
    
- [ ]  
    
    Foto
    
- [ ]  
    
    Timestamp
    
- [ ]  
    
    Durata stimata
    
- [ ]  
    
    Conferma segnalazione
    
- [ ]  
    
    Risoluzione segnalazione
    
- [ ]  
    
    Filtri
    
- [ ]  
    
    Percorso
    
- [ ]  
    
    Avvisi di prossimità
    
- [ ]  
    
    Sintesi vocale
    

---

## SHOULD HAVE

- [ ]  
    
    Percorsi personalizzati
    
- [ ]  
    
    Anteprima del percorso
    
- [ ]  
    
    Statistiche personali
    
- [ ]  
    
    Statistiche cittadine
    
- [ ]  
    
    Sistema reputazione
    
- [ ]  
    
    Accessible Places
    
- [ ]  
    
    Notifiche
    
- [ ]  
    
    Storico ostacoli
    

---

## NICE TO HAVE

- [ ]  
    
    Previsione durata ostacolo
    
- [ ]  
    
    Classificazione automatica delle foto
    
- [ ]  
    
    Integrazione trasporto pubblico
    
- [ ]  
    
    Dati aperti del comune
    
- [ ]  
    
    API pubblica
    
- [ ]  
    
    Dashboard per amministrazioni
    
- [ ]  
    
    Modalità eventi
    
- [ ]  
    
    Supporto multilingua
    

---

# ❓ Questioni ancora da decidere

## Segnalazioni

- Quali categorie includere nell'MVP?
- Quanto deve durare una segnalazione prima di scadere?
- Chi può chiuderla?
- Quante conferme servono?

## Percorsi

- Utilizzare un servizio di routing esistente?
- Come calcolare l'accessibilità?
- Quanto deve pesare un ostacolo?
- Preferire un percorso più lungo ma più accessibile?

## Community

- Tutti possono segnalare?
- Serve reputazione?
- Come prevenire segnalazioni false?
- Come gestire segnalazioni contraddittorie?

## Accessibilità

- Quali dati servono per ogni profilo?
- Come gestire la sintesi vocale?
- Come rendere l'intera UI accessibile?

---

# 🔬 Possibile evoluzione scientifica

La parte più interessante a lungo termine potrebbe essere trasformare AccessBZ in un sistema che **misura l'accessibilità reale della città**.

Non solamente:

> "Questa strada è accessibile."
> 

ma:

> "Quanto è accessibile questa strada durante la giornata?"
> 

Esempio:

**Via Roma**

08:00 → 🟢

12:00 → 🟡

18:00 → 🔴

20:00 → 🟢

Questo permetterebbe di creare una vera **mappa temporale dell'accessibilità urbana**.

---

# 🌍 Possibile espansione

Il progetto potrebbe iniziare da Bolzano e successivamente essere replicato in altre città.

La struttura sarebbe generalizzabile:

**AccessBZ**

↓

**AccessCity**

↓

**AccessEU**

Il database e il sistema di segnalazione possono funzionare indipendentemente dalla città.

---

# 💬 Elevator Pitch

> **AccessBZ è una mappa dinamica dell'accessibilità urbana.**
> 
> 
> Non mostra solamente dove sono le strade, ma cosa sta succedendo su quelle strade in questo momento.
> 
> Gli utenti possono segnalare ostacoli, confermarli, seguirne la durata e ricevere avvisi quando si avvicinano.
> 
> L'app adatta inoltre il percorso alle esigenze di ogni persona: una persona in carrozzina, una persona ipovedente, una persona anziana o un genitore con il passeggino possono avere percorsi completamente diversi.
> 
> **Perché la città è la stessa. Il percorso non lo è.**
> 

---

# 🏷️ Naming

### Nome provvisorio

**AccessBZ**

### Possibili alternative

- AccessCity
- OpenWay
- ClearWay
- UrbanAccess
- AccessNow
- CityAble
- WayForAll
- OpenPath

**Nota:** verificare disponibilità del nome, dominio e possibili progetti/app esistenti prima della scelta definitiva.

---

# 🚀 Roadmap

## Fase 1 — Concept

- [ ]  
    
    Definire nome
    
- [ ]  
    
    Definire profili
    
- [ ]  
    
    Definire categorie ostacoli
    
- [ ]  
    
    Definire sistema temporale
    
- [ ]  
    
    Definire modello dati
    

## Fase 2 — Prototype

- [ ]  
    
    Design UI
    
- [ ]  
    
    Mappa
    
- [ ]  
    
    Marker
    
- [ ]  
    
    Profilo mobilità
    
- [ ]  
    
    Creazione segnalazione
    
- [ ]  
    
    Scheda ostacolo
    
- [ ]  
    
    Percorso
    

## Fase 3 — MVP

- [ ]  
    
    Backend
    
- [ ]  
    
    Database
    
- [ ]  
    
    GPS
    
- [ ]  
    
    Routing
    
- [ ]  
    
    Segnalazioni
    
- [ ]  
    
    Conferme
    
- [ ]  
    
    Stati temporali
    
- [ ]  
    
    Notifiche
    
- [ ]  
    
    Text-to-Speech
    

## Fase 4 — Demo

- [ ]  
    
    Preparare città demo
    
- [ ]  
    
    Creare ostacoli simulati
    
- [ ]  
    
    Creare percorsi
    
- [ ]  
    
    Preparare fotografie
    
- [ ]  
    
    Preparare statistiche
    
- [ ]  
    
    Preparare scenario
    
- [ ]  
    
    Preparare presentazione
    

## Fase 5 — Contest

### Obiettivo

Dimostrare:

**profilo → percorso → ostacolo → avviso → segnalazione → conferma → risoluzione**

---

# ⭐ Core del progetto

Se tutte le funzionalità dovessero essere ridotte a una sola idea:

> **"Non vogliamo sapere soltanto se una strada è accessibile. Vogliamo sapere se lo è adesso, per te."**
> 

La vera innovazione di AccessBZ non è la mappa.

È la **dimensione temporale dell'accessibilità urbana**.