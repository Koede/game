/**
 * Content checks for item and fluid transport and multiblock hearths (spec 16-17). validateContent in the registry
 * calls this with its resolved tables (passed in, so this file needs no import of the registry).
 */
import { FIRST_HEARTH_TIER, HEARTH_CEILING_PARTS, HEARTH_FACE_PARTS } from './constants';
import { faceCells, smallestShell } from './hearth';
import type { BlockDef, FluidSpec, FurnaceTierSpec, MachineSpec } from './types';

export interface TechTables {
  blocks: readonly BlockDef[];
  knownBlock: (key: string) => boolean;
  knownItem: (key: string) => boolean;
  fluids: readonly FluidSpec[];
  tiers: readonly FurnaceTierSpec[];
  machines: readonly MachineSpec[];
}

const positiveInt = (n: number): boolean => Number.isInteger(n) && n >= 1;

function validatePipes(t: TechTables, problems: string[]): void {
  for (const def of t.blocks) {
    const at = `block ${def.key}`;
    if ((def.shape === 'pipe') !== (def.pipe !== null)) problems.push(`${at}: shape 'pipe' and a pipe spec go together`);
    const p = def.pipe;
    if (!p) continue;
    if (!(p.ratePerS > 0)) problems.push(`${at}: pipe ratePerS must be > 0`);
    if (def.power !== null || def.machine !== null) problems.push(`${at}: a pipe carries no power and owns no machine`);
    if (p.family === 'item') {
      if (!positiveInt(p.batch ?? 0)) problems.push(`${at}: item pipe needs a whole batch >= 1`);
      if (!((p.speedBlocksPerS ?? 0) > 0)) problems.push(`${at}: item pipe needs speedBlocksPerS > 0`);
      if (p.capacityL !== undefined || p.hot !== undefined) problems.push(`${at}: capacityL and hot are for fluid pipes`);
    } else {
      if (!((p.capacityL ?? 0) > 0)) problems.push(`${at}: fluid pipe needs capacityL > 0`);
      if (p.batch !== undefined || p.speedBlocksPerS !== undefined) problems.push(`${at}: batch and speed are for item pipes`);
    }
  }
}

function validateFluids(t: TechTables, problems: string[]): void {
  const keys = new Set<string>();
  const liquids = new Set<string>();
  for (const f of t.fluids) {
    const at = `fluid ${f.key}`;
    if (keys.has(f.key)) problems.push(`${at}: duplicate key`);
    keys.add(f.key);
    if (!Number.isInteger(f.colour) || f.colour < 0 || f.colour > 0xffffff) problems.push(`${at}: colour is not 0xRRGGBB`);
    if (f.liquid !== undefined) {
      if (liquids.has(f.liquid)) problems.push(`${at}: another fluid is already pumped from ${f.liquid}`);
      liquids.add(f.liquid);
    }
    if (f.bucket && (!t.knownItem(f.bucket.full) || !t.knownItem(f.bucket.empty))) problems.push(`${at}: bucket items must exist`);
  }
  for (const m of t.machines) {
    if (!m.fluids) continue;
    const at = `machine ${m.kind}`;
    const ports = [...(m.fluids.accepts ?? []), ...(m.fluids.gives ?? [])];
    if (ports.length === 0) problems.push(`${at}: fluid ports that accept and give nothing`);
    for (const k of ports) if (!keys.has(k)) problems.push(`${at}: unknown fluid "${k}"`);
    if (!(m.fluids.capacityL > 0)) problems.push(`${at}: fluid capacityL must be > 0`);
  }
}

function validateHearths(t: TechTables, problems: string[]): void {
  for (const key of [...HEARTH_FACE_PARTS, ...HEARTH_CEILING_PARTS]) if (!t.knownBlock(key)) problems.push(`hearth part "${key}" is not a block`);
  t.tiers.forEach((tier, i) => {
    const s = tier.structure;
    const at = `furnace tier ${tier.tier}`;
    if (tier.tier < FIRST_HEARTH_TIER) {
      if (s) problems.push(`${at}: the single-block tiers stand alone and have no structure`);
      return;
    }
    if (!s) {
      problems.push(`${at}: needs a hearth structure`);
      return;
    }
    if (s.wall.length === 0) problems.push(`${at}: no wall blocks`);
    for (const w of s.wall) if (!t.knownBlock(w)) problems.push(`${at}: wall "${w}" is not a block`);
    const next = t.tiers[i + 1]?.structure;
    if (next) {
      // Higher walls satisfy lower tiers, and each tier has a wall of its own.
      for (const w of next.wall) if (!s.wall.includes(w)) problems.push(`${at}: tier ${tier.tier + 1}'s wall "${w}" must also count here`);
      if (next.wall.includes(s.wall[0])) problems.push(`${at}: its own wall "${s.wall[0]}" must not satisfy tier ${tier.tier + 1}`);
    }
    for (let a = 0; a < 3; a++) {
      if (!positiveInt(s.minInner[a]) || !positiveInt(s.maxInner[a])) problems.push(`${at}: interior sizes must be whole numbers >= 1`);
      if (s.minInner[a] > s.maxInner[a]) problems.push(`${at}: minInner exceeds maxInner`);
    }
    if (!positiveInt(s.maxCrucibles) || !Number.isInteger(s.crucibleBonus) || s.crucibleBonus < 0) problems.push(`${at}: crucible rule must be whole numbers`);
    const electrodes = s.electrodes ?? 0;
    const ports = s.powerPorts ?? 0;
    if (!Number.isInteger(electrodes) || electrodes < 0 || !Number.isInteger(ports) || ports < 0) problems.push(`${at}: part counts must be whole numbers`);
    const faces = faceCells(s.minInner);
    if (electrodes > 0 && s.ceiling !== 'required') problems.push(`${at}: electrodes need a required ceiling`);
    if (electrodes > faces.ceiling) problems.push(`${at}: the smallest ceiling has no room for ${electrodes} electrodes`);
    if (ports + 1 > faces.walls + faces.floor) problems.push(`${at}: the smallest shell has no room for the controller and ${ports} ports`);
    if (smallestShell(s).wall < 1) problems.push(`${at}: the smallest shell has no wall left`);
  });
}

export function validateTech(t: TechTables): string[] {
  const problems: string[] = [];
  validatePipes(t, problems);
  validateFluids(t, problems);
  validateHearths(t, problems);
  return problems;
}
