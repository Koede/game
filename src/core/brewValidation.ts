/**
 * Content checks for brewing (BREWING_PLAN 2, 11): drinks, ingredients, containers, the cup stage table and the
 * brewing machines. validateContent in the registry calls this with its resolved tables (passed in, so this file needs
 * no import of the registry).
 */
import { CONTAINER_BLOCKS, CUP_BLOCK, CUP_PARTS, CUP_STAGES, BREW_CUP_MACHINE, BOIL_BUCKET_MACHINE, KETTLE_BLOCK, KETTLE_MACHINE } from './brewing';
import type { BlockDef, ItemDef, MachineSpec } from './types';

export interface BrewTables {
  items: readonly ItemDef[];
  knownItem: (key: string) => boolean;
  block: (key: string) => BlockDef | null;
  machine: (kind: string) => MachineSpec | null;
}

const DRINK_BUFFS = new Set(['spring', 'hearthkept', 'mending', 'swift', 'vigor', 'lasting']);

export function validateBrewing(t: BrewTables): string[] {
  const problems: string[] = [];
  const item = (key: string): ItemDef | undefined => t.items.find((it) => it.key === key);
  for (const it of t.items) {
    const at = `item ${it.key}`;
    const d = it.drink;
    if (d) {
      if (!DRINK_BUFFS.has(d.buff)) problems.push(`${at}: unknown drink buff "${d.buff}"`);
      if (!(d.buffS > 0)) problems.push(`${at}: drink buffS must be > 0`);
      if (!Number.isInteger(d.colour) || d.colour < 0 || d.colour > 0xffffff) problems.push(`${at}: drink colour is not 0xRRGGBB`);
      if (it.stack !== 1) problems.push(`${at}: a cup of a drink must stack to 1`);
      if (it.food) problems.push(`${at}: a drink is not food (use drink.hunger)`);
    }
    if (it.brews !== undefined) {
      const drink = item(it.brews);
      if (!drink?.drink) problems.push(`${at}: brews "${it.brews}", which is not a drink item`);
    }
    const c = it.container;
    if (c) {
      if (!t.knownItem(c.boilsTo)) problems.push(`${at}: container boilsTo "${c.boilsTo}" is not an item`);
      if (!t.knownItem(c.emptyTo)) problems.push(`${at}: container emptyTo "${c.emptyTo}" is not an item`);
      if (!CONTAINER_BLOCKS[it.key]) problems.push(`${at}: a container needs a furnace-top block in CONTAINER_BLOCKS`);
    }
    if (it.cools) {
      if (!t.knownItem(it.cools.to)) problems.push(`item ${it.key}: cools to "${it.cools.to}", which is not an item`);
      if (!(it.cools.afterS > 0)) problems.push(`${at}: cools afterS must be > 0`);
      if (it.stack !== 1) problems.push(`${at}: an item that cools must stack to 1 (its seconds are the stack's durability)`);
    }
  }
  for (const [container, blocks] of Object.entries(CONTAINER_BLOCKS)) {
    if (!item(container)?.container) problems.push(`CONTAINER_BLOCKS: "${container}" is not a container item`);
    for (const key of [blocks.cold, blocks.boiling]) {
      const def = t.block(key);
      if (!def) problems.push(`CONTAINER_BLOCKS: block "${key}" does not exist`);
      else if (def.machine !== BOIL_BUCKET_MACHINE) problems.push(`CONTAINER_BLOCKS: block "${key}" must belong to machine ${BOIL_BUCKET_MACHINE}`);
    }
  }
  for (const stage of CUP_STAGES) {
    const def = t.block(CUP_BLOCK[stage]);
    if (!def) problems.push(`CUP_BLOCK: block "${CUP_BLOCK[stage]}" does not exist`);
    else if (def.machine !== BREW_CUP_MACHINE) problems.push(`CUP_BLOCK: block "${def.key}" must belong to machine ${BREW_CUP_MACHINE}`);
    for (const part of CUP_PARTS[stage]) if (!t.knownItem(part)) problems.push(`CUP_PARTS: "${part}" is not an item`);
  }
  for (const kind of [BREW_CUP_MACHINE, BOIL_BUCKET_MACHINE, KETTLE_MACHINE]) {
    const m = t.machine(kind);
    if (!m) problems.push(`brewing machine ${kind} is missing`);
    else if (m.role !== 'brew') problems.push(`machine ${kind}: role must be 'brew'`);
  }
  if (t.block(KETTLE_BLOCK)?.machine !== KETTLE_MACHINE) problems.push(`block ${KETTLE_BLOCK} must belong to machine ${KETTLE_MACHINE}`);
  return problems;
}
