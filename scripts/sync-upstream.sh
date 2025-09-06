#!/usr/bin/env bash
set -euo pipefail

echo "[sync] Start syncing from upstream to local dev/main and push to origin"

# Ensure git in repo root
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

# Check clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[sync] Working tree or index has changes. Please commit or stash first." >&2
  exit 1
fi

# Ensure upstream exists
if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "[sync] Remote 'upstream' not found. Please add it, e.g.:" >&2
  echo "       git remote add upstream git@github.com:Wei-Shaw/claude-relay-service.git" >&2
  exit 1
fi

echo "[sync] Fetching remotes (upstream, origin)"
git fetch --prune upstream
git fetch --prune origin || true

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Sync dev if upstream/dev exists
if git show-ref --verify --quiet refs/remotes/upstream/dev; then
  echo "[sync] Syncing dev with upstream/dev"
  git checkout dev
  git merge --no-ff upstream/dev -m "merge: sync dev with upstream/dev" || true
  echo "[sync] Pushing dev to origin"
  git push origin dev
else
  echo "[sync] upstream/dev not found. Skipping dev."
fi

# Sync main
echo "[sync] Syncing main with upstream/main"
git checkout main
git merge --no-ff upstream/main -m "merge: sync main with upstream/main" || true
echo "[sync] Pushing main to origin"
git push origin main

# Return to previous branch
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "dev" ]]; then
  git checkout "$CURRENT_BRANCH" || true
fi

echo "[sync] Done."

