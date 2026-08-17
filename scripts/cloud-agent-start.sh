#!/usr/bin/env bash
# Cursor Cloud Agent `start` phase: per-boot runtime reconciliation. Must be quick,
# idempotent, and return (it does not block). Heavy one-time work lives in `install`.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/cloud-agent-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/cloud-agent-lib.sh"

# Postgres is not running on a fresh boot — bring it (and the dev role/db) back up.
ca_postgres_up
# Recreate .env if a clean checkout dropped it.
ca_write_env
# Apply any migrations added since the snapshot (no-op when already current).
ca_use_node24
npx prisma migrate deploy || true

echo "[cloud-agent] start complete"
