#!/usr/bin/env bash
#
# everfly deployment helper.
#
# This script always deploys from the *production* checkout, never from your
# development tree. Run it from anywhere; it does not care where it lives.
#
# Usage:
#   ./deploy.sh v1.2.0       # deploy a specific tag (this is the normal path)
#   ./deploy.sh              # deploy the tip of the production checkout's branch
#   ./deploy.sh --rollback   # redeploy the previously deployed ref
#
# Configuration. Every setting has a sensible default, can be overridden by an
# environment variable, and — most conveniently — can be set once in a local
# `deploy.env` file that is not tracked by Git. See deploy.env.example.
#
#   EVERFLY_SRC_DIR          production checkout        (default: /opt/everfly)
#   EVERFLY_COMPOSE_FILE     compose file to drive      (default: $EVERFLY_SRC_DIR/docker-compose.yml)
#   EVERFLY_COMPOSE_PROJECT  compose project name       (default: everfly)
#   EVERFLY_CONTAINER        container name             (default: everfly-app)
#   EVERFLY_HEALTH_URL       health endpoint            (default: http://127.0.0.1:5000/api/health)
#   EVERFLY_HEALTH_TIMEOUT   seconds to wait for health (default: 120)
#
# deploy.env is searched for in this order, first hit wins:
#   1. $EVERFLY_DEPLOY_ENV
#   2. deploy.env next to this script
#   3. /etc/everfly/deploy.env
#
# Real environment variables always win over deploy.env, so a one-off override
# still works: EVERFLY_HEALTH_TIMEOUT=300 ./deploy.sh v1.2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load host-specific settings. Anything already exported on the command line is
# saved first and restored afterwards, so a one-off override beats the file.
_PRESET="$(declare -p EVERFLY_SRC_DIR EVERFLY_COMPOSE_FILE EVERFLY_COMPOSE_PROJECT \
                      EVERFLY_CONTAINER EVERFLY_HEALTH_URL EVERFLY_HEALTH_TIMEOUT \
           2>/dev/null || true)"

for candidate in "${EVERFLY_DEPLOY_ENV:-}" "$SCRIPT_DIR/deploy.env" /etc/everfly/deploy.env; do
  [ -n "$candidate" ] && [ -f "$candidate" ] || continue
  # shellcheck disable=SC1090
  set -a; . "$candidate"; set +a
  DEPLOY_ENV_FILE="$candidate"
  break
done

[ -n "$_PRESET" ] && eval "$_PRESET"

SRC_DIR="${EVERFLY_SRC_DIR:-/opt/everfly}"
COMPOSE_FILE="${EVERFLY_COMPOSE_FILE:-$SRC_DIR/docker-compose.yml}"
COMPOSE_PROJECT="${EVERFLY_COMPOSE_PROJECT:-everfly}"
CONTAINER="${EVERFLY_CONTAINER:-everfly-app}"
HEALTH_URL="${EVERFLY_HEALTH_URL:-http://127.0.0.1:5000/api/health}"
HEALTH_TIMEOUT="${EVERFLY_HEALTH_TIMEOUT:-120}"
STATE_FILE="$SRC_DIR/.deploy-last-ref"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m warn:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

compose() {
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" "$@"
}

# Docker usually needs root, but git needs the checkout owner's SSH keys and
# identity. When invoked as root, drop back to the owner for every git call.
SRC_OWNER="$(stat -c '%U' "$SRC_DIR")"
if [ "$(id -u)" = "0" ] && [ "$SRC_OWNER" != "root" ]; then
  git() { sudo -u "$SRC_OWNER" -H git "$@"; }
else
  git() { command git "$@"; }
fi

[ -f "$COMPOSE_FILE" ] || die "compose file not found: $COMPOSE_FILE"
command -v docker >/dev/null || die "docker not found in PATH"

TARGET="${1:-}"
if [ "$TARGET" = "--rollback" ]; then
  [ -f "$STATE_FILE" ] || die "no previous deploy recorded in $STATE_FILE"
  TARGET="$(cat "$STATE_FILE")"
  log "rolling back to $TARGET"
fi

# --- 1. Refuse to deploy on top of uncommitted work ---------------------------
if [ -n "$(git -C "$SRC_DIR" status --porcelain)" ]; then
  die "working tree at $SRC_DIR is dirty. Commit or stash before deploying."
fi

PREVIOUS_REF="$(git -C "$SRC_DIR" rev-parse HEAD)"

# --- 2. Fetch and check out the requested ref --------------------------------
log "fetching from origin"
# --force so a moved tag (e.g. after a history rewrite) is picked up instead of
# silently keeping the stale local one.
git -C "$SRC_DIR" fetch --tags --force --prune origin

if [ -n "$TARGET" ]; then
  git -C "$SRC_DIR" rev-parse --verify "$TARGET^{commit}" >/dev/null 2>&1 \
    || die "ref not found: $TARGET"
  log "checking out $TARGET"
  git -C "$SRC_DIR" checkout --quiet --detach "$TARGET"
else
  BRANCH="$(git -C "$SRC_DIR" rev-parse --abbrev-ref HEAD)"
  if [ "$BRANCH" = "HEAD" ]; then
    # Normal state for the production checkout: pinned to a tag. Nothing to
    # fast-forward, so just rebuild whatever is already checked out.
    log "detached at $(git -C "$SRC_DIR" describe --tags --always); rebuilding current ref"
  else
    log "fast-forwarding $BRANCH"
    git -C "$SRC_DIR" pull --ff-only origin "$BRANCH"
  fi
fi

NEW_REF="$(git -C "$SRC_DIR" rev-parse HEAD)"
log "deploying $(git -C "$SRC_DIR" describe --tags --always) ($(echo "$NEW_REF" | cut -c1-8))"

if [ "$NEW_REF" = "$PREVIOUS_REF" ]; then
  warn "already at this revision; rebuilding anyway"
fi

# --- 3. Build and start ------------------------------------------------------
log "building image"
compose build

log "starting container"
compose up -d

# --- 4. Wait for health ------------------------------------------------------
log "waiting for health (timeout ${HEALTH_TIMEOUT}s)"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
healthy=0
while [ "$(date +%s)" -lt "$deadline" ]; do
  state="$(docker inspect "$CONTAINER" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || echo missing)"
  case "$state" in
    healthy) healthy=1; break ;;
    none)
      # No healthcheck defined; fall back to probing the endpoint directly.
      if curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL" 2>/dev/null; then healthy=1; break; fi
      ;;
    unhealthy) break ;;
  esac
  sleep 3
done

if [ "$healthy" != "1" ]; then
  warn "container did not become healthy"
  docker logs "$CONTAINER" --tail 40 2>&1 || true
  echo
  die "deploy failed. Roll back with: $0 $PREVIOUS_REF"
fi

echo "$PREVIOUS_REF" > "$STATE_FILE"
log "deploy OK — $(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || echo 'healthy')"
