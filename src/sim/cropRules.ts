/**
 * The rules of crop growth (spec 12.4): the numbers of the 'crop' MachineSpec, the stage blocks, the saved crop
 * entity, and the functions that decide whether a crop is lit, watered and how fast it grows. CropField (crops.ts)
 * keeps the cached facts these read up to date.
 */
import { MACHINES, block, blockId, machine } from '../core/registry';
import type { BlockDef, BlockEntity } from '../core/types';
import type { Shelter } from './seasons';

const SPEC = machine('crop');

function param(name: string): number {
  const v = SPEC.params?.[name];
  if (v === undefined) throw new Error(`MachineSpec 'crop' lacks params.${name}`);
  return v;
}

/** Seconds of growing time per stage at full rate (hydrated). */
export const STAGE_S = param('stageS');
/** Growth rate without water in reach. */
export const DRY_RATE = param('dryRate');
export const HYDRATION_R = param('hydrationRadius');
export const LAMP_R = param('lampRadius');
export const MIN_SUNLIGHT = param('minSunlight');

/** One stage block of a crop (or of a wild bush that fruits again). */
export interface StageInfo {
  /** Crop key: the stage block keys are `<crop>_<stage>` ('wheat', 'potato', 'carrot'); a bush's machine kind. */
  crop: string;
  /** 0-based; `stages - 1` is ripe. */
  stage: number;
  stages: number;
  /** Block id of the next stage, -1 when ripe. */
  next: number;
  /** Seconds of full-rate growth to the next stage. */
  stageS: number;
  /**
   * A wild bush (MachineRole 'bush', spec 14): it regrows wherever it stands - no farmland, light or water needed -
   * and its entity has the bush's machine kind.
   */
  wild: boolean;
}

/** Stage of every crop block, by block id. */
export const STAGE_OF: Array<StageInfo | undefined> = [];
{
  const families = new Map<string, Array<{ stage: number; id: number }>>();
  for (const key of SPEC.blocks) {
    const m = /^(.+)_(\d+)$/.exec(key);
    if (!m) throw new Error(`Crop block '${key}' is not named <crop>_<stage>`);
    const list = families.get(m[1]) ?? [];
    list.push({ stage: Number(m[2]), id: blockId(key) });
    families.set(m[1], list);
  }
  for (const [crop, list] of families) {
    list.sort((a, b) => a.stage - b.stage);
    list.forEach(({ id }, i) => {
      STAGE_OF[id] = { crop, stage: i, stages: list.length, next: i + 1 < list.length ? list[i + 1].id : -1, stageS: STAGE_S, wild: false };
    });
  }
  // Bushes: the fruiting block (it has `harvestLeaves`) is ripe; picking it leaves the bare stage, which regrows.
  for (const spec of MACHINES.values()) {
    if (spec.role !== 'bush') continue;
    const regrowS = spec.params?.regrowS;
    if (regrowS === undefined) throw new Error(`MachineSpec '${spec.kind}' lacks params.regrowS`);
    for (const key of spec.blocks) {
      const bare = block(key).harvestLeaves;
      if (!bare) continue;
      const ripe = blockId(key);
      STAGE_OF[blockId(bare)] = { crop: spec.kind, stage: 0, stages: 2, next: ripe, stageS: regrowS, wild: true };
      STAGE_OF[ripe] = { crop: spec.kind, stage: 1, stages: 2, next: -1, stageS: regrowS, wild: true };
    }
  }
}

/** Whether a block is a growing plant the crops follow: a crop stage or a wild bush. */
export const isPlantBlock = (def: BlockDef): boolean => STAGE_OF[def.id] !== undefined;

/** Stage of a crop block, or null for any other block. */
export const cropStage = (def: BlockDef): StageInfo | null => STAGE_OF[def.id] ?? null;

/**
 * The saved state of a crop (kind 'crop') or a wild bush (kind: its machine, e.g. 'berry_bush'): only its growing time
 * into the current stage (the stage is the block itself).
 */
export interface CropEntity extends BlockEntity {
  /** Seconds of full-rate growing time into the current stage (0..stageS). */
  growS: number;
}

export const isCrop = (e: BlockEntity | undefined): e is CropEntity => e !== undefined && e.kind === 'crop';
/** A crop or a wild bush: an entity the crops follow, never a machine. */
export const isPlant = (e: BlockEntity | undefined): e is CropEntity =>
  e !== undefined && (e.kind === 'crop' || MACHINES.get(e.kind)?.role === 'bush');

/** Runtime companion of a crop entity (never saved). */
export interface CropNode {
  readonly e: CropEntity;
  readonly key: string;
  /** Stage of the block at its position; null until its chunk was seen loaded. */
  info: StageInfo | null;
  soil: boolean;
  sky: boolean;
  /** Nothing solid or liquid above: rain reaches it (a glass roof lets the sky's light in but keeps the rain off). */
  rain: boolean;
  water: boolean;
  lamp: boolean;
  /** Bits of the cached facts to recompute before the crop is next looked at (see CropField). */
  dirty: number;
  /** Index in the awake list, -1 while asleep. */
  slot: number;
  /** Seconds it waited, awake, for its refresh (the per-tick budget ran out): grown once it is refreshed. */
  waitS: number;
}

/** What growth reads from the world besides the crop's own cache, set once per tick. */
export interface CropContext {
  /** Clock sunlight >= minSunlight. */
  sunUp: boolean;
  /** Rain or snow soaks an exposed crop at this position this tick (spec 15); null when nothing soaks anywhere. */
  wetAt: ((x: number, y: number, z: number) => boolean) | null;
  /** Seasonal growth multiplier of a crop at a position (src/sim/seasons.ts); absent = 1. */
  scale?: ((crop: string, x: number, y: number, z: number, exposed: boolean) => number) | null;
  /** A spraying sprinkler waters a crop at this position (src/sim/waterNet.ts), roofed or not; absent = none. */
  irrigated?: ((x: number, y: number, z: number) => boolean) | null;
}

/** Daylight under open sky, or a powered lamp in reach (any hour, underground too). */
export const isLit = (c: CropNode, ctx: CropContext): boolean => (ctx.sunUp && c.sky) || c.lamp;

/** Whether the crop counts as watered: water in reach, or rain (or snow) falling on it under open sky (spec 15). */
export function isHydrated(c: CropNode, ctx: CropContext): boolean {
  return c.water || (c.rain && ctx.wetAt !== null && ctx.wetAt(c.e.x, c.e.y, c.e.z)) || (ctx.irrigated?.(c.e.x, c.e.y, c.e.z) ?? false);
}

/** Growth per second of game time: 1 hydrated, dryRate dry, 0 when ripe, unlit or off farmland. A bush: 1 until ripe. */
export function growthRate(c: CropNode, ctx: CropContext): number {
  if (c.info === null || c.info.next < 0) return 0;
  if (c.info.wild) return 1;
  if (!c.soil || !isLit(c, ctx)) return 0;
  const base = isHydrated(c, ctx) ? 1 : DRY_RATE;
  return ctx.scale ? base * ctx.scale(c.info.crop, c.e.x, c.e.y, c.e.z, c.rain) : base;
}

/** What a crop is doing, for whoever wants to show it (crops have no screen; spec 12.4). */
export interface CropView {
  x: number;
  y: number;
  z: number;
  crop: string;
  /** Block name, e.g. "Wheat (ripe)". */
  name: string;
  stage: number;
  stages: number;
  ripe: boolean;
  soil: boolean;
  lit: boolean;
  hydrated: boolean;
  /** Current growth rate: 1, dryRate or 0. */
  rate: number;
  /** 0..1 through the current stage (1 when ripe). */
  progress: number;
  /** Seconds to the next stage at the current rate (0 when ripe, Infinity while not growing). */
  nextStageS: number;
  /** Seconds to ripe at the current rate (0 when ripe, Infinity while not growing). */
  ripeInS: number;
  /** "Ripe" / "Needs farmland" / "Needs light" / "Growing - stage 2 of 4". */
  status: string;
  /** A wild bush (it needs nothing around it). */
  wild: boolean;
  /** Nothing over it: rain, snow and frost reach it. */
  exposed: boolean;
  /** Roofed crops: the air in C (filled in by the simulation; docs/api/greenhouse.md). */
  tempC?: number;
  /** Open sky, a heated greenhouse, a cold roofed spot, or frozen (filled in by the simulation). */
  shelter?: Shelter;
}
