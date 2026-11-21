/**
 * The player's hands on the Ember Age hand stations (docs/api/handwork.md): chopping block, hand quern, stone anvil,
 * drying rack, loom, tanning trough, clay table, mortar, casting bench...
 *
 * One Use on a station block calls the simulation's `stroke(x, y, z, heldKey)`, which owns every rule: it loads the
 * held stack onto the station (moving it out of the selected slot itself), takes finished work into the pack, or counts
 * one stroke. This class only forwards the tap, repeats a HELD Use at the station's `strokesPerS`, swings the arm and
 * toasts the sentence the simulation gives when a step is refused. It is decided BEFORE placing, pipes and screens so
 * that a log in hand loads the block instead of being placed against it.
 *
 * The simulation is reached through the small HandHands interface (src/sim's Simulation fits it structurally).
 */
import type { PlayerState } from '../game';
import type { RayHit } from './raycast';

/** The result of one hand-station step (src/sim's Simulation.stroke / handReturn). */
export type HandResult = { ok: true; did: 'insert' | 'stroke' | 'take' | 'done' | 'return'; done?: boolean } | { ok: false; reason: string };

/** The part of a HandView the hands need. */
export interface HandAim {
  strokesPerS: number;
  timed: boolean;
}

/** What the player module needs from the simulation's hand stations. */
export interface HandHands {
  stroke(x: number, y: number, z: number, heldKey: string | null): HandResult;
  /** Null when the cell is not a tracked hand station. */
  handView(x: number, y: number, z: number): HandAim | null;
  /** Use on a furnace with a fired mould (pours its molten metal) or copper/tin (into its alloy pot): null = not a pour. */
  pourHeld?(x: number, y: number, z: number, heldKey: string | null): { ok: true } | { ok: false; reason: string } | null;
}

/** What the tools need from the Interaction that owns them. */
export interface HandToolsHost {
  readonly player: PlayerState;
  advise(key: string, text: string): void;
  swing(): void;
  stopMining(): void;
}

export type HandOutcome = 'worked' | 'refused';

/** Repeat rate when a station does not say (strokes per second). */
const DEFAULT_STROKES_PER_S = 2.5;
/** A refusal is repeated at most this often while Use stays held (seconds), so the toast does not flicker. */
const REFUSAL_REPEAT_S = 1.2;

export class HandTools {
  private cooldown = 0;
  private lastCell = '';

  constructor(private readonly host: HandToolsHost, private readonly hands: HandHands | null) {}

  /** Ticks the repeat timer; call every frame. */
  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  /** Use on a hand station: null when the hit is not one (or the game has no hand stations), else the outcome. */
  use(hit: RayHit): HandOutcome | null {
    if (!this.hands || hit.block.liquid !== null) return null;
    if (hit.block.machine === 'furnace') return this.pour(hit);
    if (hit.block.handStation === null) return null;
    const view = this.hands.handView(hit.x, hit.y, hit.z);
    if (!view) return null;
    const cell = `${hit.x},${hit.y},${hit.z}`;
    // A new tap on another station is never swallowed by the repeat timer of the last one.
    if (cell !== this.lastCell) this.cooldown = 0;
    this.lastCell = cell;
    if (this.cooldown > 0) return 'worked';
    const held = this.host.player.heldStack()?.item ?? null;
    const result = this.hands.stroke(hit.x, hit.y, hit.z, held);
    this.host.stopMining();
    if (!result.ok) {
      this.cooldown = REFUSAL_REPEAT_S;
      this.host.advise(`hand-${cell}`, result.reason);
      return 'refused';
    }
    // Loading and taking are single actions; only strokes repeat at the station's pace.
    this.cooldown = result.did === 'stroke' || result.did === 'done' ? 1 / Math.max(0.5, view.strokesPerS || DEFAULT_STROKES_PER_S) : 0.3;
    this.host.swing();
    return 'worked';
  }

  /** Use on a furnace: a mould in hand pours its molten metal, copper or tin goes into its alloy pot (else the screen opens). */
  private pour(hit: RayHit): HandOutcome | null {
    const held = this.host.player.heldStack()?.item ?? null;
    if (!held || !this.hands?.pourHeld) return null;
    const cell = `${hit.x},${hit.y},${hit.z}`;
    if (cell !== this.lastCell) this.cooldown = 0;
    this.lastCell = cell;
    if (this.cooldown > 0) return 'worked';
    const result = this.hands.pourHeld(hit.x, hit.y, hit.z, held);
    if (!result) return null;
    this.host.stopMining();
    if (!result.ok) {
      this.cooldown = REFUSAL_REPEAT_S;
      this.host.advise(`pour-${cell}`, result.reason);
      return 'refused';
    }
    this.cooldown = 0.5;
    this.host.swing();
    return 'worked';
  }
}
