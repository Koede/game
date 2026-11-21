#!/usr/bin/env bash
# One-time setup of a LOCAL checkout so a Claude Code session on your own machine can continue the build.
#   bash scripts/local-setup.sh
# Needs: git, Node 22+, npm. Installs dependencies and Playwright's Chromium, then runs the fast checks.
set -euo pipefail

BRANCH="ccr-3c8b169f-e78nk2"
cd "$(dirname "$0")/.."

node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' \
  || { echo "Node 22 or newer is required (found $(node -v))."; exit 1; }

git fetch origin "$BRANCH" >/dev/null 2>&1 || true
current="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current" != "$BRANCH" ]; then
  echo "Switching to $BRANCH (you are on $current)"
  git checkout "$BRANCH"
fi
git pull --no-rebase --no-edit origin "$BRANCH" || true

echo "== npm install"
npm install
echo "== Playwright + Chromium (needed only for npm run e2e / scripts/codex preview)"
npm install --no-save playwright
npx playwright install chromium

echo "== typecheck"
npm run typecheck
echo "== unit tests"
npm test
echo "== build"
npm run build

cat <<MSG

Setup complete. Next:
  1. Open Claude Code in this folder.
  2. Paste the 'First message' block from docs/LOCAL_HANDOFF.md.
Run the browser tests when you want them:  npm run e2e   (about 5-15 minutes)
MSG
