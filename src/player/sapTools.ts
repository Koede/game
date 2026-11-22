/**
 * Tapping pine resin (docs/api/sugar.md): Use with a Glass Beaker in hand on a pine log catches its sap and swaps the
 * empty beaker for a Pine Sap. A tapped log weeps again after TAP_COOLDOWN_S seconds. The seconds still left are
 * saved with the world (`extras.sap`), not a session clock, so a reload keeps a weeping log weeping. A missing or
 * damaged extra leaves every log ready. Decided BEFORE placing and screens so a beaker aimed at a log never tries
 * to be placed. DOM-free: talks to the player and the bus through a small host.
 */
import type { GameBus } from '../core/context';
import type { IWorld } from '../core/types';
import type { PlayerState } from '../game';
import type { RayHit } from './raycast';

/** Seconds before the same log gives sap again. */
export const TAP_COOLDOWN_S = 120;
/** The conifer logs that weep sap. */
export const SAP_LOGS: ReadonlySet<string> = new Set(['pine_log']);
export const EMPTY_BEAKER = 'glass_beaker';
export const SAP_ITEM = 'pine_sap';

/** One weeping log: `waitS` is the seconds still left, not a timestamp. */
export interface SapCell {
  x: number;
  y: number;
  z: number;
  waitS: number;
}

/** Saved under the world's `sap` extra. `v` other than 1 is ignored. */
export interface SapSave {
  v: 1;
  cells: SapCell[];
}

export interface SapToolsHost {
  readonly player: PlayerState;
  readonly bus: GameBus;
  advise(key: string, text: string): void;
  swing(): void;
  stopMining(): void;
}

export type SapOutcome = 'tapped' | 'refused';

const sapByPlayer = new WeakMap<PlayerState, SapTools>();

/** The tap state bound to this player (the Interaction's SapTools), if one has been constructed. */
export function sapToolsFor(player: PlayerState): SapTools | undefined {
  return sapByPlayer.get(player);
}

interface WorldExtras {
  persist(key: string, save: () => unknown): () => void;
  extra(key: string): unknown;
}

function worldExtras(world: IWorld): WorldExtras | null {
  const candidate = world as IWorld & Partial<WorldExtras>;
  if (typeof candidate.persist !== 'function' || typeof candidate.extra !== 'function') return null;
  return candidate as WorldExtras;
}

/**
 * Reads `world.extra('sap')` into the player's tap state and registers `world.persist('sap', …)`.
 * Worlds without extras (unit-test fakes) are left alone. The returned function unregisters the saver.
 */
export function attachSapSave(world: IWorld, player: PlayerState): () => void {
  const sap = sapByPlayer.get(player);
  const store = worldExtras(world);
  if (!sap || !store) return () => {};
  sap.load(store.extra('sap'));
  return store.persist('sap', () => sap.toJSON());
}

/** A cell worth keeping: finite block coordinates and a wait still inside (0, TAP_COOLDOWN_S]. */
function keptCell(cell: unknown): SapCell | null | 'bad' {
  if (!cell || typeof cell !== 'object') return 'bad';
  const c = cell as Record<string, unknown>;
  if (typeof c.x !== 'number' || typeof c.y !== 'number' || typeof c.z !== 'number' || typeof c.waitS !== 'number') return 'bad';
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.z) || !Number.isFinite(c.waitS)) return 'bad';
  if (!(c.waitS > 0) || c.waitS > TAP_COOLDOWN_S) return null;
  return { x: c.x, y: c.y, z: c.z, waitS: c.waitS };
}

export class SapTools {
  /** Seconds still left before each cell weeps again. Ready cells are absent. */
  private readonly wait = new Map<string, number>();

  constructor(private readonly host: SapToolsHost) {
    sapByPlayer.set(host.player, this);
  }

  /** Advances every weeping log; call every frame. */
  update(dt: number): void {
    if (!(dt > 0) || this.wait.size === 0) return;
    for (const [cell, left] of this.wait) {
      const next = left - dt;
      if (next > 0) this.wait.set(cell, next);
      else this.wait.delete(cell);
    }
  }

  /** Seconds until the log at x, y, z weeps again (0 = ready). */
  waitS(x: number, y: number, z: number): number {
    return this.wait.get(`${x},${y},${z}`) ?? 0;
  }

  /** Remaining waits only. Ready logs are omitted; the clock that counted them is not stored. */
  toJSON(): SapSave {
    const cells: SapCell[] = [];
    for (const [key, left] of this.wait) {
      if (!(left > 0)) continue;
      const [x, y, z] = key.split(',').map(Number);
      cells.push({ x, y, z, waitS: Math.min(left, TAP_COOLDOWN_S) });
    }
    return { v: 1, cells };
  }

  /**
   * Replaces the weeping logs with a save. Missing data, a bad `v`, or a bad cell leaves every log ready.
   * A wait of 0 or above TAP_COOLDOWN_S is dropped. Never throws.
   */
  load(raw: unknown): void {
    this.wait.clear();
    try {
      if (!raw || typeof raw !== 'object') return;
      const data = raw as Record<string, unknown>;
      if (data.v !== 1 || !Array.isArray(data.cells)) return;
      const next = new Map<string, number>();
      for (const cell of data.cells) {
        const kept = keptCell(cell);
        if (kept === 'bad') return;
        if (kept) next.set(`${kept.x},${kept.y},${kept.z}`, kept.waitS);
      }
      for (const [key, left] of next) this.wait.set(key, left);
    } catch {
      this.wait.clear();
    }
  }

  /** Use on a pine log with an empty beaker held; null when this is not that situation (the tap carries on as before). */
  use(hit: RayHit): SapOutcome | null {
    const { player } = this.host;
    if (hit.block.liquid !== null || !SAP_LOGS.has(hit.block.key)) return null;
    // A glass vial works as well as a beaker (src/content/itemsGlass.ts); the sap comes back as a beaker of sap.
    const held = player.heldStack()?.item;
    if (held !== EMPTY_BEAKER && held !== 'glass_vial') return null;
    const cell = `${hit.x},${hit.y},${hit.z}`;
    const wait = this.waitS(hit.x, hit.y, hit.z);
    this.host.stopMining();
    if (wait > 0) {
      this.host.advise(`sap-${cell}`, `This log is still weeping: give it ${Math.ceil(wait / 10) * 10} s`);
      return 'refused';
    }
    player.inventory.removeAt(player.selectedSlot, 1);
    if (player.give(SAP_ITEM, 1) > 0) {
      // No room for the sap: put the glass back and leave the log alone.
      player.give(held, 1);
      this.host.advise(`sap-full-${cell}`, 'Your pack is full');
      return 'refused';
    }
    this.wait.set(cell, TAP_COOLDOWN_S);
    this.host.bus.emit('sfx', { name: 'sip', x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
    this.host.bus.emit('toast', { text: 'You catch a beaker of sticky sap', kind: 'good', item: SAP_ITEM });
    this.host.swing();
    return 'tapped';
  }
}
