#!/usr/bin/env bash
# Shared helpers for the Cursor Cloud Agent dev environment (install + start).
# Sourced by scripts/cloud-agent-install.sh and scripts/cloud-agent-start.sh.
# Everything here is idempotent so it is safe to re-run on every boot.

# Repo root = parent of this script's directory.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Put the repo-pinned Node 24 at the front of PATH so it wins over any other `node`
# on the image (the platform's `/exec-daemon/node` is earlier in PATH otherwise).
# `.nvmrc` pins Node 24 and package.json requires `node >=24`. Installs Node 24 via
# nvm on demand so the scripts work on any base image, not just the seeded snapshot.
ca_use_node24() {
  local bin
  bin="$(ls -d "$HOME"/.nvm/versions/node/v24*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [ -z "$bin" ]; then
    echo "[cloud-agent] Node 24 not found — installing via nvm..."
    export NVM_DIR="$HOME/.nvm"
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    fi
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm install 24
    bin="$(ls -d "$HOME"/.nvm/versions/node/v24*/bin 2>/dev/null | sort -V | tail -1 || true)"
  fi
  if [ -n "$bin" ]; then
    export PATH="$bin:$PATH"
  else
    echo "[cloud-agent] WARNING: could not provision Node 24; using $(command -v node || echo none)" >&2
  fi
}

# Bring the local Postgres 16 cluster online and ensure the dev role + database exist.
# Installs Postgres 16 + pgvector on demand so the scripts work on any base image.
# Uses the OS `postgres` superuser (peer auth) for administration.
ca_postgres_up() {
  if ! command -v pg_ctlcluster >/dev/null 2>&1; then
    echo "[cloud-agent] Postgres not found — installing postgresql-16 + pgvector..."
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      postgresql postgresql-contrib postgresql-16-pgvector ssl-cert
  fi
  sudo pg_ctlcluster 16 main start 2>/dev/null || true
  local i
  for i in $(seq 1 30); do
    if sudo -u postgres pg_isready -q 2>/dev/null; then break; fi
    sleep 1
  done
  # Dev role: superuser so `prisma migrate deploy` can CREATE EXTENSION vector and the
  # RLS event trigger. Local-only credentials (never used against prod).
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='quill'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE ROLE quill LOGIN SUPERUSER PASSWORD 'quill'"
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='quillnext'" | grep -q 1 \
    || sudo -u postgres createdb -O quill quillnext
}

# Write a local .env for dev if one does not already exist. Keeps a stable AUTH_SECRET
# across boots by only generating it once. `.env` is gitignored (never committed).
ca_write_env() {
  if [ -f "$REPO_ROOT/.env" ]; then
    return 0
  fi
  ca_use_node24
  local secret
  secret="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
  cat > "$REPO_ROOT/.env" <<EOF
# Auto-generated for the Cursor Cloud Agent dev environment. Local values only.
# Local Postgres has SSL on (snakeoil cert); the pg adapter connects with
# rejectUnauthorized:false. The role is superuser so migrations can create the
# vector extension + RLS trigger. RLS is disabled for local dev.
DATABASE_URL="postgresql://quill:quill@localhost:5432/quillnext"
DIRECT_DATABASE_URL="postgresql://quill:quill@localhost:5432/quillnext"
RLS_ENABLED="false"

AUTH_SECRET="${secret}"
NEXTAUTH_SECRET="${secret}"
# Placeholder OAuth creds so the app boots; real Google sign-in needs real values.
GOOGLE_CLIENT_ID="local-dev-google-client-id"
GOOGLE_CLIENT_SECRET="local-dev-google-client-secret"

# Optional integrations — blank for local dev (features degrade gracefully).
GOOGLE_GENERATIVE_AI_API_KEY=""
GEMINI_API_KEY=""
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
FIREBASE_STORAGE_BUCKET=""
RESEND_API_KEY=""
EOF
  echo "[cloud-agent] wrote $REPO_ROOT/.env"
}
