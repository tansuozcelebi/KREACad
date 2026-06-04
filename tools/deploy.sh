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
#   SSH_PASSPHRASE    Passphrase protecting SSH_PRIVATE_KEY. When set, the key is
#                     loaded into a throwaway ssh-agent so rsync can authenticate
#                     non-interactively.
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
cleanup() {
  [ -n "${SSH_AGENT_PID:-}" ] && ssh-agent -k >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# Best-effort: pre-fetch and pin the host key so strict checking can be used.
# If ssh-keyscan can't reach the host (filtered/flaky), don't hard-fail here —
# fall back to trust-on-first-use during the real connection, and surface a
# clear reachability diagnostic so misconfigured host/port issues are obvious.
if ssh-keyscan -T 10 -p "$SSH_PORT" -H "$SSH_HOST" > "$KNOWN_HOSTS" 2>/dev/null && [ -s "$KNOWN_HOSTS" ]; then
  SSH_OPTS=(-p "$SSH_PORT" -o "UserKnownHostsFile=$KNOWN_HOSTS" -o "StrictHostKeyChecking=yes")
else
  echo "WARN: could not pre-fetch host key for $SSH_HOST:$SSH_PORT — using accept-new (trust on first use)." >&2
  if command -v nc >/dev/null 2>&1 && ! nc -z -w 5 "$SSH_HOST" "$SSH_PORT" 2>/dev/null; then
    echo "WARN: TCP connect to $SSH_HOST:$SSH_PORT failed. Check that SSH_HOST/SSH_PORT are correct" >&2
    echo "      and that the SSH endpoint is reachable (e.g. not behind a proxy/CDN, firewall open)." >&2
  fi
  SSH_OPTS=(-p "$SSH_PORT" -o "UserKnownHostsFile=$KNOWN_HOSTS" -o "StrictHostKeyChecking=accept-new")
fi

# Use an explicit key file when the private key is provided (CI); otherwise the
# user's ssh-agent / default keys are used.
if [ -n "${SSH_PRIVATE_KEY:-}" ]; then
  printf '%s\n' "$SSH_PRIVATE_KEY" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"

  if [ -n "${SSH_PASSPHRASE:-}" ]; then
    # Passphrase-protected key: load it into a throwaway ssh-agent so rsync can
    # authenticate without a TTY. A tiny SSH_ASKPASS helper feeds the passphrase.
    eval "$(ssh-agent -s)" >/dev/null
    ASKPASS="$TMP_DIR/askpass.sh"
    printf '#!/bin/sh\nprintf "%%s\\n" "$SSH_PASSPHRASE"\n' > "$ASKPASS"
    chmod 700 "$ASKPASS"
    if ! SSH_ASKPASS="$ASKPASS" SSH_ASKPASS_REQUIRE=force DISPLAY=":0" \
         ssh-add "$KEY_FILE" </dev/null >/dev/null 2>&1; then
      echo "ERROR: failed to load the SSH key — is SSH_PASSPHRASE correct?" >&2
      exit 1
    fi
    # Authenticate via the agent (it holds only this freshly-loaded key).
  else
    SSH_OPTS+=(-i "$KEY_FILE" -o "IdentitiesOnly=yes")
  fi
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
