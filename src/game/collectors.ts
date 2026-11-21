/**
 * Collectors: handheld things that pull ground items to the player from much further than the plain pickup radius.
 * One small mechanism with three parts - a radius, a pull strength and a power source - so the Bronze Age Hand
 * Vacuum Pump (wear) and the planned Current Age Electromagnet (electric power) are each just a definition in
 * `COLLECTORS`. Nothing here knows about a particular item.
 *
 * Use with a collector in hand arms it for `burstS` seconds (holding Use keeps it armed). While armed and powered the
 * collector hands `{ radius, pull }` to GroundItems.tick, which flies ready items inside the radius to the player.
 */
import type { GameBus } from '../core/context';
import { itemOrNull } from '../core/registry';
import type { ActiveCollector } from './groundItems';
import type { PlayerState } from './playerState';

/** Where a collector's power comes from. A new kind is one more member here and one more case in `drawPower`. */
export type PowerSource =
  /** Wears the held stack's durability by `perS` per second of suction (a pump with leather seals). */
  | { kind: 'wear'; perS: number }
  /** Needs no supply (a test collector, or an item with a charge of its own handled elsewhere). */
  | { kind: 'free' }
  /**
   * Electric: `watts` while running, asked of `supply(wattSeconds)`, which returns false when the grid / battery cannot
   * give it. For the Current Age electromagnet; wire the supply when it is built.
   */
  | { kind: 'electric'; watts: number; supply: (joules: number) => boolean };

export interface CollectorDef {
  /** Item key; the collector works while this item is the held one. */
  item: string;
  /** Blocks around the body centre. */
  radius: number;
  /** Speed (blocks/s) items are pulled in at. */
  pull: number;
  /** Seconds one Use keeps it running. */
  burstS: number;
  power: PowerSource;
  /** Sound while running (an SfxName), played about every `soundEveryS`. */
  sound?: 'steam_hiss' | 'machine_on' | 'spark';
  soundEveryS?: number;
}

/** Every collector, by item key. */
export const COLLECTORS: Record<string, CollectorDef> = {
  hand_vacuum: {
    item: 'hand_vacuum',
    radius: 9,
    pull: 11,
    burstS: 2.5,
    power: { kind: 'wear', perS: 1 },
    sound: 'steam_hiss',
    soundEveryS: 0.55,
  },
  // electromagnet (Current Age, future): { item: 'electromagnet', radius: 12, pull: 14, burstS: 3,
  //   power: { kind: 'electric', watts: 400, supply: ... } } - only metal items, perhaps; see docs/api/ground-items.md.
};

export const collectorOf = (item: string | null | undefined): CollectorDef | null => (item ? COLLECTORS[item] ?? null : null);

/** Takes `dt` seconds of power; false when the source cannot give it (the collector then stops). */
function drawPower(player: PlayerState, def: CollectorDef, dt: number): boolean {
  const p = def.power;
  switch (p.kind) {
    case 'free':
      return true;
    case 'wear':
      // wearHeldTool returns true when the tool broke on this very use: that tick still pulled.
      player.wearHeldTool(p.perS * dt);
      return true;
    case 'electric':
      return p.supply(p.watts * dt);
  }
}

/** Per-player collector state: armed time and the effect hooks. Owned by PlayerState (`player.collectors`). */
export class Collectors {
  /** Seconds left of the armed burst; 0 = off. */
  armedS = 0;
  /** True on ticks where it actually pulled (HUD and renderer effect). */
  running = false;
  private soundT = 0;
  private readonly out: ActiveCollector = { radius: 0, pull: 0 };

  constructor(
    private readonly player: PlayerState,
    private readonly bus: GameBus,
  ) {}

  /** The collector in the player's hand, or null. */
  get held(): CollectorDef | null {
    return collectorOf(this.player.heldStack()?.item);
  }

  /** Use with a collector in hand. Returns false when the hand holds none (the caller falls through). */
  trigger(): boolean {
    const def = this.held;
    if (!def) return false;
    if (this.armedS <= 0) {
      this.soundT = 0;
      this.bus.emit('sfx', { name: 'machine_on', volume: 0.6, pitch: 1.4 });
    }
    this.armedS = def.burstS;
    return true;
  }

  stop(): void {
    this.armedS = 0;
    this.running = false;
  }

  /** The collectors to pass to GroundItems.tick this tick (an empty list when off). */
  tick(dt: number): readonly ActiveCollector[] {
    const none: readonly ActiveCollector[] = [];
    const def = this.held;
    if (this.armedS <= 0 || !def || this.player.dead) {
      this.stop();
      return none;
    }
    this.armedS = Math.max(0, this.armedS - dt);
    // The item may be spent by this very draw (a pump that wore out): re-check it before pulling.
    if (!drawPower(this.player, def, dt) || this.held !== def) {
      this.stop();
      return none;
    }
    this.running = true;
    this.soundT -= dt;
    if (def.sound && this.soundT <= 0) {
      this.soundT = def.soundEveryS ?? 0.6;
      const p = this.player.position;
      this.bus.emit('sfx', { name: def.sound, x: p.x, y: p.y + 1, z: p.z, volume: 0.35, pitch: 0.9 });
    }
    this.out.radius = def.radius;
    this.out.pull = def.pull;
    return [this.out];
  }

  /** Name for the HUD ("Hand Vacuum Pump"). */
  get label(): string | null {
    const def = this.held;
    return def ? itemOrNull(def.item)?.name ?? def.item : null;
  }
}
