#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

echo "[e2e] Prepare config and env"
[ -f config/config.js ] || cp config/config.example.js config/config.js
[ -f .env ] || cp .env.example .env

echo "[e2e] Prepare admin init.json"
mkdir -p data
cat > data/init.json << 'EOF'
{
  "initializedAt": "2025-01-01T00:00:00.000Z",
  "adminUsername": "admin",
  "adminPassword": "testpass1234",
  "version": "1.0.0",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
EOF

echo "[e2e] Build admin web if needed"
if [ ! -d web/admin-spa/dist ]; then
  npm run install:web
  npm run build:web
fi

echo "[e2e] Starting app server"
NODE_ENV=development node src/app.js

