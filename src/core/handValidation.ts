/**
 * Content checks for the Ember handwork (docs/api/handwork-content.md): hand station blocks and their recipes, the moulds
 * and the cast metals. validateContent in the registry calls this with its resolved tables (passed in, so this file
 * needs no import of the registry).
 */
import type { BlockDef, CastMetalSpec, ItemDef, MachineSpec, MouldSpec, RecipeDef } from './types';

export interface HandTables {
  blocks: readonly BlockDef[];
  recipes: readonly RecipeDef[];
  moulds: readonly MouldSpec[];
  metals: readonly CastMetalSpec[];
  item: (key: string) => ItemDef | null;
  machine: (kind: string) => MachineSpec | null;
}

/** Recipe stations that are hand stations: the key of a block whose machine has role 'hand' (or that has a handStation). */
export function handStationKeys(blocks: readonly BlockDef[], machine: (kind: string) => MachineSpec | null): Set<string> {
  const keys = new Set<string>();
  for (const b of blocks) if (b.handStation || (b.machine !== null && machine(b.machine)?.role === 'hand')) keys.add(b.key);
  return keys;
}

export function validateHand(t: HandTables): string[] {
  const problems: string[] = [];
  const stations = handStationKeys(t.blocks, t.machine);
  for (const b of t.blocks) {
    const hs = b.handStation;
    if (!hs) continue;
    const at = `block ${b.key}`;
    if (b.machine === null || t.machine(b.machine)?.role !== 'hand') problems.push(`${at}: a hand station needs a machine of role 'hand'`);
    if (!(hs.strokesPerS > 0)) problems.push(`${at}: handStation.strokesPerS must be > 0`);
  }
  for (const r of t.recipes) {
    const at = `recipe ${r.id}`;
    const hand = stations.has(r.station);
    if (!hand) {
      if (r.strokes !== undefined || r.toolOutput || r.bonus) problems.push(`${at}: strokes, toolOutput and bonus only belong to hand station recipes`);
      continue;
    }
    const stroked = r.strokes !== undefined;
    const timed = r.timeS > 0;
    if (stroked === timed) problems.push(`${at}: a hand station recipe has exactly one of strokes and timeS`);
    if (stroked && (!Number.isInteger(r.strokes) || (r.strokes ?? 0) < 1)) problems.push(`${at}: strokes must be a whole number >= 1`);
    if (stroked && !t.blocks.find((b) => b.key === r.station)?.handStation) problems.push(`${at}: strokes at "${r.station}", which has no handStation`);
    if (r.toolOutput && !t.item(r.toolOutput.item)) problems.push(`${at}: toolOutput "${r.toolOutput.item}" is not an item`);
    if (r.bonus) {
      if (!t.item(r.bonus.item)) problems.push(`${at}: bonus "${r.bonus.item}" is not an item`);
      if (!(r.bonus.chance > 0 && r.bonus.chance <= 1)) problems.push(`${at}: bonus chance must be in (0, 1]`);
    }
  }
  const metalKeys = new Set(t.metals.map((m) => m.key));
  for (const m of t.metals) {
    for (const k of [m.ingot, m.bloom]) if (!t.item(k)) problems.push(`cast metal ${m.key}: "${k}" is not an item`);
  }
  for (const m of t.moulds) {
    const at = `mould ${m.item}`;
    if (!t.item(m.item)?.mould) problems.push(`${at}: the item has no mould spec`);
    if (!t.item(m.unfired)) problems.push(`${at}: unfired "${m.unfired}" is not an item`);
    if (!Number.isInteger(m.units) || m.units < 1) problems.push(`${at}: units must be a whole number >= 1`);
    if (Object.keys(m.casts).length === 0) problems.push(`${at}: casts nothing`);
    for (const [metal, out] of Object.entries(m.casts)) {
      if (!metalKeys.has(metal)) problems.push(`${at}: unknown metal "${metal}"`);
      if (!t.item(out)) problems.push(`${at}: cast item "${out}" is not an item`);
    }
  }
  return problems;
}
