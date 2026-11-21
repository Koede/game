/**
 * The player's hands on the Ember handwork (EMBER_PLAN 2 and 5), decided right after brewing and before pipes, screens
 * and placing:
 * - a hand station (a block with `handStation`: chopping block, quern, anvil, mortar, clay table, loom, drying rack,
 *   trough) goes to the simulation's `stroke`. One Use is one stroke, an insert or a take, as the sim decides; holding
 *   Use repeats at the station's `strokesPerS` (the controller tells the input layer, `useRepeatFor`);
 * - a fired mould held against a furnace that has molten metal pours the first molten crucible into it, in the world,
 *   without opening the screen (`pourCrucible`).
 * The simulation is reached through the small HandHands interface (src/sim's Simulation fits it structurally).
 */
import { USE_REPEAT_S } from './input/core';
import { blockOfItem, itemOrNull, recipesAt } from '../core/registry';
import type { BlockDef } from '../core/types';
import type { PlayerState } from '../game';
import type { RayHit } from './raycast';

export type HandResult = { ok: true; did: string; done?: boolean } | { ok: false; reason: string };
export type PourResult = { ok: true } | { ok: false; reason: string };

/** What the player module needs from the simulation's hand stations and casting (docs/api/handwork.md, casting.md). */
export interface HandHands {
  /** One Use on the station at x, y, z with `heldKey` in hand (null: an empty hand): insert, take or a stroke. */
  stroke(x: number, y: number, z: number, heldKey: string | null): HandResult;
  /** An empty hand puts the station's loaded input back into the pack. */
  handReturn(x: number, y: number, z: number): HandResult;
  /** Pours crucible `slot` of the furnace at x, y, z into the mould `heldKey` (a pack item). */
  pourCrucible(x: number, y: number, z: number, slot: number, heldKey: string | null): PourResult;
  /** The furnace's crucibles: which hold molten metal. Null when there is no furnace. */
  furnaceView(x: number, y: number, z: number): { crucibles: readonly { index: number; moltenS: number }[] } | null;
}

/** What the tools need from the Interaction that owns them. */
export interface HandToolsHost {
  readonly player: PlayerState;
  advise(key: string, text: string): void;
  swing(): void;
  stopMining(): void;
}

export type HandOutcome = 'worked' | 'poured' | 'refused';

/** Seconds between repeats of a held Use aimed at `def`: a hand station's own rate, else the usual one. */
export function useRepeatFor(def: BlockDef | null): number {
  const rate = def?.handStation?.strokesPerS;
  return rate && rate > 0 ? 1 / rate : USE_REPEAT_S;
}

export class HandTools {
  constructor(private readonly host: HandToolsHost, private readonly hands: HandHands | null) {}

  /**
   * Use on a hand station or on a furnace with a mould in hand; null when the hit is neither (or the game has no hand
   * work), so the rest of Use carries on. `forceReturn` (Shift, the touch Place toggle) with an empty hand takes the
   * station's loaded input back instead of striking it.
   */
  use(hit: RayHit, forceReturn: boolean): HandOutcome | null {
    if (!this.hands || hit.block.liquid !== null) return null;
    const held = this.host.player.heldStack()?.item ?? null;
    if (hit.block.handStation) return this.station(hit, held, forceReturn);
    if (held !== null && itemOrNull(held)?.mould && hit.block.machine === 'furnace') return this.pour(hit, held);
    return null;
  }

  private station(hit: RayHit, held: string | null, forceReturn: boolean): HandOutcome | null {
    const hands = this.hands as HandHands;
    const spec = hit.block.handStation;
    if (held === null && forceReturn) return this.finish(hands.handReturn(hit.x, hit.y, hit.z), hit);
    // A held item the station can use (an ingredient, its tool) goes to the sim as is. A block that is not an ingredient
    // is meant to be placed next to the station; anything else is just a bare hand.
    const useful = held !== null && (this.takes(hit.block.key, held) || (spec?.tool !== undefined && itemOrNull(held)?.tool?.kind === spec.tool));
    if (held !== null && !useful && blockOfItem(held) !== null) return null;
    return this.finish(hands.stroke(hit.x, hit.y, hit.z, useful ? held : null), hit);
  }

  /** Whether a recipe of the station takes the item as its first input (the sim's own rule for loading it). */
  private takes(station: string, item: string): boolean {
    return recipesAt(station).some((r) => r.inputs[0]?.item === item);
  }

  private finish(r: HandResult, hit: RayHit): HandOutcome {
    const h = this.host;
    h.stopMining();
    if (!r.ok) {
      h.advise(`hand:${hit.block.key}:${r.reason.replace(/\d+/g, '')}`, r.reason);
      return 'refused';
    }
    h.swing();
    return 'worked';
  }

  /** A mould against a furnace: pour the first crucible that holds molten metal; with none, the screen opens as usual. */
  private pour(hit: RayHit, mould: string): HandOutcome | null {
    const hands = this.hands as HandHands;
    const molten = hands.furnaceView(hit.x, hit.y, hit.z)?.crucibles.find((c) => c.moltenS > 0);
    if (!molten) return null;
    const h = this.host;
    h.stopMining();
    const r = hands.pourCrucible(hit.x, hit.y, hit.z, molten.index, mould);
    if (!r.ok) {
      h.advise(`pour:${r.reason}`, r.reason);
      return 'refused';
    }
    h.swing();
    return 'poured';
  }
}
