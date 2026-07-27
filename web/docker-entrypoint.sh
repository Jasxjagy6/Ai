#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  npx prisma migrate deploy
fi

if [ "${RUN_SEED:-true}" = "true" ]; then
  npx tsx prisma/seed.ts 2>/dev/null || echo "Seed skipped (already seeded or unavailable)"
fi

exec "$@"
