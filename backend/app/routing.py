"""Percorsi con OpenRouteService (ORS) e calcolo degli ostacoli lungo il percorso.

Idea chiave: ogni ostacolo attivo diventa un piccolo quadrato "da evitare"
(avoid_polygons). ORS calcola così un percorso alternativo che gira intorno agli ostacoli.
"""
import math
import os

import httpx

ORS_URL = "https://api.openrouteservice.org"
ORS_API_KEY = os.getenv("ORS_API_KEY", "")

# Bolzano: punto di riferimento della ricerca indirizzi se non si conosce la partenza
BZ_CENTER = (46.4983, 11.3548)
# Rettangolo che contiene tutto il Trentino-Alto Adige (area di servizio e ricerca indirizzi)
REGION_RECT = {"min_lat": 45.67, "max_lat": 47.10, "min_lon": 10.38, "max_lon": 12.48}

AVOID_HALF_SIDE_M = 12      # mezzo lato del quadrato intorno all'ostacolo
ON_ROUTE_THRESHOLD_M = 20   # un ostacolo è "sul percorso" se dista meno di così


class RoutingError(Exception):
    pass


# ---------- geometria (approssimazione piana, ottima su distanze cittadine) ----------

def _to_xy(lat, lon, ref_lat):
    """Converte lat/lon in metri rispetto all'origine."""
    k = 111_320
    return lon * k * math.cos(math.radians(ref_lat)), lat * 110_540


def haversine_m(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def locate_on_route(point, line):
    """Ritorna (distanza dal percorso in m, distanza dalla partenza lungo il percorso in m).

    point = (lat, lon), line = [(lat, lon), ...]
    """
    ref = point[0]
    px, py = _to_xy(point[0], point[1], ref)
    best_dist, best_along, travelled = float("inf"), 0.0, 0.0
    for (alat, alon), (blat, blon) in zip(line, line[1:]):
        ax, ay = _to_xy(alat, alon, ref)
        bx, by = _to_xy(blat, blon, ref)
        dx, dy = bx - ax, by - ay
        seg_len = math.hypot(dx, dy)
        t = 0.0 if seg_len == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg_len**2))
        cx, cy = ax + t * dx, ay + t * dy
        d = math.hypot(px - cx, py - cy)
        if d < best_dist:
            best_dist, best_along = d, travelled + t * seg_len
        travelled += seg_len
    return best_dist, best_along


def obstacles_on_route(line, reports):
    """Ostacoli vicini al percorso, ordinati dalla partenza all'arrivo."""
    found = []
    for r in reports:
        dist, along = locate_on_route((r["lat"], r["lon"]), line)
        if dist <= ON_ROUTE_THRESHOLD_M:
            found.append({**r, "distance_from_route_m": round(dist), "distance_along_m": round(along)})
    return sorted(found, key=lambda o: o["distance_along_m"])


def avoid_square(lat, lon, half_side_m=AVOID_HALF_SIDE_M):
    dlat = half_side_m / 110_540
    dlon = half_side_m / (111_320 * math.cos(math.radians(lat)))
    return [[
        [lon - dlon, lat - dlat],
        [lon + dlon, lat - dlat],
        [lon + dlon, lat + dlat],
        [lon - dlon, lat + dlat],
        [lon - dlon, lat - dlat],
    ]]


# ---------- chiamate a OpenRouteService ----------

def _require_key():
    if not ORS_API_KEY:
        raise RoutingError("Chiave ORS_API_KEY mancante sul server")


def ors_route(start, end, ors_profile, avoid_points=None, avoid_features=None):
    """start/end = (lat, lon). Ritorna dict con geometry [(lat, lon)], distance_m, duration_s.
    avoid_features: es. ["steps"] per evitare le scale (solo profili a piedi)."""
    _require_key()
    body = {
        "coordinates": [[start[1], start[0]], [end[1], end[0]]],
        "instructions": False,
        "language": "it",
    }
    options = {}
    if avoid_features:
        options["avoid_features"] = list(avoid_features)
    if avoid_points:
        options["avoid_polygons"] = {
            "type": "MultiPolygon",
            "coordinates": [avoid_square(lat, lon) for lat, lon in avoid_points],
        }
    if options:
        body["options"] = options
    resp = httpx.post(
        f"{ORS_URL}/v2/directions/{ors_profile}/geojson",
        json=body,
        headers={"Authorization": ORS_API_KEY},
        timeout=20,
    )
    if resp.status_code != 200:
        try:
            msg = resp.json().get("error", {}).get("message", resp.text)
        except ValueError:
            msg = resp.text
        raise RoutingError(f"OpenRouteService: {msg}")

    feature = resp.json()["features"][0]
    summary = feature["properties"].get("summary", {})
    return {
        "geometry": [(lat, lon) for lon, lat in feature["geometry"]["coordinates"]],
        "distance_m": round(summary.get("distance", 0)),
        "duration_s": round(summary.get("duration", 0)),
    }


def geocode(text, focus=None, lang="it"):
    """Cerca un indirizzo o un luogo in Trentino-Alto Adige, preferendo quelli vicini a focus."""
    _require_key()
    focus = focus or BZ_CENTER
    resp = httpx.get(
        f"{ORS_URL}/geocode/search",
        params={
            "api_key": ORS_API_KEY,
            "text": text,
            "size": 6,
            "lang": lang,
            "focus.point.lat": focus[0],
            "focus.point.lon": focus[1],
            "boundary.rect.min_lon": REGION_RECT["min_lon"],
            "boundary.rect.min_lat": REGION_RECT["min_lat"],
            "boundary.rect.max_lon": REGION_RECT["max_lon"],
            "boundary.rect.max_lat": REGION_RECT["max_lat"],
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise RoutingError(f"Ricerca indirizzo non riuscita ({resp.status_code})")
    return [
        {
            "label": f["properties"].get("label", ""),
            "lat": f["geometry"]["coordinates"][1],
            "lon": f["geometry"]["coordinates"][0],
        }
        for f in resp.json().get("features", [])
    ]
