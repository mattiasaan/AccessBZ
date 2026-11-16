"""Popola la mappa con segnalazioni realistiche nel centro di Bolzano.

Le posizioni NON sono casuali: vengono da luoghi reali di OpenStreetMap
(attraversamenti, bar, rastrelliere, ascensori, cantieri, percorsi pedonali...).
Ogni categoria ha i suoi orari tipici, la sua durata e i suoi "punti caldi" che
si ripetono nel tempo, così la memoria del luogo e le statistiche hanno senso.

Uso:
    python populate.py                  aggiunge dati (se il database è vuoto)
    python populate.py --reset          cancella tutto e rigenera
    python populate.py --if-empty       genera solo se non ci sono segnalazioni (usato su Render)
    python populate.py --refresh-if-stale 12
                                        rigenera SOLO i dati generati se hanno più di 12 ore
                                        (le segnalazioni degli utenti veri restano)
    python populate.py --scale 4        più segnalazioni (default 3)
    python populate.py --days 45        giorni di storico (default 45)
    python populate.py --winter         aggiunge neve e ghiaccio in alcuni giorni
    python populate.py --seed 7         risultato riproducibile
    python populate.py --refresh-osm    riscarica i luoghi da OpenStreetMap

I dati generati sono marcati come is_demo=True nel database.
Gli utenti generati hanno un ID con ":" che l'API rifiuta: non sono utilizzabili dall'esterno.
"""
import argparse
import json
import math
import random
import sys
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import func

from app.database import Base, SessionLocal, create_tables, engine
from app.lifecycle import EXPIRY_WITHOUT_CONFIRMATION, REMOVALS_FOR_RESOLVED, utcnow
from app.models import Report, User, Vote

CACHE = Path(__file__).parent / "data" / "bolzano_osm.json"
CENTER = (46.4983, 11.3548)          # Piazza Walther
BBOX = (46.476, 11.305, 46.515, 11.378)  # sud, ovest, nord, est (città di Bolzano)

# Server Overpass pubblici: se il primo è sovraccarico si prova il successivo
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
OVERPASS_QUERY = """
[out:json][timeout:90];
(
  node["highway"="crossing"]({bbox});
  node["amenity"~"^(cafe|bar|restaurant|pub|ice_cream|fast_food|biergarten)$"]({bbox});
  node["amenity"="bicycle_parking"]({bbox});
  node["highway"="elevator"]({bbox});
  node["shop"~"^(supermarket|convenience|bakery|greengrocer|butcher)$"]({bbox});
  node["amenity"~"^(pharmacy|school|kindergarten|hospital|clinic|doctors)$"]({bbox});
  way["amenity"~"^(school|kindergarten|hospital)$"]({bbox});
  way["highway"~"^(footway|pedestrian|living_street)$"]({bbox});
  way["highway"="steps"]({bbox});
  way["bridge"="yes"]["highway"]({bbox});
  way["landuse"="construction"]({bbox});
  way["building"="construction"]({bbox});
  way["highway"="construction"]({bbox});
);
out center tags;
"""


# ------------------------------------------------------------------ luoghi da OpenStreetMap

def classify(tags: dict) -> str | None:
    a, hw, shop = tags.get("amenity", ""), tags.get("highway", ""), tags.get("shop", "")
    if hw == "elevator":
        return "elevator"
    if tags.get("landuse") == "construction" or tags.get("building") == "construction" or hw == "construction":
        return "construction"
    if hw == "crossing":
        return "crossing"
    if a in ("cafe", "bar", "restaurant", "pub", "ice_cream", "fast_food", "biergarten"):
        return "food"
    if a == "bicycle_parking":
        return "bike_parking"
    if a in ("pharmacy", "school", "kindergarten", "hospital", "clinic", "doctors"):
        return "service"
    if shop:
        return "shop"
    if tags.get("bridge") == "yes":
        return "bridge"
    if hw == "steps":
        return "steps"
    if hw in ("footway", "pedestrian", "living_street"):
        return "footway"
    return None


def fetch_osm() -> list[dict]:
    import httpx

    s, w, n, e = BBOX
    query = OVERPASS_QUERY.replace("{bbox}", f"{s},{w},{n},{e}")
    print("Scarico i luoghi da OpenStreetMap (Overpass)...")
    data, last_error = None, None
    for attempt in range(2):
        for url in OVERPASS_URLS:
            try:
                r = httpx.post(url, data={"data": query}, headers={"User-Agent": "AccessBZ-populate/1.0"}, timeout=120)
                r.raise_for_status()
                data = r.json()
                break
            except Exception as e:  # server occupato o non raggiungibile: si prova il prossimo
                last_error = e
                print(f"  {url}: {type(e).__name__}, provo il prossimo...")
        if data is not None:
            break
        time.sleep(5)
    if data is None:
        raise SystemExit(f"OpenStreetMap non raggiungibile ({last_error}). Riprova più tardi.")

    places, seen = [], set()
    for el in data.get("elements", []):
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        group = classify(el.get("tags", {}))
        if lat is None or group is None:
            continue
        key = (round(lat, 5), round(lon, 5), group)
        if key in seen:
            continue
        seen.add(key)
        # Solo posizione e tipo di luogo: nessun nome di attività (i dati sono simulati)
        places.append({"lat": round(lat, 6), "lon": round(lon, 6), "g": group})
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps(places, separators=(",", ":")), encoding="utf-8")
    print(f"Salvati {len(places)} luoghi in {CACHE.name}")
    return places


def load_places(refresh: bool) -> list[dict]:
    if refresh or not CACHE.exists():
        return fetch_osm()
    return json.loads(CACHE.read_text(encoding="utf-8"))


# ------------------------------------------------------------------ comportamento delle categorie

# Distribuzioni orarie (ora locale): peso per ogni ora 0-23
def hours(*peaks, base=0.05, night=0.0):
    w = [base if 6 <= h <= 22 else night for h in range(24)]
    for center, width, height in peaks:
        for h in range(24):
            w[h] += height * math.exp(-((h - center) / width) ** 2)
    return w


CATEGORIES = {
    # rate = segnalazioni al giorno (scala 1), median_h = durata mediana in ore
    "vehicle": dict(groups={"crossing": 5, "service": 4, "shop": 3}, rate=8, median_h=0.6, sigma=0.55,
                    duration="minutes", hours=hours((7.8, 0.8, 1.0), (12.7, 0.8, 0.8), (17.8, 1.2, 0.7)),
                    weekend=0.5, hotspots=22),
    "tables": dict(groups={"food": 1}, rate=4, median_h=4.5, sigma=0.35, duration="hours",
                   hours=hours((11.5, 1.0, 0.8), (18.5, 1.2, 1.0), base=0.0), weekend=1.4, hotspots=10),
    "bikes": dict(groups={"bike_parking": 3, "crossing": 1}, rate=2.2, median_h=3, sigma=0.6, duration="hours",
                  hours=hours((8.5, 1.5, 0.6), (16, 2, 0.6)), weekend=1.1, hotspots=8),
    "obstacle": dict(groups={"footway": 3, "bridge": 1}, rate=1.2, median_h=6, sigma=0.7, duration="hours",
                     hours=hours((9, 3, 0.5), (15, 3, 0.5)), weekend=1.0, hotspots=6),
    "works": dict(groups={"crossing": 2, "footway": 2}, rate=1.3, median_h=60, sigma=0.5, duration="days",
                  hours=hours((7.5, 0.7, 1.2), base=0.02), weekend=0.15, hotspots=6),
    "construction": dict(groups={"construction": 1}, rate=0.25, median_h=24 * 18, sigma=0.45, duration="weeks",
                         hours=hours((7.5, 0.8, 1.0), base=0.02), weekend=0.1, hotspots=5),
    "closed": dict(groups={"construction": 2, "footway": 2}, rate=0.5, median_h=30, sigma=0.6, duration="days",
                   hours=hours((8, 1.5, 0.8), base=0.03), weekend=0.6, hotspots=5),
    "elevator": dict(groups={"elevator": 1}, rate=0.2, median_h=36, sigma=0.7, duration="unknown",
                     hours=hours((8, 2, 0.6), (17, 2, 0.6)), weekend=1.0, hotspots=4),
    "other": dict(groups={"footway": 2, "steps": 1}, rate=0.5, median_h=8, sigma=0.8, duration="unknown",
                  hours=hours((10, 3, 0.5), (16, 3, 0.5)), weekend=1.0, hotspots=5),
    "snow": dict(groups={"bridge": 2, "footway": 2, "steps": 1}, rate=0, median_h=14, sigma=0.5, duration="hours",
                 hours=hours((7, 1.5, 1.0), base=0.02), weekend=1.0, hotspots=8),
}

DESCRIPTIONS = {
    "vehicle": ["Auto parcheggiata sul marciapiede, si passa a fatica", "Furgone per le consegne davanti alla rampa",
                "Macchina ferma sulle strisce pedonali", "Auto in doppia fila che copre lo scivolo", "", ""],
    "tables": ["Tavolini e sedie occupano metà del marciapiede", "Il dehors lascia un passaggio troppo stretto",
               "Ombrelloni e tavoli fino al bordo del marciapiede", ""],
    "bikes": ["Bici legate al corrimano della rampa", "Monopattini a noleggio lasciati in mezzo al passaggio",
              "Biciclette parcheggiate davanti allo scivolo", ""],
    "obstacle": ["Ramo caduto sul percorso pedonale", "Cassonetto spostato sul marciapiede",
                 "Transenna abbandonata in mezzo al passaggio", "Cartello pubblicitario sul percorso tattile", ""],
    "works": ["Scavo per le tubature, marciapiede ristretto", "Lavori sull'illuminazione, passaggio deviato",
              "Rifacimento dell'asfalto: attraversamento chiuso", "Manutenzione di un tombino, transenne", ""],
    "construction": ["Impalcatura su tutto il marciapiede", "Cantiere edile: percorso pedonale deviato sull'altro lato",
                     "Ponteggio con passaggio coperto ma molto stretto", ""],
    "closed": ["Passaggio chiuso per un evento", "Percorso pedonale chiuso, nessuna indicazione alternativa",
               "Sottopasso chiuso per manutenzione", ""],
    "elevator": ["Ascensore fuori servizio", "Ascensore bloccato, nessun avviso sulla durata",
                 "Ascensore guasto: restano solo le scale", ""],
    "other": ["Scivolo danneggiato", "Pavimentazione sconnessa e buche", "Gradino nuovo senza rampa", ""],
    "snow": ["Ghiaccio sul marciapiede non ancora spalato", "Neve accumulata davanti allo scivolo",
             "Rampa scivolosa per il ghiaccio", ""],
}

NICKNAMES = [
    "Anna", "Marco", "Giulia", "Luca", "Sara", "Matteo", "Elena", "Davide", "Chiara", "Paolo",
    "Martina", "Andrea", "Francesca", "Simone", "Laura", "Stefano", "Valentina", "Alessio", "Federica", "Nicola",
    "Lukas", "Anna-Lena", "Maximilian", "Sophia", "Jonas", "Lea", "Tobias", "Hannah", "Florian", "Julia",
    "Giorgio", "Rita", "Franz", "Ingrid", "Bruno", "Teresa", "Hans", "Lucia", "Peter", "Irene",
]
PROFILE_WEIGHTS = {"elderly": 4, "wheelchair": 3, "stroller": 3, "blind": 2}


# ------------------------------------------------------------------ utilità

def utc_offset_hours(dt_utc: datetime) -> int:
    """Ora legale europea: +2 dall'ultima domenica di marzo all'ultima di ottobre (alle 01:00 UTC), altrimenti +1."""
    y = dt_utc.year

    def last_sunday(month):
        d = datetime(y, month + 1, 1) - timedelta(days=1) if month < 12 else datetime(y, 12, 31)
        return d - timedelta(days=(d.weekday() + 1) % 7)

    start = last_sunday(3).replace(hour=1)
    end = last_sunday(10).replace(hour=1)
    return 2 if start <= dt_utc < end else 1


def local_to_utc(local: datetime) -> datetime:
    return local - timedelta(hours=utc_offset_hours(local - timedelta(hours=1)))


def jitter(lat, lon, rng, min_m=2.0, max_m=7.0):
    """Sposta il punto di pochi metri: la segnalazione sta sul marciapiede, non sul punto OSM esatto."""
    d = rng.uniform(min_m, max_m)
    a = rng.uniform(0, 2 * math.pi)
    return (
        round(lat + d * math.cos(a) / 110_540, 6),
        round(lon + d * math.sin(a) / (111_320 * math.cos(math.radians(lat))), 6),
    )


def centrality(lat, lon) -> float:
    """Più segnalazioni in centro (dove c'è più gente), ma non solo."""
    dy = (lat - CENTER[0]) * 110_540
    dx = (lon - CENTER[1]) * 111_320 * math.cos(math.radians(lat))
    return math.exp(-((math.hypot(dx, dy) / 1300) ** 2)) + 0.12


def weighted_choice(rng, items, weights):
    return rng.choices(items, weights=weights, k=1)[0]


def poisson(rng, lam):
    if lam <= 0:
        return 0
    l, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= l:
            return k
        k += 1


# ------------------------------------------------------------------ generazione

def build_hotspots(places, rng):
    by_group = {}
    for p in places:
        by_group.setdefault(p["g"], []).append(p)
    spots = {}
    for cat, cfg in CATEGORIES.items():
        pool, weights = [], []
        for group, gw in cfg["groups"].items():
            for p in by_group.get(group, []):
                pool.append(p)
                weights.append(gw * centrality(p["lat"], p["lon"]))
        if not pool:
            spots[cat] = ([], [], [])
            continue
        k = min(cfg["hotspots"], len(pool))
        chosen = []
        for _ in range(k * 3):
            p = weighted_choice(rng, pool, weights)
            if p not in chosen:
                chosen.append(p)
            if len(chosen) == k:
                break
        # Distribuzione "a coda lunga": alcuni punti ricorrenti, molti punti occasionali
        spots[cat] = (chosen, [1 / (i + 1) ** 0.6 for i in range(len(chosen))], (pool, weights))
    return spots


def pick_location(cat, spots, rng):
    chosen, zipf, (pool, weights) = spots[cat]
    if chosen and rng.random() < 0.55:
        p = weighted_choice(rng, chosen, zipf)
    else:
        p = weighted_choice(rng, pool, weights)
    return jitter(p["lat"], p["lon"], rng)


def generate(db, places, *, days, scale, winter, rng):
    now = utcnow()
    spots = build_hotspots(places, rng)
    missing = [c for c, s in spots.items() if not s[0] and CATEGORIES[c]["rate"]]
    if missing:
        print(f"Attenzione: nessun luogo OSM per {', '.join(missing)}")

    users = []
    for name in NICKNAMES:
        u = User(device_id=f"seed:{uuid.uuid4().hex}", nickname=name,
                 profile=weighted_choice(rng, list(PROFILE_WEIGHTS), list(PROFILE_WEIGHTS.values())))
        db.add(u)
        users.append(u)
    db.flush()

    snow_days = set()
    if winter:
        snow_days = {d for d in range(days) if rng.random() < 0.15} | {0, 1}

    # Ostacoli attivi per punto e categoria: niente doppioni nello stesso posto
    busy: dict[tuple, datetime] = {}
    counts = {"active": 0, "resolved": 0, "expired": 0}

    today_local = (now + timedelta(hours=utc_offset_hours(now))).replace(hour=0, minute=0, second=0, microsecond=0)
    for day in range(days, -1, -1):
        date_local = today_local - timedelta(days=day)
        weekend = date_local.weekday() >= 5
        for cat, cfg in CATEGORIES.items():
            if not spots[cat][0] and not spots[cat][2][0]:
                continue
            rate = cfg["rate"]
            if cat == "snow":
                rate = 6 if day in snow_days else 0
            rate *= scale * (cfg["weekend"] if weekend else 1.0)
            for _ in range(poisson(rng, rate)):
                hour = weighted_choice(rng, list(range(24)), cfg["hours"])
                start = local_to_utc(date_local + timedelta(hours=hour, minutes=rng.randint(0, 59)))
                if start >= now:
                    continue
                lat, lon = pick_location(cat, spots, rng)
                key = (cat, round(lat, 4), round(lon, 4))
                if busy.get(key) and busy[key] > start:
                    continue  # lo stesso ostacolo è già segnalato lì: si conferma, non si duplica
                dur = timedelta(hours=cfg["median_h"] * math.exp(rng.gauss(0, cfg["sigma"])))
                end = start + dur
                busy[key] = end
                outcome = add_report(db, users, cat, cfg, lat, lon, start, end, now, rng)
                counts[outcome] += 1

    db.commit()
    return counts


def add_report(db, users, cat, cfg, lat, lon, start, end, now, rng):
    author = rng.choice(users)
    others = [u for u in users if u.id != author.id]
    r = Report(
        category=cat, lat=lat, lon=lon, description=rng.choice(DESCRIPTIONS[cat]),
        duration_class=cfg["duration"], created_at=start, last_confirmed_at=start,
        created_by=author.id, is_demo=True,
    )
    expiry = EXPIRY_WITHOUT_CONFIRMATION[cfg["duration"]]
    alive_until = min(end, now)
    life_h = (alive_until - start).total_seconds() / 3600

    # Conferme durante la vita dell'ostacolo (più passanti per gli ostacoli lunghi e centrali)
    n_conf = min(len(others), poisson(rng, min(6, 0.6 + life_h * 0.25)))
    # Alcuni ostacoli segnalati da poco non hanno ancora conferme ("appena segnalato")
    just_reported = end > now and now - start < expiry * 0.5 and rng.random() < 0.5
    if just_reported:
        n_conf = 0
    voters = rng.sample(others, n_conf)
    times = sorted(start + (alive_until - start) * rng.random() for _ in voters)

    # Un ostacolo ancora presente deve essere stato confermato abbastanza di recente, altrimenti scadrebbe
    if end > now and not just_reported and (not times or now - times[-1] > expiry * 0.6):
        extra = next((u for u in others if u not in voters), None)
        if extra:
            voters.append(extra)
            times.append(now - expiry * rng.uniform(0.05, 0.5) if now - start > expiry * 0.5 else start + (now - start) * rng.random())
            times.sort()

    for u, t in zip(voters, times):
        r.votes.append(Vote(user_id=u.id, present=True, created_at=t))
    if times:
        r.last_confirmed_at = max(times)

    if end <= now:
        # Chiuso: di solito qualcuno lo segnala come rimosso, a volte invece scade da solo
        if now - r.last_confirmed_at > expiry and rng.random() < 0.15:
            outcome = "expired"
        else:
            if rng.random() < 0.55:
                r.votes.append(Vote(user_id=author.id, present=False, created_at=end))
            else:
                closers = [u for u in others if u not in voters] or others
                for u in rng.sample(closers, min(REMOVALS_FOR_RESOLVED, len(closers))):
                    r.votes.append(Vote(user_id=u.id, present=False, created_at=end))
            r.resolved_at = end
            outcome = "resolved"
    else:
        outcome = "active"

    db.add(r)
    return outcome


def delete_generated(db) -> int:
    """Cancella solo i dati generati: segnalazioni is_demo (con i loro voti) e utenti "seed:".
    Le segnalazioni degli utenti veri non vengono toccate."""
    ids = [rid for (rid,) in db.query(Report.id).filter(Report.is_demo.is_(True)).all()]
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        db.query(Vote).filter(Vote.report_id.in_(chunk)).delete(synchronize_session=False)
        db.query(Report).filter(Report.id.in_(chunk)).delete(synchronize_session=False)
    seed_users = db.query(User.id).filter(User.device_id.like("seed:%"))
    db.query(Vote).filter(Vote.user_id.in_(seed_users.scalar_subquery())).delete(synchronize_session=False)
    db.query(User).filter(User.device_id.like("seed:%")).delete(synchronize_session=False)
    db.commit()
    return len(ids)


def main(argv=None):
    p = argparse.ArgumentParser(description="Popola AccessBZ con segnalazioni realistiche a Bolzano")
    p.add_argument("--reset", action="store_true", help="cancella tutti i dati prima di generare")
    p.add_argument("--if-empty", action="store_true", help="genera solo se il database non ha segnalazioni")
    p.add_argument("--refresh-if-stale", type=float, metavar="ORE", default=None,
                   help="rigenera SOLO i dati generati se sono più vecchi di ORE (le segnalazioni vere restano)")
    p.add_argument("--days", type=int, default=45)
    p.add_argument("--scale", type=float, default=3.0)
    p.add_argument("--winter", action="store_true")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--refresh-osm", action="store_true")
    args = p.parse_args(argv)

    if not (1 <= args.days <= 120) or not (0.1 <= args.scale <= 10):
        p.error("--days tra 1 e 120, --scale tra 0.1 e 10")

    if args.reset:
        Base.metadata.drop_all(bind=engine)
    create_tables()

    db = SessionLocal()
    try:
        if args.if_empty and db.query(Report).count():
            print("Il database contiene già segnalazioni: nessuna modifica.")
            return
        if args.refresh_if_stale is not None:
            latest = db.query(func.max(Report.created_at)).filter(Report.is_demo.is_(True)).scalar()
            if latest and utcnow() - latest < timedelta(hours=args.refresh_if_stale):
                print("I dati generati sono recenti: nessuna modifica.")
                return
            removed = delete_generated(db)
            print(f"Dati generati non aggiornati: rimosse {removed} segnalazioni generate, rigenero.")
        places = load_places(args.refresh_osm)
        rng = random.Random(args.seed)
        counts = generate(db, places, days=args.days, scale=args.scale, winter=args.winter, rng=rng)
        print(
            f"Generate {sum(counts.values())} segnalazioni su {len(places)} luoghi reali di OSM: "
            f"{counts['active']} attive, {counts['resolved']} risolte, {counts['expired']} scadute."
        )
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
