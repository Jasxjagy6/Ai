#!/bin/sh
set -e

npx prisma migrate deploy

npx tsx prisma/seed.ts 2>/dev/null || echo "Seed skipped (already seeded or unavailable)"

exec "$@"
