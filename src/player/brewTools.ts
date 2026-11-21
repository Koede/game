/**
 * The player's hands on brewing (BREWING_PLAN 5, 8), decided BEFORE pipes, screens and placing so that a tap on a
 * tiny cup does the intended step whatever else the held item could do:
 * - a brewing block (cup states, a bucket boiling on a furnace, the kettle pot) goes to the simulation's `brewUse`,
 *   which owns the table of steps and returns the sentence that says what to do next when a step is refused;
 * - a water container aimed at the top of a furnace or hearth wall sets its furnace-top block there (never pours a
 *   water source onto the furnace).
 * The simulation is reached through the small BrewHands interface (src/sim's Simulation fits it structurally).
 */
import { CONTAINER_BLOCKS, KETTLE_MACHINE } from '../core/brewing';
import { ITEMS, itemOrNull, machineOfBlock } from '../core/registry';
import { Face } from '../core/types';
import type { PlayerState } from '../game';
import type { RayHit } from './raycast';

/** The result of one brewing step (src/sim's Simulation.brewUse and placeContainer; docs/api/brewing.md). */
export type BrewResult =
  | {
      ok: true;
      /** Remove ONE of the held item; then `give` goes into the same slot when it emptied, else into the pack. */
      consume: boolean;
      give?: string;
      /** The seconds left of a boiling bucket, kept on the stack's durability (it cools in the pack). */
      giveDurability?: number;
      toast?: string;
    }
  | { ok: false; reason: string };

/** What the player module needs from the simulation's brewing. */
export interface BrewHands {
  /** The held item `heldKey` (null: empty hand) used on the brewing block (or kettle) at x, y, z. */
  brewUse(x: number, y: number, z: number, heldKey: string | null): BrewResult;
  /** Sets the held water container down on the furnace top: x, y, z is the air cell above the furnace. */
  placeContainer(x: number, y: number, z: number, heldKey: string | null): BrewResult;
  /** Whether the air cell x, y, z lies on a furnace or a hearth's roof. */
  isFurnaceTop(x: number, y: number, z: number): boolean;
}

/** What the tools need from the Interaction that owns them. */
export interface BrewToolsHost {
  readonly player: PlayerState;
  /** Seconds before the next placement may happen. */
  readonly placeCooldown: number;
  placed(): void;
  advise(key: string, text: string): void;
  edited(): void;
  swing(): void;
  stopMining(): void;
}

export type BrewOutcome = 'brewed' | 'placed' | 'refused';

const KETTLE = KETTLE_MACHINE;
const isEmptyContainer = (key: string | null): boolean => key !== null && ITEMS.some((it) => it.container?.emptyTo === key);

export class BrewTools {
  constructor(private readonly host: BrewToolsHost, private readonly brew: BrewHands | null) {}

  /**
   * Use on a brewing block (or a kettle with an empty container in hand); null when the hit is neither (or the game
   * has no brewing). A refusal is toasted as the sentence the simulation gives and ends the tap.
   */
  use(hit: RayHit): BrewOutcome | null {
    if (!this.brew || hit.block.liquid !== null) return null;
    const held = this.host.player.heldStack()?.item ?? null;
    const kind = machineOfBlock(hit.block);
    if (kind?.role !== 'brew' || (kind.kind === KETTLE && !isEmptyContainer(held))) return null;
    if (this.host.placeCooldown > 0) return this.pause();
    return this.apply(this.brew.brewUse(hit.x, hit.y, hit.z, held), held);
  }

  /**
   * A water container held against the top of a furnace or hearth roof: the sim sets its furnace-top block on the
   * cell above. Null when this is not that situation (pouring, pipes and screens carry on as before).
   */
  placeContainer(hit: RayHit): BrewOutcome | null {
    if (!this.brew || hit.block.liquid !== null || hit.face !== Face.PY) return null;
    const held = this.host.player.heldStack()?.item ?? null;
    if (held === null || !CONTAINER_BLOCKS[held]) return null;
    const y = hit.y + 1;
    if (!this.brew.isFurnaceTop(hit.x, y, hit.z)) return null;
    if (this.host.placeCooldown > 0) return this.pause();
    return this.apply(this.brew.placeContainer(hit.x, y, hit.z, held), held);
  }

  /** A held button repeats Use: the next step waits for the press delay, so one tap is never read twice. */
  private pause(): BrewOutcome {
    this.host.stopMining();
    return 'refused';
  }

  private apply(r: BrewResult, held: string | null): BrewOutcome {
    const h = this.host;
    h.stopMining();
    if (!r.ok) {
      h.advise(`brew:${r.reason.replace(/\d+/g, '')}`, r.reason);
      return 'refused';
    }
    if (r.consume) {
      const slot = h.player.selectedSlot;
      h.player.consumeHeld(1);
      if (r.give !== undefined) this.give(r.give, r.giveDurability, slot);
    } else if (r.give !== undefined) {
      this.give(r.give, r.giveDurability, null);
    }
    if (r.toast) h.advise(`brew:${r.toast}`, r.toast);
    h.edited();
    h.placed();
    h.swing();
    return held !== null && CONTAINER_BLOCKS[held] && r.give === undefined ? 'placed' : 'brewed';
  }

  /**
   * `give` into `slot` when that slot is empty now, else into the first free slot (hotbar first). A boiling bucket's
   * seconds left are written on the stack here: Inventory.add keeps a durability only for tools. A full pack spills.
   */
  private give(item: string, durability: number | undefined, slot: number | null): void {
    const { player } = this.host;
    if (!itemOrNull(item)) return;
    const inv = player.inventory;
    const free = slot !== null && inv.get(slot) === null ? slot : inv.slots.findIndex((s) => s === null);
    if (free < 0) {
      player.give(item, 1);
      return;
    }
    inv.set(free, durability === undefined ? { item, count: 1 } : { item, count: 1, durability });
    player.bus.emit('item:gained', { item, count: 1 });
  }
}
