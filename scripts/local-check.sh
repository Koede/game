#!/usr/bin/env bash
# The gate every phase must pass before the next one starts. Prints one summary line per check; exit 1 on any failure.
#   bash scripts/local-check.sh            typecheck + unit tests + build
#   bash scripts/local-check.sh --e2e      ... plus the full end-to-end suite
cd "$(dirname "$0")/.."
fail=0
run() { local name="$1"; shift; if "$@" >"/tmp/hw-check-$name.log" 2>&1; then echo "ok    $name"; else echo "FAIL  $name (see /tmp/hw-check-$name.log)"; fail=1; fi; }
run typecheck npm run typecheck
run tests npm test
run build npm run build
if [ "${1:-}" = "--e2e" ]; then run e2e npm run e2e; fi
tail -n 3 /tmp/hw-check-tests.log 2>/dev/null | sed 's/^/      /'
exit $fail
