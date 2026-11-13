import base64
import io
import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db")

from datetime import timedelta  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app import lifecycle, routing  # noqa: E402
from app.main import app  # noqa: E402
from app.security import limiter  # noqa: E402

client = TestClient(app)

BZ = {"lat": 46.4983, "lon": 11.3548}


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    limiter.reset()
    yield


def dev(name):
    """ID dispositivo valido (almeno 16 caratteri)."""
    return f"test-device-{name}-0000"


def h(name):
    return {"X-Device-Id": dev(name)}


def make_user(name, profile="wheelchair"):
    r = client.post("/users", json={"nickname": name[:10], "profile": profile}, headers=h(name))
    assert r.status_code == 200, r.text


def make_image(fmt="JPEG", size=(64, 48), exif_gps=False):
    img = Image.new("RGB", size, (200, 30, 30))
    buf = io.BytesIO()
    kwargs = {}
    if exif_gps:
        exif = Image.Exif()
        exif[0x8825] = {1: "N", 2: (46.0, 29.0, 54.0)}  # GPSInfo
        exif[0x010F] = "FotocameraSegreta"              # Make
        kwargs["exif"] = exif
    img.save(buf, format=fmt, **kwargs)
    return base64.b64encode(buf.getvalue()).decode()


def new_report(name, category="vehicle", **extra):
    body = {"category": category, **BZ, **extra}
    return client.post("/reports", json=body, headers=h(name))


# ------------------------------------------------------------------ funzionalità

def test_full_lifecycle():
    for n in ("aaaa", "bbbb", "cccc"):
        make_user(n)
    r = new_report("aaaa", duration_class="minutes", photo_base64=make_image())
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["status"] == "new"
    photo = client.get(f"/reports/{rid}/photo")
    assert photo.status_code == 200 and photo.headers["content-type"] == "image/jpeg"

    r = client.post(f"/reports/{rid}/vote", json={"present": True}, headers=h("bbbb"))
    assert r.json()["status"] == "confirmed" and r.json()["confirmations"] == 1

    r = client.post(f"/reports/{rid}/vote", json={"present": False}, headers=h("cccc"))
    assert r.json()["status"] == "confirmed"
    r = client.post(f"/reports/{rid}/vote", json={"present": False}, headers=h("bbbb"))
    assert r.json()["status"] == "resolved"

    detail = client.get(f"/reports/{rid}").json()
    assert detail["timeline"][0]["type"] == "created"
    assert detail["timeline"][-1]["type"] == "resolved"

    ids = [x["id"] for x in client.get("/reports", params={"scope": "all", "profile": "bike"}).json()]
    assert rid not in ids
    assert client.get("/stats/me", headers=h("aaaa")).json()["resolved"] == 1


def test_author_resolves_and_delete():
    make_user("dddd")
    make_user("ffff")
    rid = new_report("dddd", category="works").json()["id"]
    r = client.post(f"/reports/{rid}/vote", json={"present": False}, headers=h("dddd"))
    assert r.json()["status"] == "resolved"
    assert client.delete(f"/reports/{rid}", headers=h("ffff")).status_code == 403
    assert client.delete(f"/reports/{rid}", headers=h("dddd")).status_code == 204


def test_nearby_and_place_history():
    make_user("eeee")
    first = client.post("/reports", json={"category": "tables", "lat": 46.4950, "lon": 11.3600}, headers=h("eeee")).json()
    near = client.get("/reports/nearby", params={"lat": 46.49509, "lon": 11.3600, "category": "tables"}).json()
    assert [n["id"] for n in near] == [first["id"]] and 5 <= near[0]["distance_m"] <= 15
    assert client.get("/reports/nearby", params={"lat": 46.49509, "lon": 11.3600, "category": "snow"}).json() == []
    assert client.get("/reports/nearby", params={"lat": 46.4970, "lon": 11.3600, "category": "tables"}).json() == []

    second = client.post("/reports", json={"category": "vehicle", "lat": 46.49520, "lon": 11.3600}, headers=h("eeee")).json()
    client.post(f"/reports/{second['id']}/vote", json={"present": False}, headers=h("eeee"))
    place = client.get(f"/reports/{first['id']}").json()["place"]
    assert place["count"] == 2 and place["resolved"] == 1
    assert set(place["by_category"]) == {"tables", "vehicle"} and len(place["created_at"]) == 2


# ------------------------------------------------------------------ identità del dispositivo

def test_device_id_required_and_validated():
    assert client.post("/users", json={"nickname": "x"}).status_code == 401
    assert client.post("/users", json={"nickname": "x"}, headers={"X-Device-Id": "corto"}).status_code == 400
    assert client.post("/users", json={"nickname": "x"}, headers={"X-Device-Id": "a" * 16 + "<script>"}).status_code == 400
    # gli account demo del seed ("demo-user-0") non sono utilizzabili dall'esterno
    assert client.post("/reports", json={"category": "works", **BZ}, headers={"X-Device-Id": "demo-user-0"}).status_code == 400
    # dispositivo valido ma non registrato
    assert new_report("mai-registrato").status_code == 401


def test_text_is_cleaned():
    r = client.post("/users", json={"nickname": "  Ma‮ria\x00  "}, headers=h("clean"))
    assert r.json()["nickname"] == "Maria"
    assert client.post("/users", json={"nickname": "​​"}, headers=h("clean2")).status_code == 422


# ------------------------------------------------------------------ immagini

def test_photo_is_reencoded_without_exif():
    make_user("photo")
    r = new_report("photo", photo_base64=make_image("PNG", exif_gps=True))
    assert r.status_code == 201, r.text
    data = client.get(f"/reports/{r.json()['id']}/photo").content
    assert data[:3] == b"\xff\xd8\xff"  # ricodificata in JPEG
    with Image.open(io.BytesIO(data)) as img:
        assert not img.getexif()  # niente EXIF né posizione GPS
    assert b"FotocameraSegreta" not in data


def test_fake_or_huge_photos_rejected():
    make_user("bad")
    fake = base64.b64encode(b"<?php echo 'non sono una foto'; ?>" * 10).decode()
    assert new_report("bad", photo_base64=fake).status_code == 400
    assert new_report("bad", photo_base64="!!!non-base64!!!").status_code == 400
    # GIF non ammessa
    assert new_report("bad", photo_base64=make_image("GIF")).status_code == 400


def test_body_size_limit_before_reading():
    # Content-Length dichiarato troppo grande: rifiutato senza leggere il corpo
    r = client.post("/reports", content=b"{}", headers={**h("big"), "Content-Type": "application/json", "Content-Length": "50000000"})
    assert r.status_code == 413
    # corpo davvero troppo grande
    r = client.post("/reports", content=b"x" * 2_100_000, headers={**h("big"), "Content-Type": "application/json"})
    assert r.status_code == 413


# ------------------------------------------------------------------ area e rate limiting

def test_outside_service_area_rejected():
    make_user("area")
    r = client.post("/reports", json={"category": "works", "lat": 41.9, "lon": 12.5}, headers=h("area"))  # Roma
    assert r.status_code == 422
    r = client.post("/route", json={"start": [41.9, 12.5], "end": [46.5, 11.35], "profile": "wheelchair"})
    assert r.status_code == 422


def test_rate_limit_registration():
    codes = [
        client.post("/users", json={"nickname": "spam"}, headers=h(f"spam{i}")).status_code
        for i in range(12)
    ]
    assert codes[:10] == [200] * 10 and codes[10] == 429
    r = client.post("/users", json={"nickname": "spam"}, headers=h("spam99"))
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0


def test_rate_limit_report_creation():
    make_user("flood")
    codes = [new_report("flood", category="other", lat=46.49 + i * 0.001).status_code for i in range(9)]
    assert codes[:8] == [201] * 8 and codes[8] == 429


def test_security_headers_and_no_docs_leak():
    r = client.get("/")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "default-src 'none'" in r.headers["content-security-policy"]
    assert r.headers["cache-control"] == "no-store"
    assert "server" not in r.headers


def test_route_errors_do_not_leak_details(monkeypatch):
    def boom(*a, **k):
        raise routing.RoutingError("OpenRouteService: chiave segreta abc123 non valida")
    monkeypatch.setattr(routing, "ors_route", boom)
    r = client.post("/route", json={"start": [46.49, 11.35], "end": [46.50, 11.36], "profile": "wheelchair"})
    assert r.status_code == 503 and "abc123" not in r.text


# ------------------------------------------------------------------ logica pura

class FakeReport:
    def __init__(self, dur, created_ago, confirmed_ago, votes=()):
        now = lifecycle.utcnow()
        self.duration_class = dur
        self.created_at = now - created_ago
        self.last_confirmed_at = now - confirmed_ago
        self.resolved_at = None
        self.created_by = 1
        self.votes = list(votes)


def test_expiry_and_persistent():
    assert lifecycle.compute_status(FakeReport("minutes", timedelta(hours=2), timedelta(hours=2))) == "expired"

    class V:
        def __init__(self, uid):
            self.user_id, self.present = uid, True

    r = FakeReport("minutes", timedelta(minutes=45), timedelta(minutes=5), [V(2)])
    assert lifecycle.compute_status(r) == "persistent"
    r = FakeReport("days", timedelta(hours=1), timedelta(minutes=5), [V(2)])
    assert lifecycle.compute_status(r) == "confirmed"


def test_obstacles_on_route():
    line = [(46.4990, 11.3500), (46.4990, 11.3600)]
    obs = [
        {"id": 1, "lat": 46.49905, "lon": 11.3550},
        {"id": 2, "lat": 46.5010, "lon": 11.3550},
        {"id": 3, "lat": 46.4990, "lon": 11.3510},
    ]
    found = routing.obstacles_on_route(line, obs)
    assert [o["id"] for o in found] == [3, 1]
    assert 70 < found[0]["distance_along_m"] < 85
