/**
 * Test fixture for the glass distillery: builds a rig from a process card's `rig` string (src/content/recipesDistill.ts)
 * on a fake world, with a furnace under every still base. Import by path from tests only.
 */
import { expand, pour, total } from '../core/chem';
import { CHEM_CAPACITY_L, CHEM_CONTAINERS } from '../core/distill';
import { DT } from '../core/constants';
import { RIG_LEGEND, type ProcessCard } from '../content/recipesDistill';
import type { ChemEntity } from './distill';
import type { FurnaceEntity } from './entities';
import { makeKit, type Kit } from './testKit';

export interface BuiltRig {
  kit: Kit;
  /** Module entity at each cell, by legend letter in reading order (bottom layer first). */
  cells: Array<{ ch: string; x: number; y: number; z: number }>;
  furnaces: FurnaceEntity[];
  /** First module of a letter. */
  first(ch: string): ChemEntity;
  /** Every module of a letter. */
  every(ch: string): ChemEntity[];
}

/** Builds `rig` (top layer first, '/' between layers) with its bottom layer at y0. */
export function buildRig(rig: string, y0 = 2, kit: Kit = makeKit()): BuiltRig {
  const layers = rig.split('/').reverse();
  const cells: BuiltRig['cells'] = [];
  const furnaces: FurnaceEntity[] = [];
  layers.forEach((row, dy) => {
    [...row].forEach((ch, x) => {
      const key = RIG_LEGEND[ch];
      if (!key) return;
      const y = y0 + dy;
      if (ch === 'B') furnaces.push(kit.furnace(x, y - 1, 0));
      kit.world.put(x, y, 0, key);
      cells.push({ ch, x, y, z: 0 });
    });
  });
  const ent = (c: { x: number; y: number; z: number }): ChemEntity => {
    const e = kit.sim.distill.entityAt(c.x, c.y, c.z);
    if (!e) throw new Error(`no module at ${c.x},${c.y},${c.z}`);
    return e;
  };
  return {
    kit, cells, furnaces,
    first: (ch) => ent(cells.find((c) => c.ch === ch)!),
    every: (ch) => cells.filter((c) => c.ch === ch).map(ent),
  };
}

/** Pours the liquid inputs of a card (its full containers) into `into`, scaled to fit; returns the scale used. */
export function feed(card: ProcessCard, into: ChemEntity): number {
  const liquids = card.inputs.filter((i) => CHEM_CONTAINERS[i.item]);
  const litres = liquids.reduce((n, i) => n + i.count * CHEM_CONTAINERS[i.item].litres, 0);
  const k = Math.min(1, CHEM_CAPACITY_L[into.kind] / litres);
  for (const i of liquids) {
    const c = CHEM_CONTAINERS[i.item];
    const l = i.count * c.litres * k;
    pour(expand(c.fluid, l), into.mix, l);
  }
  return k;
}

/** Runs the rig with every furnace held at `tempC` until `done()` or `maxS` seconds; returns seconds run. */
export function runUntil(r: BuiltRig, tempC: number, done: () => boolean, maxS = 900): number {
  let t = 0;
  while (t < maxS && !done()) {
    for (const f of r.furnaces) f.tempC = tempC;
    r.kit.sim.tick(DT);
    t += DT;
  }
  return t;
}

export const litresOf = (e: ChemEntity): number => total(e.mix);
