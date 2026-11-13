"""Backend AccessBZ.

All'avvio legge il file backend/.env (se esiste) e imposta le variabili d'ambiente
che non sono già definite, ad esempio ORS_API_KEY. Su Render le variabili si
impostano invece dal pannello del servizio.
"""
import os
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

if _ENV_FILE.exists():
    for line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
