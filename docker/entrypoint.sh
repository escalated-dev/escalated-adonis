#!/bin/sh
set -eu

cd /host

echo "[demo] waiting for postgres..."
until pg_isready -h "${DB_HOST:-db}" -p "${DB_PORT:-5432}" -U "${DB_USER:-escalated}" >/dev/null 2>&1; do
    sleep 1
done

echo "[demo] running migrations"
node ace migration:run --force 2>&1 || echo "[demo] migrations: skipped/failed"

echo "[demo] ready"
exec "$@"
