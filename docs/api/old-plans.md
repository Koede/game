# Old plans

Drawings of the people of the Old Works, found in ruin crates. `src/content/oldPlans.ts` (data), `src/game/oldPlans.ts` (rules).

- Four plans (`plan_kiln_house`, `plan_cistern` near; `plan_foundry_hall`, `plan_lookout` deep). Each is a layered ASCII layout over
  item-backed blocks; `planBlueprint(spec)` turns it into a `Blueprint` (src/game/blueprint.ts), so builders can raise it.
- Crates: `ruinCrateSlots` (surface and buried ruins) and `structureCrateEntity` for `PLAN_STRUCTURES` (old_home, chem_lab, lumber_mill
  near; old_factory deep) add a plan to the first empty slot with chance `PLAN_CHANCE` (near 0.3, deep 0.5). It uses its own hash, so
  the ordinary loot roll is untouched. Crates are rolled only when a chunk is first generated, so old saves are not changed.
- `OldPlans` (state.oldPlans, saved as extra `oldPlans`): `use(held)` reads and consumes a plan (a known one is kept, with a toast);
  `list()`, `has(id)`, `blueprints()`, `blueprintOf(id)` and `learn(id)` are the hooks for the blueprint screen.
- Wired: known plans join the blueprint book (`GameState.syncOldPlans`, `grantKnownPlans`) and show in the blueprint panel.
