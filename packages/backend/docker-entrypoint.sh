#!/bin/sh
set -e

# Run database migrations on startup
echo "[entrypoint] Running database migrations..."
/app/node_modules/.bin/prisma migrate deploy
echo "[entrypoint] Migrations complete."

# Execute the main application
echo "[entrypoint] Starting MyndBBS backend..."
exec node dist/index.js
