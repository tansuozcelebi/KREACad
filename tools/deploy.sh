#!/usr/bin/env bash
#
# Static SSH deploy for KreaCAD.
# Uploads the built static site (dist/) to the web server over SSH using rsync.
#
# Required environment variables:
#   SSH_HOST       Server hostname or IP           (e.g. kreacad.fabus.app)
#   SSH_USERNAME   SSH user                         (e.g. u1234-myaccount)
#   DEPLOY_PATH    Absolute web root on the server  (e.g. /home/customer/www/kreacad.fabus.app/public_html)
#
# Optional environment variables:
#   SSH_PORT          SSH port (default: 22; SiteGround commonly uses 18765)
#   SSH_PRIVATE_KEY   Private key contents. When set it is written to a temp file
#                     and used for auth (CI). When unset, your local ssh-agent /
#                     ~/.ssh keys are used instead (handy for manual runs).
#   DIST_DIR          Local directory to upload (default: dist)
#   DEPLOY_DELETE     "true" (default) removes remote files no longer present locally.
#   DRY_RUN           "true" performs a trial run printing changes without making them.
#
# Usage:
#   npm run build_engine && npm run create_dist   # produce dist/
#   SSH_HOST=... SSH_USERNAME=... DEPLOY_PATH=... ./tools/deploy.sh
set -euo pipefail

DIST_DIR="${DIST_DIR:-dist}"
SSH_PORT="${SSH_PORT:-22}"
DEPLOY_DELETE="${DEPLOY_DELETE:-true}"
DRY_RUN="${DRY_RUN:-false}"

require() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "ERROR: required environment variable '$name' is not set." >&2
    exit 1
  fi
}

require SSH_HOST
require SSH_USERNAME
require DEPLOY_PATH

if [ ! -d "$DIST_DIR" ]; then
  echo "ERROR: '$DIST_DIR' does not exist. Build it first: npm run build_engine && npm run create_dist" >&2
  exit 1
fi

# Isolated, always-cleaned-up SSH setup so we never touch ~/.ssh.
TMP_DIR="$(mktemp -d)"
KEY_FILE="$TMP_DIR/deploy_key"
KNOWN_HOSTS="$TMP_DIR/known_hosts"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# Pin the host key with ssh-keyscan so strict checking passes without an
# interactive prompt (instead of disabling host-key verification entirely).
if ! ssh-keyscan -p "$SSH_PORT" -H "$SSH_HOST" > "$KNOWN_HOSTS" 2>/dev/null || [ ! -s "$KNOWN_HOSTS" ]; then
  echo "ERROR: could not fetch host key for $SSH_HOST:$SSH_PORT" >&2
  exit 1
fi

SSH_OPTS=(-p "$SSH_PORT" -o "UserKnownHostsFile=$KNOWN_HOSTS" -o "StrictHostKeyChecking=yes")

# Use an explicit key file when the private key is provided (CI); otherwise the
# user's ssh-agent / default keys are used.
if [ -n "${SSH_PRIVATE_KEY:-}" ]; then
  printf '%s\n' "$SSH_PRIVATE_KEY" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_OPTS+=(-i "$KEY_FILE" -o "IdentitiesOnly=yes")
fi

# -rlptz: recursive, symlinks, permissions, times, compress.
# (Intentionally not -a: owner/group/device preservation tends to fail on shared hosting.)
RSYNC_ARGS=(-rlptz --human-readable)
[ "$DEPLOY_DELETE" = "true" ] && RSYNC_ARGS+=(--delete-after)
[ "$DRY_RUN" = "true" ] && RSYNC_ARGS+=(--dry-run --verbose)

echo "Deploying $DIST_DIR/ -> $SSH_USERNAME@$SSH_HOST:$DEPLOY_PATH (port $SSH_PORT, delete=$DEPLOY_DELETE, dry_run=$DRY_RUN)"

# Trailing slash on the source copies the *contents* of dist/ into DEPLOY_PATH.
rsync "${RSYNC_ARGS[@]}" -e "ssh ${SSH_OPTS[*]}" "$DIST_DIR/" "$SSH_USERNAME@$SSH_HOST:$DEPLOY_PATH/"

echo "Deploy complete."
