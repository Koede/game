# Hearthwatt Codex generator

Regenerates the Codex page (crafting map, blocks, progression tree, item map) from the live game registry.

    npm run codex                                   # = node scripts/codex/build.mjs  -> dist-codex/
    node scripts/codex/preview.mjs <outDir>         # screenshots every tab at 1280x800 and 390x844, reports console errors and horizontal overflow

Outputs in `dist-codex/` (git-ignored): `codex.html` (artifact body, no doctype/html/body),
`codex-data.json` (fetched by the page), `index.html` (wrapper for local preview; serve the folder, e.g. with `scripts/lib/browser.mjs`).

Files:
- `extract.mjs` reads items, recipes, blocks, furnace tiers, ages and texture PNGs (16x16 data URIs) from `src/core/registry` and
  computes `cx` per item (crafting depth in steps, raw-material cost, station, tier, temperature) from the shallowest recipe.
  A texture that cannot be painted falls back to a magenta `missing` tile; the build prints which.
- `page.html` is the page template (CSS, markup, script). Edit it for layout changes.
- `progression.json` is the progression tree: six ages, each with branches of item keys. A name that is a registry item key becomes an
  icon chip; anything else renders as a "planned" tag. Set `"planned": true` on a branch (or age) to label it. When a planned item is
  built, put its key in the list; no code change is needed.
- `build.mjs` runs the extraction and writes `dist-codex/`. `preview.mjs` is the Playwright check.

To publish as an Artifact, upload `dist-codex/codex.html` with `dist-codex/codex-data.json` as a supporting file.
