/**
 * Glue ratchet: every item, block and recipe must be wired into the game. The audit (glueAudit.ts) finds things that
 * nothing makes, nothing uses, or the player cannot read about. New content that trips it must be hooked up (a recipe,
 * a drop, a use) or, when it is deliberate, named in an allowlist below WITH its reason. Run
 * `GLUE_OUT=/tmp/glue.json npx vitest run src/content/glueAudit.test.ts` to dump the full report, including the soft
 * "only code mentions it" lists a human should skim.
 */
// @ts-expect-error the game's tsconfig carries no node types; vitest runs on node
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { auditGlue, type GlueFindings } from './glueAudit';
import { SPEC } from './specRoster';

declare const process: { env: Record<string, string | undefined> };
const f: GlueFindings = auditGlue();
if (process.env.GLUE_OUT) writeFileSync(process.env.GLUE_OUT, JSON.stringify(f, null, 1));

/** Block keys that are not obtainable on purpose, with the reason. */
const BLOCKS_WORLD_ONLY: Record<string, string> = {
  // Crop growth stages are placed by the farm sim, never by hand.
  carrot_1: 'crop stage', carrot_2: 'crop stage', carrot_3: 'crop stage',
  potato_1: 'crop stage', potato_2: 'crop stage', potato_3: 'crop stage',
  wheat_1: 'crop stage', wheat_2: 'crop stage', wheat_3: 'crop stage',
  // Distillery apparatus swap to a "done" look when a batch finishes (render state).
  filter_bed_done: 'machine state', reaction_vessel_done: 'machine state', receiver_done: 'machine state', separatory_funnel_done: 'machine state',
};

describe('glue audit: nothing orphaned', () => {
  it('every item can be obtained (recipe, drop, loot, reward, shop or code)', () => {
    expect(f.itemsNoSource.filter((k) => !SPEC.worldOnlyItems.includes(k))).toEqual([]);
  });

  it('every item has a use (ingredient, tool, food, fuel, placeable or code)', () => {
    expect(f.itemsNoUse).toEqual([]);
  });

  it('every item and block has a tooltip', () => {
    expect(f.itemsNoTooltip).toEqual([]);
    expect(f.blocksNoTooltip).toEqual([]);
  });

  it('every block can be obtained or is world-only on purpose', () => {
    expect(f.blocksNoSource.filter((k) => !(k in BLOCKS_WORLD_ONLY))).toEqual([]);
    // The allowlist may only shrink: a key that became obtainable must leave it.
    for (const k of Object.keys(BLOCKS_WORLD_ONLY)) expect(f.blocksNoSource, `${k} is obtainable now, drop it from the allowlist`).toContain(k);
  });

  it('every block does something', () => {
    expect(f.blocksNoUse).toEqual([]);
  });

  it('every recipe makes something that is used, from obtainable inputs, at a station that can be had', () => {
    expect(f.recipesDeadOutput).toEqual([]);
    expect(f.recipesUnobtainableInput).toEqual([]);
    expect(f.recipesNoStation).toEqual([]);
  });

  it('no two recipes at one station are the same row', () => {
    expect(f.recipesDuplicate).toEqual([]);
  });
});
