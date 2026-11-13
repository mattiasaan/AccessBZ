# Dati

`bolzano_osm.json` contiene posizione e tipo (attraversamento, bar, rastrelliera, ascensore, cantiere,
percorso pedonale...) di circa 3500 luoghi di Bolzano, usati da `populate.py` per collocare le
segnalazioni di esempio in punti realistici. Non contiene nomi di attività.

Dati © OpenStreetMap contributors, disponibili con licenza
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).

Per aggiornarli: `python populate.py --refresh-osm`.
