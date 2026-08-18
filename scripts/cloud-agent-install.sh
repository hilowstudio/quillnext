#!/usr/bin/env bash
# Cursor Cloud Agent `install` phase: idempotent, durable setup after checkout.
# Prepares Node deps, the Prisma client, and the local Postgres schema + seed data.
# Node 24 and Postgres 16 (+pgvector) themselves come from the base snapshot.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/cloud-agent-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/cloud-agent-lib.sh"

ca_use_node24
node -v

# Local Postgres + dev role/db, and a local .env (both idempotent).
ca_postgres_up
ca_write_env

# Dependencies + generated Prisma client.
npm ci
npx prisma generate
npm run postgenerate

# Schema (forward-only) + reference/content data. All seeds are idempotent upserts.
npx prisma migrate deploy
npm run db:seed
npm run db:seed:generators
npm run db:seed:discipleship
npm run db:seed:counties
npm run db:seed:catechisms
npm run db:seed:commentary

echo "[cloud-agent] install complete"
