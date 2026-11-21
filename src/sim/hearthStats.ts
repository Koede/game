/**
 * What a furnace runs at (spec 17.1): its effective tier is min(its upgraded tier, the structural tier of the formed
 * hearth around it) - tier 1 numbers when it stands alone - and a formed interior scales the tier's numbers. Every
 * part of the furnace model reads these instead of the raw tier table.
 */
import { hearthCrucibles, hearthScale, type Interior } from '../core/hearth';
import { block, furnaceTier } from '../core/registry';
import type { FurnaceTierSpec } from '../core/types';
import { article, hearthName, structureOf } from './hearthScan';

/** The formed hearth a furnace sits in, saved on the furnace entity (`hearth`; null while not formed). */
export interface HearthSummary {
  /** Structural tier 2..5. */
  tier: number;
  inner: [number, number, number];
  closed: boolean;
  windows: number;
  /** Inclusive world corners of the shell. */
  min: [number, number, number];
  max: [number, number, number];
}

export interface FurnaceStats {
  /** Effective tier: max(1, min(upgraded tier, structural tier)). */
  tier: number;
  spec: FurnaceTierSpec;
  maxTempC: number;
  heatCapacityJ: number;
  lossWPerC: number;
  /** Smelting speed: the tier's, times the size bonus and the running tuyeres. */
  speed: number;
  /** Crucibles that work; any beyond them are locked (their contents can still be taken out). */
  crucibles: number;
  /** Most electric heat it draws: the tier's, sized to the shell (times `fireScale`). */
  electricHeatW: number;
  /**
   * A hearth's fire and heater are sized to its shell: fuel burns this many times faster and gives this many times
   * the heat, so every legal hearth reaches the same temperatures and a bigger one simply costs more to keep hot.
   * Equals the heat-loss multiplier (1 for a lone furnace).
   */
  fireScale: number;
  /** Blowers in its faces running this tick (only HEARTH_MAX_TUYERES count). */
  tuyeres: number;
}

/** Effective tier of a furnace of upgraded `tier` in a hearth formed at `structural` (0: not formed). */
export const effectiveTier = (tier: number, structural: number): number => Math.max(1, Math.min(tier, structural));

/** The numbers a furnace of upgraded `tier` runs at, in the formed hearth `h` (null: standing alone). */
export function furnaceStats(tier: number, h: HearthSummary | null, tuyeres = 0, into?: FurnaceStats): FurnaceStats {
  const eff = effectiveTier(tier, h ? h.tier : 0);
  const spec = furnaceTier(eff);
  const out: FurnaceStats = into ?? {
    tier: 1, spec, maxTempC: 0, heatCapacityJ: 0, lossWPerC: 0, speed: 0, crucibles: 0, electricHeatW: 0, fireScale: 1, tuyeres: 0,
  };
  out.tier = eff;
  out.spec = spec;
  out.maxTempC = spec.maxTempC;
  out.tuyeres = tuyeres;
  if (eff >= 2 && h) {
    const inner: Interior = h.inner;
    const scale = hearthScale(inner, { closed: h.closed, windows: h.windows, tuyeres });
    out.heatCapacityJ = spec.heatCapacityJ * scale.heatCapacity;
    out.lossWPerC = spec.lossWPerC * scale.loss;
    out.speed = spec.speed * scale.speed;
    out.crucibles = hearthCrucibles(structureOf(eff), inner);
    out.fireScale = scale.loss;
  } else {
    out.heatCapacityJ = spec.heatCapacityJ;
    out.lossWPerC = spec.lossWPerC;
    out.speed = spec.speed;
    out.crucibles = spec.crucibles;
    out.fireScale = 1;
  }
  out.electricHeatW = spec.electricHeatW * out.fireScale;
  return out;
}

/**
 * What to build for a tier's hearth, in one line: "Build a Blast hearth: brick walls around the furnace", "Build an
 * Arc hearth: refractory brick walls around the furnace, a ceiling and 1 Arc Electrode".
 */
export function buildHint(tier: number): string {
  const s = structureOf(tier);
  const name = hearthName(tier);
  const extras: string[] = [];
  if (s.ceiling === 'required') extras.push('a ceiling');
  const e = s.electrodes ?? 0;
  const p = s.powerPorts ?? 0;
  if (e > 0) extras.push(`${e} ${block('electrode').name}${e === 1 ? '' : 's'}`);
  if (p > 0) extras.push(`${p} ${block('power_port').name}${p === 1 ? '' : 's'}`);
  const tail = extras.length === 0 ? '' : extras.length === 1 ? `, ${extras[0]}` : `, ${extras.slice(0, -1).join(', ')} and ${extras[extras.length - 1]}`;
  return `Build ${article(name)} ${name}: ${block(s.wall[0]).name.toLowerCase()} walls around the furnace${tail}`;
}
