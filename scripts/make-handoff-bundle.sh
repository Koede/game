#!/usr/bin/env bash
# Builds ONE markdown file with everything a new session needs: handoff, status, progression, every plan, the spec.
#   bash scripts/make-handoff-bundle.sh [out.md]      (default: docs/HEARTHWATT_COMPLETE_HANDOFF.md)
cd "$(dirname "$0")/.."
out="${1:-docs/HEARTHWATT_COMPLETE_HANDOFF.md}"
files=(docs/SESSION_CONTEXT.md docs/WHATS_LEFT.md docs/LOCAL_HANDOFF.md HANDOFF.md docs/PROGRESSION.md docs/EMBER_PLAN.md docs/BREWING_PLAN.md docs/STEAM_PLAN.md docs/BRONZE_PLAN.md docs/DISTILLERY_PLAN.md docs/api/sugar.md docs/api/dev-mode.md docs/api/distillery.md docs/api/ground-items.md docs/api/chainsaw.md docs/api/handwork-front.md docs/SPEC.md README.md)
{
  echo "# Hearthwatt - complete handoff bundle"
  echo
  echo "One file with everything needed to continue the game in a fresh session. Generated $(date -u +%Y-%m-%dT%H:%MZ) from commit $(git rev-parse --short HEAD) on branch $(git rev-parse --abbrev-ref HEAD) of https://github.com/Koede/game."
  echo "Order: 0 session context (state, open decisions, follow-ups) - 1 how to start locally (setup, phases, first message) - 2 current status - 3 whole-game progression - 4 Ember plan - 5 Brewing plan - 6 Steam plan - 7 Bronze plan - 8 Distillery plan and the API notes of the newest features - 9 full design spec and build rules - 10 README."
  echo "The other per-module API notes live in the repository under docs/api/*.md and are NOT included here (read them as you reach each module)."
  echo
  echo "## Contents"
  i=1; for f in "${files[@]}"; do echo "$i. \`$f\`"; i=$((i+1)); done
  for f in "${files[@]}"; do
    echo; echo; echo "---"; echo
    echo "<!-- ======================= BEGIN $f ======================= -->"
    echo "# FILE: $f"; echo
    cat "$f"
    echo; echo "<!-- ======================== END $f ======================== -->"
  done
} > "$out"
wc -lc "$out"
