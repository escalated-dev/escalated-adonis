#!/bin/sh
set -eu

cd /host

echo "[demo] waiting for postgres..."
until pg_isready -h "${DB_HOST:-db}" -p "${DB_PORT:-5432}" -U "${DB_USER:-escalated}" >/dev/null 2>&1; do
    sleep 1
done

echo "[demo] running migrations"
node ace.js migration:run --force

echo "[demo] ready (agents will be seeded on first /demo request)"
exec "$@"
