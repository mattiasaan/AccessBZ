#!/usr/bin/env bash
# Installa il backend AccessBZ su Raspberry Pi (Raspberry Pi OS, 64 bit consigliato).
#
# Uso, dalla cartella del repository clonato sul Pi:
#   bash deploy/raspberry-pi/install.sh
#
# Crea l'ambiente Python, il file .env, il database SQLite con i dati di esempio
# e due servizi systemd: il server (avvio automatico) e l'aggiornamento orario dei dati.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND="$REPO_DIR/backend"
RUN_USER="$(id -un)"
PORT="${PORT:-8000}"

echo "==> Repository: $REPO_DIR (utente: $RUN_USER)"

echo "==> Pacchetti di sistema"
sudo apt-get update -qq
sudo apt-get install -y -qq python3 python3-venv python3-pip git

echo "==> Ambiente Python"
python3 -m venv "$BACKEND/.venv"
"$BACKEND/.venv/bin/pip" install --upgrade -q pip
"$BACKEND/.venv/bin/pip" install -q -r "$BACKEND/requirements.txt"

ENV_FILE="$BACKEND/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "==> Creo $ENV_FILE"
  read -r -p "Chiave OpenRouteService (invio per lasciarla vuota): " ORS_KEY
  cat > "$ENV_FILE" <<EOF
ORS_API_KEY=$ORS_KEY
APP_ENV=production
# Il Pi riceve le richieste direttamente (nessun proxy davanti)
TRUSTED_PROXY_HOPS=0
DATABASE_URL=sqlite:///$BACKEND/accessbz.db
ORS_DAILY_BUDGET=1500
EOF
  chmod 600 "$ENV_FILE"   # la chiave è leggibile solo dal proprietario
else
  echo "==> $ENV_FILE esiste già: lo lascio com'è"
fi

echo "==> Database e dati di esempio"
(cd "$BACKEND" && .venv/bin/python populate.py --refresh-if-stale 12)

echo "==> Servizi systemd"
for unit in accessbz.service accessbz-refresh.service accessbz-refresh.timer; do
  sed -e "s|__USER__|$RUN_USER|g" -e "s|__BACKEND__|$BACKEND|g" -e "s|__PORT__|$PORT|g" \
    "$REPO_DIR/deploy/raspberry-pi/$unit" | sudo tee "/etc/systemd/system/$unit" > /dev/null
done
sudo systemctl daemon-reload
sudo systemctl enable --now accessbz.service accessbz-refresh.timer

sleep 3
IP="$(hostname -I | awk '{print $1}')"
if curl -fsS "http://127.0.0.1:$PORT/" > /dev/null; then
  echo
  echo "AccessBZ è attivo su http://$IP:$PORT"
  echo "Metti questo indirizzo nel profilo \"pi\" di app/eas.json (EXPO_PUBLIC_API_URL)."
else
  echo "Il server non risponde: controlla con  journalctl -u accessbz -n 50"
  exit 1
fi
