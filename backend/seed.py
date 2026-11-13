"""Crea dati DIMOSTRATIVI (simulati) nel centro di Bolzano per la demo del contest.

Uso:
    python seed.py          aggiunge i dati demo se il database è vuoto
    python seed.py --reset  cancella tutto e ricrea i dati demo

Le coordinate sono approssimative: prima del video sposta gli ostacoli
nei punti esatti in cui farai le riprese.
"""
import sys
from datetime import timedelta

from app.database import Base, SessionLocal, engine
from app.lifecycle import utcnow
from app.models import Report, User, Vote

USERS = ["Anna", "Marco", "Giulia", "Luca", "Sara"]

# (categoria, lat, lon, descrizione, durata stimata, creato N minuti fa,
#  conferme [minuti fa], rimozioni [minuti fa] -> se risolto)
ACTIVE = [
    ("vehicle", 46.49965, 11.35590, "Auto parcheggiata sul marciapiede, passaggio stretto", "minutes", 12, [5], []),
    ("works", 46.49830, 11.35460, "Scavo per tubature davanti all'ingresso della piazza", "days", 60 * 26, [60 * 20, 60 * 5, 90], []),
    ("construction", 46.49720, 11.35540, "Cantiere con impalcatura, marciapiede chiuso", "weeks", 60 * 24 * 9, [60 * 24 * 6, 60 * 24 * 2, 300, 40], []),
    ("elevator", 46.49650, 11.35770, "Ascensore del sottopasso fuori servizio", "unknown", 60 * 30, [60 * 10], []),
    ("tables", 46.50015, 11.35190, "Tavolini del bar occupano metà del passaggio", "hours", 95, [], []),
    ("bikes", 46.49960, 11.34950, "Monopattini abbandonati davanti alla rampa", "hours", 35, [20], []),
    ("obstacle", 46.49975, 11.34690, "Ramo caduto sul percorso pedonale del ponte", "hours", 50, [30, 15], []),
    ("closed", 46.50050, 11.34330, "Passaggio chiuso per evento in piazza", "days", 60 * 5, [], []),
]

# Ostacoli già risolti: servono per la "memoria temporale" e le statistiche
RESOLVED = [
    ("vehicle", 46.49930, 11.35270, "Furgone sulle strisce pedonali", "minutes", 60 * 26, 47),
    ("vehicle", 46.49980, 11.35360, "Auto davanti alla rampa", "minutes", 60 * 50, 35),
    ("works", 46.49900, 11.35150, "Manutenzione tombino", "hours", 60 * 72, 60 * 5),
    ("snow", 46.50000, 11.34000, "Ghiaccio sul marciapiede", "hours", 60 * 24 * 6, 60 * 9),
    ("bikes", 46.49880, 11.35620, "Bici legate al corrimano della rampa", "hours", 60 * 30, 140),
    ("elevator", 46.49655, 11.35760, "Ascensore bloccato", "unknown", 60 * 24 * 12, 60 * 26),
]


# Storico degli ultimi 30 giorni negli stessi punti degli ostacoli attivi:
# alimenta la "memoria del luogo" (quante volte, quanto durano, a che ora).
# (categoria, lat, lon, [(giorni fa, ora UTC, durata in minuti), ...])
HISTORY = [
    ("vehicle", 46.49965, 11.35590, [(2, 7, 35), (4, 8, 50), (6, 7, 25), (9, 16, 40), (11, 7, 55), (15, 8, 30), (21, 17, 45)]),
    ("tables", 46.50015, 11.35190, [(1, 10, 240), (3, 11, 300), (8, 10, 280), (13, 17, 200)]),
    ("works", 46.49830, 11.35460, [(18, 6, 60 * 9), (24, 6, 60 * 8)]),
    ("elevator", 46.49650, 11.35770, [(10, 9, 60 * 20), (27, 14, 60 * 31)]),
]


def seed(reset: bool = False):
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(Report).count() and not reset:
            print("Il database contiene già segnalazioni: uso --reset per ricrearle.")
            return

        now = utcnow()
        users = []
        for i, name in enumerate(USERS):
            u = db.query(User).filter_by(device_id=f"demo-user-{i}").first()
            if not u:
                u = User(device_id=f"demo-user-{i}", nickname=name, profile="wheelchair" if i % 2 else "pedestrian")
                db.add(u)
            users.append(u)
        db.flush()

        for n, (cat, lat, lon, desc, dur, ago, confirms, _) in enumerate(ACTIVE):
            author = users[n % len(users)]
            created = now - timedelta(minutes=ago)
            r = Report(category=cat, lat=lat, lon=lon, description=desc, duration_class=dur,
                       created_at=created, last_confirmed_at=created, created_by=author.id, is_demo=True)
            others = [u for u in users if u.id != author.id]
            for k, c_ago in enumerate(confirms):
                t = now - timedelta(minutes=c_ago)
                r.votes.append(Vote(user_id=others[k % len(others)].id, present=True, created_at=t))
                r.last_confirmed_at = max(r.last_confirmed_at, t)
            db.add(r)

        for n, (cat, lat, lon, desc, dur, ago, lasted) in enumerate(RESOLVED):
            author = users[(n + 2) % len(users)]
            created = now - timedelta(minutes=ago)
            solver = users[(n + 3) % len(users)]
            r = Report(category=cat, lat=lat, lon=lon, description=desc, duration_class=dur,
                       created_at=created, last_confirmed_at=created, created_by=author.id,
                       resolved_at=created + timedelta(minutes=lasted), is_demo=True)
            r.votes.append(Vote(user_id=solver.id, present=False, created_at=r.resolved_at))
            db.add(r)

        n_history = 0
        for k, (cat, lat, lon, events) in enumerate(HISTORY):
            for j, (days, hour, lasted) in enumerate(events):
                created = (now - timedelta(days=days)).replace(hour=hour, minute=(j * 13) % 60, second=0, microsecond=0)
                # piccolo spostamento (pochi metri): stesso posto, segnalato da persone diverse
                jitter = ((j % 3) - 1) * 0.00004
                r = Report(category=cat, lat=lat + jitter, lon=lon - jitter, description="",
                           duration_class="unknown", created_at=created, last_confirmed_at=created,
                           created_by=users[(k + j) % len(users)].id,
                           resolved_at=created + timedelta(minutes=lasted), is_demo=True)
                r.votes.append(Vote(user_id=users[(k + j + 1) % len(users)].id, present=False, created_at=r.resolved_at))
                db.add(r)
                n_history += 1

        db.commit()
        print(f"Creati {len(ACTIVE)} ostacoli attivi, {len(RESOLVED)} risolti e {n_history} di storico (dati demo).")
    finally:
        db.close()


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
