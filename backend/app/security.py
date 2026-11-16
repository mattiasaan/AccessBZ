"""Protezioni del backend: limite di dimensione delle richieste, rate limiting,
header di sicurezza, identità del dispositivo e sanificazione delle immagini.
"""
import io
import json
import os
import re
import threading
import time
import warnings
from collections import deque

from fastapi import Header, HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

APP_ENV = os.getenv("APP_ENV", "development")
IS_PRODUCTION = APP_ENV == "production"

# Su Render c'è un proxy davanti al server: l'IP reale del client è in X-Forwarded-For.
# TRUSTED_PROXY_HOPS = numero di proxy fidati che aggiungono il loro IP in coda.
TRUSTED_PROXY_HOPS = int(os.getenv("TRUSTED_PROXY_HOPS", "0"))

# ------------------------------------------------------------------ dimensione delle richieste

MAX_BODY_BYTES = 2_000_000          # JSON con foto in base64 (circa 1,4 MB di immagine)
MAX_PHOTO_BASE64_CHARS = 1_900_000
MAX_PHOTO_BYTES = 1_400_000


def _json_response(status: int, detail: str, extra_headers=()):
    body = json.dumps({"detail": detail}).encode()
    headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
    headers.extend(extra_headers)
    return {"type": "http.response.start", "status": status, "headers": headers}, {
        "type": "http.response.body", "body": body,
    }


class BodySizeLimitMiddleware:
    """Rifiuta le richieste troppo grandi PRIMA di leggerle in memoria.

    - Se Content-Length supera il limite: 413 subito, senza leggere il corpo.
    - Se il corpo arriva "a pezzi" (chunked) si contano i byte e ci si ferma appena si supera.
    """

    def __init__(self, app, max_bytes: int = MAX_BODY_BYTES):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        headers = dict(scope.get("headers") or [])
        length = headers.get(b"content-length")
        if length is not None:
            try:
                too_big = int(length) > self.max_bytes
            except ValueError:
                too_big = True
            if too_big:
                start, body = _json_response(413, "Richiesta troppo grande")
                await send(start)
                return await send(body)

        received = 0

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLarge()
            return message

        try:
            await self.app(scope, limited_receive, send)
        except _BodyTooLarge:
            start, body = _json_response(413, "Richiesta troppo grande")
            await send(start)
            await send(body)


class _BodyTooLarge(HTTPException):
    # È una HTTPException: anche se FastAPI la intercetta mentre legge il JSON, risponde comunque 413
    def __init__(self):
        super().__init__(413, "Richiesta troppo grande")


# ------------------------------------------------------------------ IP del client

def client_ip(scope) -> str:
    """IP del client. Dietro un proxy si legge X-Forwarded-For contando da DESTRA
    (le voci a sinistra le può scrivere chiunque, quindi non sono affidabili)."""
    if TRUSTED_PROXY_HOPS > 0:
        headers = dict(scope.get("headers") or [])
        xff = headers.get(b"x-forwarded-for", b"").decode("latin-1")
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if len(parts) >= TRUSTED_PROXY_HOPS:
            return parts[-TRUSTED_PROXY_HOPS]
    client = scope.get("client")
    return client[0] if client else "unknown"


# ------------------------------------------------------------------ rate limiting

class SlidingWindowLimiter:
    """Contatore a finestra scorrevole in memoria (adatto a un solo server, come su Render free)."""

    MAX_KEYS = 50_000  # oltre questo numero si fa pulizia: evita di esaurire la memoria

    def __init__(self):
        self._hits: dict[str, deque] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window_s: float) -> float:
        """Registra una richiesta. Ritorna 0 se permessa, altrimenti i secondi da attendere."""
        now = time.monotonic()
        with self._lock:
            q = self._hits.get(key)
            if q is None:
                if len(self._hits) >= self.MAX_KEYS:
                    self._cleanup(now)
                q = self._hits[key] = deque()
            while q and now - q[0] > window_s:
                q.popleft()
            if len(q) >= limit:
                return max(1.0, window_s - (now - q[0]))
            q.append(now)
            return 0.0

    def _cleanup(self, now: float, max_window_s: float = 86_400):
        for k in [k for k, q in self._hits.items() if not q or now - q[-1] > max_window_s]:
            del self._hits[k]
        if len(self._hits) >= self.MAX_KEYS:  # ancora pieno: si svuota (meglio che crescere senza limite)
            self._hits.clear()

    def reset(self):
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()

# I limiti sono per indirizzo IP: tutti i telefoni sulla stessa rete Wi-Fi (scuola, giuria, demo)
# condividono lo stesso IP, quindi i limiti sono larghi. Servono a fermare gli abusi, non l'uso normale.
# RATE_LIMIT_SCALE (variabile d'ambiente) li moltiplica: es. 2 = il doppio, 0.5 = la metà.
RATE_LIMIT_SCALE = max(0.1, float(os.getenv("RATE_LIMIT_SCALE", "1")))


def _scaled(n: int) -> int:
    return max(1, round(n * RATE_LIMIT_SCALE))


# (metodo, regex del percorso, nome, richieste, finestra in secondi)
RATE_RULES = [
    ("POST", r"^/users$", "register", _scaled(30), 3600),
    ("POST", r"^/reports$", "create", _scaled(30), 600),
    ("POST", r"^/reports/\d+/vote$", "vote", _scaled(120), 600),
    ("DELETE", r"^/reports/\d+$", "delete", _scaled(60), 600),
    ("POST", r"^/route$", "route", _scaled(40), 600),
    ("GET", r"^/geocode$", "geocode", _scaled(80), 600),
]
GLOBAL_RULE = ("all", _scaled(300), 60)  # qualsiasi richiesta: 300 al minuto per IP
# Tetto giornaliero per TUTTO il server sulle chiamate a OpenRouteService (piano gratuito: 2000/giorno)
ORS_DAILY_BUDGET = int(os.getenv("ORS_DAILY_BUDGET", "1500"))

_compiled_rules = [(m, re.compile(p), n, lim, win) for m, p, n, lim, win in RATE_RULES]


class RateLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        ip = client_ip(scope)
        method, path = scope["method"], scope["path"]

        checks = [(f"all:{ip}", GLOBAL_RULE[1], GLOBAL_RULE[2])]
        for m, rx, name, lim, win in _compiled_rules:
            if m == method and rx.match(path):
                checks.append((f"{name}:{ip}", lim, win))

        for key, lim, win in checks:
            wait = limiter.hit(key, lim, win)
            if wait:
                start, body = _json_response(
                    429, "Troppe richieste: riprova tra poco",
                    extra_headers=[(b"retry-after", str(int(wait)).encode())],
                )
                await send(start)
                return await send(body)
        return await self.app(scope, receive, send)


def check_device_quota(device_id: str, name: str, limit: int, window_s: int):
    """Limite per dispositivo (oltre a quello per IP), es. segnalazioni al giorno."""
    if limiter.hit(f"{name}:dev:{device_id}", limit, window_s):
        raise HTTPException(429, "Hai raggiunto il limite giornaliero: riprova più tardi")


def spend_ors_budget(calls: int = 1):
    for _ in range(calls):
        if limiter.hit("ors:global", ORS_DAILY_BUDGET, 86_400):
            raise HTTPException(503, "Servizio percorsi temporaneamente non disponibile")


# ------------------------------------------------------------------ header di sicurezza

class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope["path"]
        is_docs = path in ("/docs", "/redoc", "/openapi.json") or path.startswith("/docs/")
        is_photo = path.endswith("/photo")

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = [(k, v) for k, v in message.get("headers", []) if k.lower() != b"server"]
                headers += [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"cross-origin-resource-policy", b"cross-origin" if is_photo else b"same-origin"),
                ]
                if not is_docs:  # la pagina /docs (solo in sviluppo) ha bisogno di script esterni
                    headers.append((b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"))
                if not is_photo and not any(k.lower() == b"cache-control" for k, _ in headers):
                    headers.append((b"cache-control", b"no-store"))
                if IS_PRODUCTION:
                    headers.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                message = {**message, "headers": headers}
            await send(message)

        return await self.app(scope, receive, send_with_headers)


# ------------------------------------------------------------------ identità del dispositivo

# L'ID del dispositivo è un segreto casuale generato dall'app: viaggia in un header
# (mai nell'URL, così non finisce nei log) e deve avere un formato preciso.
DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{16,80}$")


def _validate(device_id: str | None, required: bool) -> str | None:
    if device_id is None or device_id == "":
        if required:
            raise HTTPException(401, "Identificativo del dispositivo mancante")
        return None
    if not DEVICE_ID_RE.match(device_id):
        raise HTTPException(400, "Identificativo del dispositivo non valido")
    return device_id


def device_id_required(x_device_id: str | None = Header(default=None)) -> str:
    return _validate(x_device_id, required=True)


def device_id_optional(x_device_id: str | None = Header(default=None)) -> str | None:
    return _validate(x_device_id, required=False)


# ------------------------------------------------------------------ testo

_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f​-‏‪-‮⁦-⁩]")


def clean_text(value: str, allow_newlines: bool = False) -> str:
    """Toglie caratteri di controllo e invisibili (anche quelli che invertono il testo)."""
    value = _CONTROL.sub("", value)
    if not allow_newlines:
        value = value.replace("\n", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


# ------------------------------------------------------------------ immagini

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PIXELS = 24_000_000      # protezione dalle "decompression bomb"
OUTPUT_MAX_SIDE = 1280


class ImageError(ValueError):
    pass


def sanitize_image(raw: bytes) -> bytes:
    """Verifica che sia davvero un'immagine e la ricodifica in JPEG pulito:
    elimina metadati EXIF (compresa la posizione GPS), profili e contenuti nascosti."""
    if len(raw) > MAX_PHOTO_BYTES:
        raise ImageError("Foto troppo grande")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as probe:
                if probe.format not in ALLOWED_FORMATS:
                    raise ImageError("Formato non supportato")
                w, h = probe.size
                if w * h > MAX_PIXELS or w < 16 or h < 16:
                    raise ImageError("Dimensioni non valide")
                probe.verify()
            with Image.open(io.BytesIO(raw)) as img:
                img = ImageOps.exif_transpose(img)   # mantiene l'orientamento, poi l'EXIF viene scartato
                img = img.convert("RGB")
                img.thumbnail((OUTPUT_MAX_SIDE, OUTPUT_MAX_SIDE))
                out = io.BytesIO()
                img.save(out, format="JPEG", quality=80, optimize=True)  # nessun exif/icc salvato
                return out.getvalue()
    except ImageError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning, OSError, ValueError, SyntaxError):
        raise ImageError("Foto non valida")
