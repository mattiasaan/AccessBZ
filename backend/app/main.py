"""API REST di AccessBZ."""
import base64
import binascii
import logging
from collections import Counter
from datetime import timedelta

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from . import routing
from .categories import CATEGORIES, PROFILES, is_relevant
from .database import Base, engine, get_db
from .lifecycle import (
    ACTIVE_STATUSES,
    EXPECTED_DURATION,
    EXPIRY_WITHOUT_CONFIRMATION,
    active_duration,
    apply_vote,
    compute_status,
    count_confirmations,
    utcnow,
)
from .models import Report, User, Vote
from .security import (
    IS_PRODUCTION,
    MAX_PHOTO_BASE64_CHARS,
    BodySizeLimitMiddleware,
    ImageError,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    check_device_quota,
    clean_text,
    device_id_optional,
    device_id_required,
    sanitize_image,
    spend_ors_budget,
)

log = logging.getLogger("accessbz")

Base.metadata.create_all(bind=engine)

# In produzione la documentazione interattiva non è pubblica
app = FastAPI(
    title="AccessBZ API",
    version="1.1",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None,
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

# L'app mobile non ha bisogno di CORS: lo permettiamo solo a localhost in sviluppo (prove nel browser)
if not IS_PRODUCTION:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "X-Device-Id"],
    )
# L'ultimo aggiunto è il più esterno. Ordine di una richiesta:
# header di sicurezza -> limite di dimensione -> rate limit -> (CORS) -> endpoint
# così anche le risposte 413 e 429 ricevono gli header di sicurezza.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# Area di servizio (Bolzano e dintorni): segnalazioni e percorsi fuori da qui vengono rifiutati
SERVICE_AREA = {"min_lat": 46.38, "max_lat": 46.60, "min_lon": 11.18, "max_lon": 11.50}
MAX_ACTIVE_WINDOW = max(EXPIRY_WITHOUT_CONFIRMATION.values())
REPORTS_PER_DEVICE_PER_DAY = 30
MAX_AVOID_POLYGONS = 40
MAX_ACTIVE_RESULTS = 1500


def in_service_area(lat: float, lon: float) -> bool:
    a = SERVICE_AREA
    return a["min_lat"] <= lat <= a["max_lat"] and a["min_lon"] <= lon <= a["max_lon"]


def require_area(lat: float, lon: float):
    if not in_service_area(lat, lon):
        raise HTTPException(422, "Posizione fuori dall'area servita (Bolzano)")


# ---------------------------------------------------------------- schemi

class UserIn(BaseModel):
    nickname: str = Field(min_length=1, max_length=40)
    profile: str = "pedestrian"

    @field_validator("nickname")
    @classmethod
    def _nick(cls, v):
        v = clean_text(v)
        if not v:
            raise ValueError("Nome non valido")
        return v


class ReportIn(BaseModel):
    category: str = Field(max_length=20)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    description: str = Field(default="", max_length=300)
    duration_class: str = Field(default="unknown", max_length=10)
    photo_base64: str | None = Field(default=None, max_length=MAX_PHOTO_BASE64_CHARS)

    @field_validator("description")
    @classmethod
    def _desc(cls, v):
        return clean_text(v, allow_newlines=True)


class VoteIn(BaseModel):
    present: bool


class RouteIn(BaseModel):
    start: tuple[float, float]  # (lat, lon)
    end: tuple[float, float]
    profile: str = Field(default="pedestrian", max_length=20)


# ---------------------------------------------------------------- utilità

def iso(dt):
    return dt.isoformat(timespec="seconds") + "Z" if dt else None


def find_user(db: Session, device_id: str | None) -> User | None:
    if not device_id:
        return None
    return db.scalar(select(User).where(User.device_id == device_id))


def get_user(db: Session, device_id: str) -> User:
    user = find_user(db, device_id)
    if not user:
        raise HTTPException(401, "Utente non registrato")
    return user


def report_to_dict(r: Report, now=None, viewer_id: int | None = None) -> dict:
    now = now or utcnow()
    my_vote = None
    if viewer_id is not None:
        mine = [v for v in r.votes if v.user_id == viewer_id]
        my_vote = mine[-1].present if mine else None
    expected = EXPECTED_DURATION.get(r.duration_class)
    return {
        "id": r.id,
        "category": r.category,
        "category_label": CATEGORIES.get(r.category, r.category),
        "lat": r.lat,
        "lon": r.lon,
        "description": r.description,
        "duration_class": r.duration_class,
        "expected_duration_min": int(expected.total_seconds() // 60) if expected else None,
        "status": compute_status(r, now),
        "created_at": iso(r.created_at),
        "last_confirmed_at": iso(r.last_confirmed_at),
        "resolved_at": iso(r.resolved_at),
        "active_minutes": int(active_duration(r, now).total_seconds() // 60),
        "confirmations": count_confirmations(r),
        "removals": sum(1 for v in r.votes if not v.present),
        "has_photo": r.has_photo,
        "author": r.author.nickname if r.author else None,
        "is_mine": viewer_id is not None and r.created_by == viewer_id,
        "my_vote": my_vote,
        "is_demo": r.is_demo,
    }


def _with_relations(stmt):
    return stmt.options(selectinload(Report.votes), selectinload(Report.author))


def load_active_candidates(db: Session, now=None):
    """Solo le segnalazioni che POSSONO essere attive (non risolte e confermate di recente):
    il filtro avviene nel database, non si carica tutta la tabella."""
    now = now or utcnow()
    stmt = (
        select(Report)
        .where(
            Report.resolved_at.is_(None),
            Report.last_confirmed_at >= now - MAX_ACTIVE_WINDOW,
        )
        .order_by(Report.last_confirmed_at.desc())
        .limit(MAX_ACTIVE_RESULTS)  # tetto: la risposta non può crescere senza limite
    )
    return db.scalars(_with_relations(stmt)).all()


def load_recent(db: Session, days: int, now=None, limit: int = 2000):
    now = now or utcnow()
    stmt = (
        select(Report)
        .where(Report.created_at >= now - timedelta(days=days))
        .order_by(Report.created_at.desc())
        .limit(limit)
    )
    return db.scalars(_with_relations(stmt)).all()


PLACE_RADIUS_M = 50
PLACE_DAYS = 30


def place_history(db: Session, r: Report, now=None) -> dict:
    """"Memoria del luogo": cosa è successo entro 50 m da questo punto negli ultimi 30 giorni."""
    now = now or utcnow()
    since = now - timedelta(days=PLACE_DAYS)
    dlat, dlon = 0.0006, 0.0009  # riquadro di ~65 m per filtrare già nel database
    stmt = select(Report).where(
        Report.created_at >= since,
        Report.lat.between(r.lat - dlat, r.lat + dlat),
        Report.lon.between(r.lon - dlon, r.lon + dlon),
    )
    nearby = [
        o for o in db.scalars(_with_relations(stmt)).all()
        if routing.haversine_m((r.lat, r.lon), (o.lat, o.lon)) <= PLACE_RADIUS_M
    ]
    closed = [o for o in nearby if o.resolved_at]
    avg = sum((active_duration(o, now) for o in closed), timedelta()) / len(closed) if closed else None
    return {
        "radius_m": PLACE_RADIUS_M,
        "days": PLACE_DAYS,
        "count": len(nearby),
        "resolved": len(closed),
        "avg_resolution_minutes": int(avg.total_seconds() // 60) if avg else None,
        "by_category": dict(Counter(o.category for o in nearby).most_common()),
        # Orari di creazione (UTC): l'app li converte nell'ora locale per la fascia oraria
        "created_at": [iso(o.created_at) for o in nearby],
    }


# ---------------------------------------------------------------- endpoint

@app.get("/")
def health():
    return {"app": "AccessBZ", "ok": True, "routing": bool(routing.ORS_API_KEY)}


@app.get("/meta")
def meta():
    return {
        "categories": CATEGORIES,
        "profiles": {k: {"label": v["label"], "categories": sorted(v["categories"])} for k, v in PROFILES.items()},
    }


@app.post("/users")
def upsert_user(data: UserIn, device_id: str = Depends(device_id_required), db: Session = Depends(get_db)):
    if data.profile not in PROFILES:
        raise HTTPException(400, "Profilo non valido")
    user = find_user(db, device_id)
    if user:
        user.nickname, user.profile = data.nickname, data.profile
    else:
        user = User(device_id=device_id, nickname=data.nickname, profile=data.profile)
        db.add(user)
    db.commit()
    return {"id": user.id, "nickname": user.nickname, "profile": user.profile}


@app.get("/reports")
def list_reports(
    scope: str = Query("active", pattern="^(active|all)$"),
    profile: str | None = Query(None, max_length=20),
    device_id: str | None = Depends(device_id_optional),
    db: Session = Depends(get_db),
):
    viewer = find_user(db, device_id)
    now = utcnow()
    rows = load_active_candidates(db, now) if scope == "active" else load_recent(db, PLACE_DAYS, now)
    out = []
    for r in rows:
        if not is_relevant(r.category, profile):
            continue
        d = report_to_dict(r, now, viewer.id if viewer else None)
        if scope == "active" and d["status"] not in ACTIVE_STATUSES:
            continue
        out.append(d)
    return out


@app.get("/reports/nearby")
def nearby_reports(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    category: str = Query(max_length=20),
    radius: float = Query(25, gt=0, le=200),
    device_id: str | None = Depends(device_id_optional),
    db: Session = Depends(get_db),
):
    """Segnalazioni ATTIVE della stessa categoria vicine a un punto: servono a evitare i duplicati."""
    viewer = find_user(db, device_id)
    now = utcnow()
    out = []
    for r in load_active_candidates(db, now):
        if r.category != category or compute_status(r, now) not in ACTIVE_STATUSES:
            continue
        d = routing.haversine_m((lat, lon), (r.lat, r.lon))
        if d <= radius:
            out.append({**report_to_dict(r, now, viewer.id if viewer else None), "distance_m": round(d)})
    return sorted(out, key=lambda x: x["distance_m"])


@app.get("/reports/{report_id}")
def get_report(report_id: int, device_id: str | None = Depends(device_id_optional), db: Session = Depends(get_db)):
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Segnalazione non trovata")
    viewer = find_user(db, device_id)
    d = report_to_dict(r, viewer_id=viewer.id if viewer else None)
    # Linea del tempo: creazione + ogni voto + risoluzione (un'unica query per i nomi)
    voter_ids = {v.user_id for v in r.votes}
    names = (
        dict(db.execute(select(User.id, User.nickname).where(User.id.in_(voter_ids))).all())
        if voter_ids else {}
    )
    timeline = [{"type": "created", "at": iso(r.created_at), "by": r.author.nickname}]
    for v in r.votes:
        timeline.append({
            "type": "confirmed" if v.present else "gone",
            "at": iso(v.created_at),
            "by": names.get(v.user_id, "?"),
        })
    if r.resolved_at:
        timeline.append({"type": "resolved", "at": iso(r.resolved_at), "by": None})
    d["timeline"] = timeline
    d["place"] = place_history(db, r)
    return d


@app.get("/reports/{report_id}/photo")
def get_photo(report_id: int, db: Session = Depends(get_db)):
    r = db.get(Report, report_id)
    if not r or not r.photo:
        raise HTTPException(404, "Foto non disponibile")
    return Response(
        content=r.photo,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400", "Content-Disposition": "inline"},
    )


@app.post("/reports", status_code=201)
def create_report(data: ReportIn, device_id: str = Depends(device_id_required), db: Session = Depends(get_db)):
    user = get_user(db, device_id)
    if data.category not in CATEGORIES:
        raise HTTPException(400, "Categoria non valida")
    if data.duration_class not in EXPECTED_DURATION:
        raise HTTPException(400, "Durata non valida")
    require_area(data.lat, data.lon)
    check_device_quota(device_id, "create", REPORTS_PER_DEVICE_PER_DAY, 86_400)

    photo = None
    if data.photo_base64:
        raw = data.photo_base64.split(",", 1)[-1]  # accetta anche "data:image/jpeg;base64,..."
        try:
            decoded = base64.b64decode(raw, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(400, "Foto non valida")
        try:
            photo = sanitize_image(decoded)
        except ImageError as e:
            raise HTTPException(400, str(e))

    now = utcnow()
    r = Report(
        category=data.category, lat=data.lat, lon=data.lon,
        description=data.description, duration_class=data.duration_class,
        photo=photo, has_photo=photo is not None,
        created_at=now, last_confirmed_at=now, created_by=user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return report_to_dict(r, viewer_id=user.id)


@app.post("/reports/{report_id}/vote")
def vote(report_id: int, data: VoteIn, device_id: str = Depends(device_id_required), db: Session = Depends(get_db)):
    user = get_user(db, device_id)
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Segnalazione non trovata")
    if compute_status(r) == "expired":
        raise HTTPException(409, "Segnalazione scaduta")

    now = utcnow()
    # Un solo voto valido per utente: il nuovo sostituisce il precedente
    for old in [v for v in r.votes if v.user_id == user.id]:
        r.votes.remove(old)
    r.votes.append(Vote(user_id=user.id, present=data.present, created_at=now))
    apply_vote(r, user.id, data.present, now)
    db.commit()
    db.refresh(r)
    return report_to_dict(r, viewer_id=user.id)


@app.delete("/reports/{report_id}", status_code=204)
def delete_report(report_id: int, device_id: str = Depends(device_id_required), db: Session = Depends(get_db)):
    user = get_user(db, device_id)
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Segnalazione non trovata")
    if r.created_by != user.id:
        raise HTTPException(403, "Puoi eliminare solo le tue segnalazioni")
    db.delete(r)
    db.commit()


# ---------------------------------------------------------------- percorsi

@app.get("/geocode")
def geocode(q: str = Query(min_length=2, max_length=100)):
    q = clean_text(q)
    if len(q) < 2:
        raise HTTPException(422, "Ricerca troppo corta")
    spend_ors_budget()
    try:
        return routing.geocode(q)
    except routing.RoutingError as e:
        log.warning("geocode: %s", e)
        raise HTTPException(503, "Servizio di ricerca non disponibile")
    except Exception:
        log.exception("geocode")
        raise HTTPException(502, "Servizio di ricerca non raggiungibile")


@app.post("/route")
def route(data: RouteIn, db: Session = Depends(get_db)):
    if data.profile not in PROFILES:
        raise HTTPException(400, "Profilo non valido")
    require_area(*data.start)
    require_area(*data.end)
    ors_profile = PROFILES[data.profile]["ors"]
    now = utcnow()
    active = [
        report_to_dict(r, now)
        for r in load_active_candidates(db, now)
        if is_relevant(r.category, data.profile) and compute_status(r, now) in ACTIVE_STATUSES
    ]
    slim = [
        {k: o[k] for k in ("id", "category", "category_label", "lat", "lon", "status", "active_minutes")}
        for o in active
    ]

    try:
        spend_ors_budget()
        fast = routing.ors_route(data.start, data.end, ors_profile)
        fast["obstacles"] = routing.obstacles_on_route(fast["geometry"], slim)
        routes = [{"id": "fast", "label": "Percorso più veloce", **fast}]

        if fast["obstacles"]:
            # Evita gli ostacoli attivi più vicini al percorso (numero limitato: le richieste a ORS hanno un tetto)
            mid = ((data.start[0] + data.end[0]) / 2, (data.start[1] + data.end[1]) / 2)
            closest = sorted(slim, key=lambda o: routing.haversine_m(mid, (o["lat"], o["lon"])))
            avoid = [(o["lat"], o["lon"]) for o in closest[:MAX_AVOID_POLYGONS]]
            try:
                spend_ors_budget()
                alt = routing.ors_route(data.start, data.end, ors_profile, avoid_points=avoid)
                alt["obstacles"] = routing.obstacles_on_route(alt["geometry"], slim)
                routes.append({"id": "accessible", "label": "Percorso senza ostacoli", **alt})
            except routing.RoutingError:
                pass  # nessuna alternativa possibile: resta solo il percorso veloce
    except HTTPException:
        raise
    except routing.RoutingError as e:
        log.warning("route: %s", e)  # il dettaglio resta nei log del server, non va al client
        raise HTTPException(503, "Percorso non disponibile tra questi due punti")
    except Exception:
        log.exception("route")
        raise HTTPException(502, "Servizio percorsi non raggiungibile")

    for r in routes:
        r["geometry"] = [[round(lat, 6), round(lon, 6)] for lat, lon in r["geometry"]]
    return {"profile": data.profile, "routes": routes}


# ---------------------------------------------------------------- statistiche

def _summary(reports, now):
    statuses = Counter(compute_status(r, now) for r in reports)
    closed = [r for r in reports if r.resolved_at]
    avg = (
        sum((active_duration(r, now) for r in closed), timedelta()) / len(closed)
        if closed else None
    )
    active = [r for r in reports if compute_status(r, now) in ACTIVE_STATUSES]
    return {
        "total": len(reports),
        "active": len(active),
        "resolved": statuses.get("resolved", 0),
        "expired": statuses.get("expired", 0),
        "by_status": dict(statuses),
        "active_by_category": dict(Counter(r.category for r in active)),
        "avg_resolution_minutes": int(avg.total_seconds() // 60) if avg else None,
    }


@app.get("/stats/me")
def my_stats(device_id: str = Depends(device_id_required), db: Session = Depends(get_db)):
    user = get_user(db, device_id)
    now = utcnow()
    mine = db.scalars(_with_relations(select(Report).where(Report.created_by == user.id))).all()
    s = _summary(mine, now)
    s["confirmed_by_community"] = sum(count_confirmations(r) for r in mine)
    s["votes_given"] = db.scalar(select(func.count(Vote.id)).where(Vote.user_id == user.id))
    s["by_category"] = dict(Counter(r.category for r in mine))
    return s


@app.get("/stats/city")
def city_stats(db: Session = Depends(get_db)):
    # "Bolzano adesso": ultimi 90 giorni (non tutta la storia del database)
    return _summary(load_recent(db, 90), utcnow())
