/**
 * The casting bench (docs/api/handwork-content.md section 4). Up to four fired moulds sit in its sockets. Use with a
 * mould in hand adds it; Use with an empty hand takes the last one out. An empty hand taking molten metal from a
 * furnace within CASTING_BENCH_RANGE pours one cast into each mould, in order, instead of needing a mould in hand.
 * The bench is not a hand station and not a power node: its machine entity is stored and spilled, nothing else.
 */
import { CASTING_BENCH_RANGE } from '../core/constants';
import { castOf, machine, mouldOf } from '../core/registry';
import type { IWorld, Slot } from '../core/types';
import type { PlayerState } from '../game/playerState';
import { benchMetalRefusal, emitPour, metalOfIngot, needsMolten, wearMould } from './casting';
import {
  OK, createMachine, posKey, refuse, type ActionResult, type FurnaceEntity, type MachineEntity, type SimContext,
} from './entities';
import { sanitizeEntity } from './sanitize';

export const CASTING_BENCH = 'casting_bench';
const SLOT_COUNT = machine(CASTING_BENCH).slots ?? 4;

/** What a removed bench held, spilled beside it (nothing while blocks are exploding). */
export type BenchRelease = (x: number, y: number, z: number, held: readonly Slot[]) => void;

const nearer = (a: MachineEntity, b: MachineEntity): boolean =>
  a.x < b.x || (a.x === b.x && (a.y < b.y || (a.y === b.y && a.z < b.z)));

const mouldStack = (item: string, durability: number | undefined): Exclude<Slot, null> =>
  durability === undefined ? { item, count: 1 } : { item, count: 1, durability };

export class CastingBenches {
  private readonly byKey = new Map<string, MachineEntity>();

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
    private readonly release: BenchRelease,
  ) {}

  clear(): void {
    this.byKey.clear();
  }

  track(e: MachineEntity): void {
    if (e.slots.length !== SLOT_COUNT) sanitizeEntity(e);
    this.byKey.set(posKey(e.x, e.y, e.z), e);
  }

  /** A new bench keeps the entity already stored there (a save) or stores a fresh one with four sockets. */
  place(x: number, y: number, z: number): void {
    const key = posKey(x, y, z);
    if (this.byKey.has(key)) return;
    const stored = this.world.getEntity(x, y, z);
    if (stored && stored.kind === CASTING_BENCH) {
      sanitizeEntity(stored);
      this.track(stored as MachineEntity);
      return;
    }
    const e = createMachine(CASTING_BENCH, x, y, z);
    this.world.setEntity(e);
    this.track(e);
  }

  /** The bench block went away: its moulds spill and it leaves the world. */
  removeAt(x: number, y: number, z: number): void {
    const e = this.byKey.get(posKey(x, y, z));
    if (!e) return;
    this.byKey.delete(posKey(x, y, z));
    if (this.world.getEntity(x, y, z) === e) this.world.removeEntity(x, y, z);
    this.release(x, y, z, e.slots);
  }

  /**
   * Use on the bench at x, y, z. A fired mould fills the first empty socket (its pours left move with it). An empty
   * hand takes the last mould back. Any other held item returns null so Use can place that block.
   */
  use(x: number, y: number, z: number, heldKey: string | null): ActionResult | null {
    const held = heldKey ? heldKey : null;
    if (held !== null && !mouldOf(held)) return null;
    const e = this.byKey.get(posKey(x, y, z));
    if (!e) return refuse('There is no casting bench here');
    return held === null ? this.take(e) : this.set(e, held);
  }

  /**
   * Empty-hand take of crucible `slot`. The nearest bench within range that holds a mould pours one cast into each
   * occupied socket, in order. Null when no such bench exists (the furnace screen opens as usual).
   */
  pour(ctx: SimContext, furnace: FurnaceEntity, slot: number): ActionResult | null {
    if (!Number.isInteger(slot) || slot < 0 || slot >= furnace.crucibleMelt.length) return refuse('There is no such crucible');
    const melt = furnace.crucibleMelt[slot];
    if (!melt || furnace.crucibleMoltenS[slot] <= 0) {
      return refuse(furnace.crucibleOut[slot] ? 'It has gone cold - smelt the bloom again' : 'Nothing molten there');
    }
    const bench = this.nearest(furnace);
    if (!bench) return null;
    const ingot = melt.item;
    const metal = metalOfIngot(ingot);
    if (!metal) return refuse(benchMetalRefusal(ingot));
    const pos = { x: furnace.x, y: furnace.y, z: furnace.z };
    let poured = 0;
    let firstWrong: string | null = null;
    let stop: string | null = null;
    for (let i = 0; i < bench.slots.length; i++) {
      const stack = bench.slots[i];
      if (!stack) continue;
      const cast = castOf(stack.item, ingot);
      if (!cast) {
        if (firstWrong === null) firstWrong = benchMetalRefusal(ingot);
        continue;
      }
      const have = furnace.crucibleMelt[slot]?.count ?? 0;
      if (have < cast.units) {
        stop = needsMolten(cast.units, ingot, have);
        break;
      }
      if (ctx.player.inventory.space(cast.item) < 1) {
        stop = 'Your pack is full';
        break;
      }
      const mouldKey = stack.item;
      ctx.player.inventory.add(cast.item, 1);
      const pool = furnace.crucibleMelt[slot];
      if (pool) {
        pool.count -= cast.units;
        if (pool.count <= 0) {
          furnace.crucibleMelt[slot] = null;
          furnace.crucibleMoltenS[slot] = 0;
        }
      }
      if (wearMould(stack, 1).broke) {
        bench.slots[i] = null;
        ctx.bus.emit('tool:broke', { item: mouldKey });
      }
      emitPour(ctx, pos, mouldKey, metal.key, cast.item, 1, 'bench');
      poured++;
    }
    if (poured > 0) ctx.touch(furnace);
    if (stop) return refuse(stop);
    if (poured === 0) return refuse(firstWrong ?? benchMetalRefusal(ingot));
    return OK;
  }

  private set(e: MachineEntity, held: string): ActionResult {
    const empty = e.slots.findIndex((s) => !s);
    if (empty < 0) return refuse(`The casting bench holds ${SLOT_COUNT} moulds`);
    const inHand = this.player.heldStack();
    if (!inHand || inHand.item !== held) return refuse('You have no mould in hand');
    const durability = inHand.durability;
    this.player.consumeHeld(1);
    e.slots[empty] = mouldStack(held, durability);
    return OK;
  }

  private take(e: MachineEntity): ActionResult {
    let last = -1;
    for (let i = e.slots.length - 1; i >= 0; i--) {
      if (!e.slots[i]) continue;
      last = i;
      break;
    }
    if (last < 0) return refuse('The casting bench is empty');
    const stack = e.slots[last];
    if (!stack) return refuse('The casting bench is empty');
    if (this.player.inventory.space(stack.item) < stack.count) return refuse('Your pack is full');
    e.slots[last] = null;
    this.player.give(stack.item, stack.count, stack.durability);
    return OK;
  }

  /** Chebyshev distance, then the smaller x, y and z. Only a bench that actually holds a mould. */
  private nearest(origin: { x: number; y: number; z: number }): MachineEntity | null {
    let best: MachineEntity | null = null;
    let bestD = CASTING_BENCH_RANGE + 1;
    for (const e of this.byKey.values()) {
      if (!e.slots.some((s) => s && mouldOf(s.item))) continue;
      const d = Math.max(Math.abs(e.x - origin.x), Math.abs(e.y - origin.y), Math.abs(e.z - origin.z));
      if (d > CASTING_BENCH_RANGE || d > bestD) continue;
      if (d === bestD && best && !nearer(e, best)) continue;
      best = e;
      bestD = d;
    }
    return best;
  }
}
