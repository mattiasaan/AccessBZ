#!/usr/bin/env bash
# Aggiorna il backend sul Pi all'ultima versione del repository e lo riavvia.
#   bash deploy/raspberry-pi/update.sh
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"
git pull --ff-only
backend/.venv/bin/pip install -q -r backend/requirements.txt
sudo systemctl restart accessbz.service
sleep 2
systemctl --no-pager --lines=0 status accessbz.service
