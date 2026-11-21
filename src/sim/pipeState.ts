/**
 * What item and fluid transport (spec 16) keeps in the world: pipe block entities. Pipes are not machines; a pipe
 * only gets an entity when it has something to remember:
 *  - `ports`: the settings of a pipe end touching an endpoint (only where a pipe touches one, only once changed);
 *  - `cut`: joints to neighbouring pipes the wrench parted;
 *  - `store` / `packets`: the content of a whole network, kept on one pipe of it (the network's anchor), so fluid
 *    amounts and items in flight are saved with the world like any other block entity.
 * Cell keys are exact numbers per position (|x|, |z| < 2^20, 0 <= y < 128), with constant offsets per direction.
 */
import { PIPE_FILTER_SLOTS, PIPE_PRIORITY_MAX, PIPE_PRIORITY_MIN } from '../core/constants';
import { fluidOrNull, itemOrNull, machineOfBlock } from '../core/registry';
import type { BlockDef, BlockEntity, FluidKey } from '../core/types';

export type Family = 'item' | 'fluid';
export type PortMode = 'push' | 'pull' | 'off';
export type Distribution = 'nearest' | 'round';
export type FilterMode = 'allow' | 'deny';

/** Settings of one pipe end touching an endpoint (spec 16.3). */
export interface PortConfig {
  mode: PortMode;
  distribution: Distribution;
  /** Up to PIPE_FILTER_SLOTS item or fluid keys. An empty filter lets everything through in either mode. */
  filter: string[];
  filterMode: FilterMode;
  /** PIPE_PRIORITY_MIN..PIPE_PRIORITY_MAX: higher priorities are served first. */
  priority: number;
}

/** An item packet as saved: where it came from and where it was going, as [x, y, z, dir] of the pipe end. */
export interface SavedPacket {
  item: string;
  count: number;
  durability?: number;
  from: [number, number, number, number];
  to: [number, number, number, number];
  /** On its way back to where it came from. */
  back?: boolean;
}

/** What a fluid network holds. */
export interface FluidStore {
  fluid: FluidKey | null;
  litres: number;
}

export interface PipeEntity extends BlockEntity {
  kind: 'pipe';
  /** Port settings by direction (Face 0..5); null where the default applies. */
  ports?: (PortConfig | null)[];
  /** Bit per direction (1 << Face): the joint to the pipe that way was parted with the wrench. */
  cut?: number;
  store?: FluidStore;
  packets?: SavedPacket[];
}

export const PIPE_ENTITY = 'pipe';
export const isPipeEntity = (e: BlockEntity | undefined): e is PipeEntity => e !== undefined && e.kind === PIPE_ENTITY;

// ---- cell keys --------------------------------------------------------------------------------------------------

const HALF = 1 << 20;
const SPAN = 1 << 21;
const XSTEP = SPAN * 128;

export const cellKey = (x: number, y: number, z: number): number => ((x + HALF) * SPAN + (z + HALF)) * 128 + y;
export const keyY = (k: number): number => k % 128;
export const keyZ = (k: number): number => (Math.floor(k / 128) % SPAN) - HALF;
export const keyX = (k: number): number => Math.floor(k / XSTEP) - HALF;
/** Key offset of the neighbour in each Face direction (+X, -X, +Y, -Y, +Z, -Z). */
export const KEY_STEP: readonly number[] = [XSTEP, -XSTEP, 1, -1, 128, -128];
/** The neighbour of a cell in a direction, or -1 above or below the 0..127 band (no wrap into another column). */
export function stepKey(k: number, dir: number): number {
  const y = k % 128;
  if ((dir === 2 && y === 127) || (dir === 3 && y === 0)) return -1;
  return k + KEY_STEP[dir];
}
/** Identity of a pipe end: its pipe's cell and the direction of the block it touches. */
export const portId = (pipeKey: number, dir: number): number => pipeKey * 8 + dir;

// ---- port settings ----------------------------------------------------------------------------------------------

/**
 * The mode a pipe end starts in: 'push' (spec 16.3), except where pushing could never do anything - those start
 * pulling: against a block that only gives (a pump, a bore rig), and a hot pipe against a block that gives a hot
 * fluid but takes no hot fluid in (a boiler's steam: its water comes through a cold pipe).
 */
export function defaultMode(family: Family, def: BlockDef, pipe: BlockDef | null = null): PortMode {
  const spec = machineOfBlock(def);
  if (!spec) return 'push';
  if (family === 'fluid') {
    const accepts = spec.fluids?.accepts ?? [];
    const gives = spec.fluids?.gives ?? [];
    if (accepts.length === 0 && gives.length > 0) return 'pull';
    const hot = (key: string): boolean => fluidOrNull(key)?.hot ?? false;
    return pipe?.pipe?.hot && gives.some(hot) && !accepts.some(hot) ? 'pull' : 'push';
  }
  return spec.kind === 'bore_rig' ? 'pull' : 'push';
}

export const defaultConfig = (mode: PortMode): PortConfig => ({ mode, distribution: 'nearest', filter: [], filterMode: 'deny', priority: 0 });

/** Whether a port's filter lets an item or fluid key through. */
export function passes(cfg: PortConfig, key: string): boolean {
  if (cfg.filter.length === 0) return true;
  return cfg.filter.includes(key) === (cfg.filterMode === 'allow');
}

/** A change to a port's settings from the pipe screen; fields left out stay as they are. */
export interface PortChange {
  mode?: PortMode;
  distribution?: Distribution;
  filter?: string[];
  filterMode?: FilterMode;
  priority?: number;
}

/** Why a change cannot be applied, or null when it is valid. */
export function invalidChange(family: Family, c: PortChange): string | null {
  if (c.mode !== undefined && c.mode !== 'push' && c.mode !== 'pull' && c.mode !== 'off') return 'Unknown mode';
  if (c.distribution !== undefined && c.distribution !== 'nearest' && c.distribution !== 'round') return 'Unknown distribution';
  if (c.filterMode !== undefined && c.filterMode !== 'allow' && c.filterMode !== 'deny') return 'Unknown filter mode';
  if (c.priority !== undefined && (!Number.isInteger(c.priority) || c.priority < PIPE_PRIORITY_MIN || c.priority > PIPE_PRIORITY_MAX)) {
    return `Priority goes from ${PIPE_PRIORITY_MIN} to ${PIPE_PRIORITY_MAX}`;
  }
  if (c.filter !== undefined) {
    if (c.filter.length > PIPE_FILTER_SLOTS) return `A filter holds at most ${PIPE_FILTER_SLOTS} entries`;
    for (const key of c.filter) {
      const known = family === 'item' ? itemOrNull(key) !== null : fluidOrNull(key) !== null;
      if (!known) return family === 'item' ? `"${key}" is not an item` : `"${key}" is not a fluid`;
    }
  }
  return null;
}

export function applyChange(cfg: PortConfig, c: PortChange): void {
  if (c.mode !== undefined) cfg.mode = c.mode;
  if (c.distribution !== undefined) cfg.distribution = c.distribution;
  if (c.filterMode !== undefined) cfg.filterMode = c.filterMode;
  if (c.priority !== undefined) cfg.priority = c.priority;
  if (c.filter !== undefined) cfg.filter = [...new Set(c.filter)];
}

/** True when the entity remembers nothing and can go. */
export function pipeEntityEmpty(e: PipeEntity): boolean {
  return !(e.ports && e.ports.some((p) => p)) && !e.cut && !e.store && !(e.packets && e.packets.length > 0);
}
