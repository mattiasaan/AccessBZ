"""API REST di AccessBZ."""
import base64
import binascii
from collections import Counter
from datetime import timedelta

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from . import routing
from .categories import CATEGORIES, PROFILES, is_relevant
from .database import Base, engine, get_db
from .lifecycle import (
    ACTIVE_STATUSES,
    EXPECTED_DURATION,
    active_duration,
    apply_vote,
    compute_status,
    count_confirmations,
    utcnow,
)
from .models import Report, User, Vote

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AccessBZ API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MAX_PHOTO_BYTES = 1_500_000


# ---------------------------------------------------------------- schemi

class UserIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=64)
    nickname: str = Field(min_length=1, max_length=40)
    profile: str = "pedestrian"


class ReportIn(BaseModel):
    device_id: str
    category: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    description: str = Field(default="", max_length=300)
    duration_class: str = "unknown"
    photo_base64: str | None = None


class VoteIn(BaseModel):
    device_id: str
    present: bool


class RouteIn(BaseModel):
    start: tuple[float, float]  # (lat, lon)
    end: tuple[float, float]
    profile: str = "pedestrian"


# ---------------------------------------------------------------- utilità

def iso(dt):
    return dt.isoformat(timespec="seconds") + "Z" if dt else None


def get_user(db: Session, device_id: str) -> User:
    user = db.scalar(select(User).where(User.device_id == device_id))
    if not user:
        raise HTTPException(404, "Utente non registrato")
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


def load_reports(db: Session):
    return db.scalars(
        select(Report).options(selectinload(Report.votes), selectinload(Report.author))
    ).all()


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
def upsert_user(data: UserIn, db: Session = Depends(get_db)):
    if data.profile not in PROFILES:
        raise HTTPException(400, "Profilo non valido")
    user = db.scalar(select(User).where(User.device_id == data.device_id))
    if user:
        user.nickname, user.profile = data.nickname, data.profile
    else:
        user = User(device_id=data.device_id, nickname=data.nickname, profile=data.profile)
        db.add(user)
    db.commit()
    return {"id": user.id, "nickname": user.nickname, "profile": user.profile}


@app.get("/reports")
def list_reports(
    scope: str = Query("active", pattern="^(active|all)$"),
    profile: str | None = None,
    device_id: str | None = None,
    db: Session = Depends(get_db),
):
    viewer = db.scalar(select(User).where(User.device_id == device_id)) if device_id else None
    now = utcnow()
    out = []
    for r in load_reports(db):
        if not is_relevant(r.category, profile):
            continue
        d = report_to_dict(r, now, viewer.id if viewer else None)
        if scope == "active" and d["status"] not in ACTIVE_STATUSES:
            continue
        out.append(d)
    return out


@app.get("/reports/{report_id}")
def get_report(report_id: int, device_id: str | None = None, db: Session = Depends(get_db)):
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Segnalazione non trovata")
    viewer = db.scalar(select(User).where(User.device_id == device_id)) if device_id else None
    d = report_to_dict(r, viewer_id=viewer.id if viewer else None)
    # Linea del tempo: creazione + ogni voto + risoluzione
    timeline = [{"type": "created", "at": iso(r.created_at), "by": r.author.nickname}]
    for v in r.votes:
        voter = db.get(User, v.user_id)
        timeline.append({
            "type": "confirmed" if v.present else "gone",
            "at": iso(v.created_at),
            "by": voter.nickname if voter else "?",
        })
    if r.resolved_at:
        timeline.append({"type": "resolved", "at": iso(r.resolved_at), "by": None})
    d["timeline"] = timeline
    return d


@app.get("/reports/{report_id}/photo")
def get_photo(report_id: int, db: Session = Depends(get_db)):
    r = db.get(Report, report_id)
    if not r or not r.photo:
        raise HTTPException(404, "Foto non disponibile")
    return Response(content=r.photo, media_type="image/jpeg", headers={"Cache-Control": "max-age=86400"})


@app.post("/reports", status_code=201)
def create_report(data: ReportIn, db: Session = Depends(get_db)):
    user = get_user(db, data.device_id)
    if data.category not in CATEGORIES:
        raise HTTPException(400, "Categoria non valida")
    if data.duration_class not in EXPECTED_DURATION:
        raise HTTPException(400, "Durata non valida")

    photo = None
    if data.photo_base64:
        raw = data.photo_base64.split(",", 1)[-1]  # accetta anche "data:image/jpeg;base64,..."
        try:
            photo = base64.b64decode(raw, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(400, "Foto non valida")
        if len(photo) > MAX_PHOTO_BYTES:
            raise HTTPException(413, "Foto troppo grande")

    now = utcnow()
    r = Report(
        category=data.category, lat=data.lat, lon=data.lon,
        description=data.description.strip(), duration_class=data.duration_class,
        photo=photo, has_photo=photo is not None,
        created_at=now, last_confirmed_at=now, created_by=user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return report_to_dict(r, viewer_id=user.id)


@app.post("/reports/{report_id}/vote")
def vote(report_id: int, data: VoteIn, db: Session = Depends(get_db)):
    user = get_user(db, data.device_id)
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
def delete_report(report_id: int, device_id: str, db: Session = Depends(get_db)):
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
def geocode(q: str = Query(min_length=2)):
    try:
        return routing.geocode(q)
    except routing.RoutingError as e:
        raise HTTPException(503, str(e))
    except Exception:
        raise HTTPException(502, "Servizio di ricerca non raggiungibile")


@app.post("/route")
def route(data: RouteIn, db: Session = Depends(get_db)):
    if data.profile not in PROFILES:
        raise HTTPException(400, "Profilo non valido")
    ors_profile = PROFILES[data.profile]["ors"]
    now = utcnow()
    active = [
        report_to_dict(r, now)
        for r in load_reports(db)
        if is_relevant(r.category, data.profile) and compute_status(r, now) in ACTIVE_STATUSES
    ]
    slim = [
        {k: o[k] for k in ("id", "category", "category_label", "lat", "lon", "status", "active_minutes")}
        for o in active
    ]

    try:
        fast = routing.ors_route(data.start, data.end, ors_profile)
        fast["obstacles"] = routing.obstacles_on_route(fast["geometry"], slim)
        routes = [{"id": "fast", "label": "Percorso più veloce", **fast}]

        if fast["obstacles"]:
            try:
                # Evita TUTTI gli ostacoli attivi vicini, non solo quelli del primo percorso
                avoid = [(o["lat"], o["lon"]) for o in slim]
                alt = routing.ors_route(data.start, data.end, ors_profile, avoid_points=avoid)
                alt["obstacles"] = routing.obstacles_on_route(alt["geometry"], slim)
                routes.append({"id": "accessible", "label": "Percorso senza ostacoli", **alt})
            except routing.RoutingError:
                pass  # nessuna alternativa possibile: resta solo il percorso veloce
    except routing.RoutingError as e:
        raise HTTPException(503, str(e))
    except Exception:
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
def my_stats(device_id: str, db: Session = Depends(get_db)):
    user = get_user(db, device_id)
    now = utcnow()
    mine = [r for r in load_reports(db) if r.created_by == user.id]
    s = _summary(mine, now)
    s["confirmed_by_community"] = sum(count_confirmations(r) for r in mine)
    s["votes_given"] = len(db.scalars(select(Vote).where(Vote.user_id == user.id)).all())
    s["by_category"] = dict(Counter(r.category for r in mine))
    return s


@app.get("/stats/city")
def city_stats(db: Session = Depends(get_db)):
    return _summary(load_reports(db), utcnow())
