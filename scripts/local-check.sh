#!/usr/bin/env bash
# The gate. One line per step (ok|FAIL name seconds), counts at the end, test-results/check.json, exit 1 on any failure.
#   bash scripts/local-check.sh --fast        gen check + ids check + tsc + vitest on files changed vs the base branch   (no lock, seconds)
#   bash scripts/local-check.sh               + full vitest + build to .cache/dist-check                                   (heavy lock)
#   bash scripts/local-check.sh --perf        ... + the serial perf project
#   bash scripts/local-check.sh --e2e[=a,b]   ... + e2e-all (optionally --only=a,b)
#   bash scripts/local-check.sh --ci          everything (full + perf + e2e), never prompts: what the coordinator runs and pastes
# Base for --fast: $HW_BASE or ccr-3c8b169f-e78nk2.
cd "$(dirname "$0")/.."
mode=full; perf=0; e2e=0; only=""
for a in "$@"; do case "$a" in
  --fast) mode=fast ;; --perf) perf=1 ;; --e2e) e2e=1 ;; --e2e=*) e2e=1; only="${a#--e2e=}" ;;
  --ci) perf=1; e2e=1 ;; esac; done
if [ "$mode" != fast ] && [ -z "$HW_LOCK_HELD" ]; then exec node scripts/with-lock.mjs local-check -- bash "$0" "$@"; fi
mkdir -p test-results
log() { echo "test-results/check-$1.log"; }
steps=""; fail=0
run() {
  local name="$1"; shift; local t0=$SECONDS
  if "$@" >"$(log "$name")" 2>&1; then s=ok; else s=FAIL; fail=1; fi
  local dt=$((SECONDS - t0))
  echo "$(printf '%-5s' $s) $name ${dt}s$([ $s = FAIL ] && echo "  (see $(log "$name"))")"
  steps="$steps{\"step\":\"$name\",\"ok\":$([ $s = ok ] && echo true || echo false),\"seconds\":$dt},"
}
run gen node scripts/gen-indexes.mjs --check
node scripts/gen-indexes.mjs >/dev/null 2>&1
run ids node scripts/ids-sync.mjs --check
run typecheck npx tsc --noEmit
if [ "$mode" = fast ]; then
  base="${HW_BASE:-ccr-3c8b169f-e78nk2}"
  run tests-related npx vitest run --changed "$base" --passWithNoTests
else
  run tests npx vitest run --reporter=default --reporter=json --outputFile=test-results/vitest.json
  run build node scripts/build.mjs --out=.cache/dist-check
  [ "$perf" = 1 ] && run perf npm run test:perf
  if [ "$e2e" = 1 ]; then
    if [ -n "$only" ]; then run e2e node scripts/e2e-all.mjs --only="$only"; else run e2e node scripts/e2e-all.mjs; fi
  fi
fi
counts=""
if [ -f test-results/vitest.json ] && [ "$mode" != fast ]; then
  counts=$(node -e 'const r=require("./test-results/vitest.json");console.log(`files ${r.numTotalTestSuites>0?r.testResults.length:0}, tests ${r.numTotalTests}, passed ${r.numPassedTests}, failed ${r.numFailedTests}, skipped ${r.numPendingTests}`)' 2>/dev/null)
  echo "      $counts"
fi
commit=$(git rev-parse --short HEAD 2>/dev/null); lane="${HW_LANE:-main}"
echo "{\"commit\":\"$commit\",\"lane\":\"$lane\",\"mode\":\"$mode\",\"ok\":$([ $fail = 0 ] && echo true || echo false),\"counts\":\"$counts\",\"steps\":[${steps%,}]}" > test-results/check.json
[ $fail = 0 ] && echo "ALL OK ($commit, lane $lane)" || echo "FAILED ($commit, lane $lane)"
exit $fail
