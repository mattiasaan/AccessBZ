import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db")

from datetime import timedelta  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app import lifecycle, routing  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)
PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="


def make_user(dev, profile="wheelchair"):
    r = client.post("/users", json={"device_id": dev, "nickname": dev[:6], "profile": profile})
    assert r.status_code == 200, r.text


def test_full_lifecycle():
    for d in ("device-aaaa", "device-bbbb", "device-cccc"):
        make_user(d)
    r = client.post("/reports", json={
        "device_id": "device-aaaa", "category": "vehicle", "lat": 46.4997, "lon": 11.3559,
        "duration_class": "minutes", "photo_base64": PIXEL,
    })
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["status"] == "new"
    assert client.get(f"/reports/{rid}/photo").status_code == 200

    r = client.post(f"/reports/{rid}/vote", json={"device_id": "device-bbbb", "present": True})
    assert r.json()["status"] == "confirmed" and r.json()["confirmations"] == 1

    # un solo "non c'è più" di un altro utente non basta
    r = client.post(f"/reports/{rid}/vote", json={"device_id": "device-cccc", "present": False})
    assert r.json()["status"] == "confirmed"
    r = client.post(f"/reports/{rid}/vote", json={"device_id": "device-bbbb", "present": False})
    assert r.json()["status"] == "resolved"

    detail = client.get(f"/reports/{rid}").json()
    assert [t["type"] for t in detail["timeline"]][0] == "created"
    assert detail["timeline"][-1]["type"] == "resolved"

    # profilo bici non vede i veicoli sul marciapiede
    ids = [x["id"] for x in client.get("/reports", params={"scope": "all", "profile": "bike"}).json()]
    assert rid not in ids
    assert client.get("/stats/me", params={"device_id": "device-aaaa"}).json()["resolved"] == 1


def test_author_resolves_and_delete():
    make_user("device-dddd")
    rid = client.post("/reports", json={"device_id": "device-dddd", "category": "works",
                                        "lat": 46.5, "lon": 11.35}).json()["id"]
    r = client.post(f"/reports/{rid}/vote", json={"device_id": "device-dddd", "present": False})
    assert r.json()["status"] == "resolved"
    assert client.delete(f"/reports/{rid}", params={"device_id": "device-aaaa"}).status_code == 403
    assert client.delete(f"/reports/{rid}", params={"device_id": "device-dddd"}).status_code == 204


def test_nearby_and_place_history():
    make_user("device-eeee")
    first = client.post("/reports", json={"device_id": "device-eeee", "category": "tables",
                                          "lat": 46.4950, "lon": 11.3600}).json()
    # stessa categoria a ~10 m: è un possibile duplicato
    near = client.get("/reports/nearby", params={"lat": 46.49509, "lon": 11.3600, "category": "tables"}).json()
    assert [n["id"] for n in near] == [first["id"]] and 5 <= near[0]["distance_m"] <= 15
    # categoria diversa o troppo lontano: nessun duplicato
    assert client.get("/reports/nearby", params={"lat": 46.49509, "lon": 11.3600, "category": "snow"}).json() == []
    assert client.get("/reports/nearby", params={"lat": 46.4970, "lon": 11.3600, "category": "tables"}).json() == []

    second = client.post("/reports", json={"device_id": "device-eeee", "category": "vehicle",
                                           "lat": 46.49520, "lon": 11.3600}).json()
    client.post(f"/reports/{second['id']}/vote", json={"device_id": "device-eeee", "present": False})
    place = client.get(f"/reports/{first['id']}").json()["place"]
    assert place["count"] == 2 and place["resolved"] == 1
    assert set(place["by_category"]) == {"tables", "vehicle"} and len(place["created_at"]) == 2


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
    assert lifecycle.compute_status(r) == "persistent"  # più lungo della durata prevista
    r = FakeReport("days", timedelta(hours=1), timedelta(minutes=5), [V(2)])
    assert lifecycle.compute_status(r) == "confirmed"


def test_obstacles_on_route():
    line = [(46.4990, 11.3500), (46.4990, 11.3600)]  # linea est-ovest di ~770 m
    obs = [
        {"id": 1, "lat": 46.49905, "lon": 11.3550},   # ~6 m dal percorso
        {"id": 2, "lat": 46.5010, "lon": 11.3550},    # ~220 m: fuori
        {"id": 3, "lat": 46.4990, "lon": 11.3510},
    ]
    found = routing.obstacles_on_route(line, obs)
    assert [o["id"] for o in found] == [3, 1]
    assert 70 < found[0]["distance_along_m"] < 85


def test_route_without_key_is_clear_error():
    if routing.ORS_API_KEY:
        return
    r = client.post("/route", json={"start": [46.49, 11.35], "end": [46.5, 11.36], "profile": "wheelchair"})
    assert r.status_code == 503 and "ORS_API_KEY" in r.json()["detail"]
