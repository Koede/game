/**
 * What a broken machine held goes to the player's pack; whatever the pack has no room for is never deleted - it is put
 * into a crate where the machine stood (or the nearest free cell) on the next tick. The crate is placed a tick later
 * because the break is still being announced ('block:changed') when the contents are handed over.
 */
import type { GameBus } from '../core/context';
import { blockId, blockOf, machine } from '../core/registry';
import { WORLD_HEIGHT, makeVoxel, voxelId, type IWorld, type Slot } from '../core/types';
import { MAX_GROUND_ITEMS } from '../game/groundItems';
import { stackLimit } from '../game/inventory';
import type { PlayerState } from '../game/playerState';
import { createMachine } from './entities';

const CRATE_SLOTS = machine('crate').slots ?? 27;
const CRATE = blockId('crate');
/** How far from the broken machine a spill crate may go when its own cell is taken. */
const REACH = 2;

interface Spill {
  x: number;
  y: number;
  z: number;
  stacks: Slot[];
}

/** Gives the player what fits of each stack and returns what is left over (stacks with the remaining counts). */
export function handOver(player: PlayerState, held: readonly Slot[]): Slot[] {
  const left: Slot[] = [];
  for (const s of held) {
    if (!s || s.count <= 0) continue;
    const fit = Math.min(s.count, player.inventory.space(s.item));
    const missed = fit > 0 ? player.give(s.item, fit, s.durability) : 0;
    const rest = s.count - fit + missed;
    if (rest > 0) left.push({ ...s, count: rest });
  }
  return left;
}

/** Cells around (x, y, z) nearest first, the cell itself included. */
const OFFSETS: Array<[number, number, number]> = [];
for (let dy = -REACH; dy <= REACH; dy++) {
  for (let dx = -REACH; dx <= REACH; dx++) for (let dz = -REACH; dz <= REACH; dz++) OFFSETS.push([dx, dy, dz]);
}
OFFSETS.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) + Math.abs(a[2]) - (Math.abs(b[0]) + Math.abs(b[1]) + Math.abs(b[2])) || b[1] - a[1]);

export class Spills {
  private readonly pending: Spill[] = [];

  constructor(
    private readonly world: IWorld,
    private readonly bus: GameBus,
    private readonly player: PlayerState,
  ) {}

  /**
   * Stacks the pack had no room for: they drop out of the broken block as ground items. Only what the ground list has
   * no room for (it is capped) is kept to be put into crates around (x, y, z) on the next `place()`.
   */
  add(x: number, y: number, z: number, stacks: Slot[]): void {
    const rest = this.toGround(x, y, z, stacks);
    if (rest.length > 0) this.pending.push({ x, y, z, stacks: rest });
  }

  /** Everything a broken machine held drops as ground items (the pack is not touched). */
  release(x: number, y: number, z: number, held: readonly Slot[]): void {
    this.add(x, y, z, held.filter((s): s is NonNullable<Slot> => s !== null && s.count > 0));
  }

  /** Spawns what the ground list has room for; returns the rest. */
  private toGround(x: number, y: number, z: number, stacks: Slot[]): Slot[] {
    const ground = this.player.ground;
    let room = MAX_GROUND_ITEMS - ground.size;
    const rest: Slot[] = [];
    for (const s of stacks) {
      if (!s || s.count <= 0) continue;
      const need = Math.ceil(s.count / Math.max(1, stackLimit(s.item)));
      if (need > room) {
        rest.push(s);
        continue;
      }
      room -= need;
      ground.spawn(s.item, s.count, x + 0.5, y + 0.5, z + 0.5, { durability: s.durability });
    }
    return rest;
  }

  /** Puts every pending spill into crates (called at the start of a tick). */
  place(): void {
    if (this.pending.length === 0) return;
    for (const spill of this.pending.splice(0)) {
      let crates = 0;
      for (let i = 0; i < spill.stacks.length; i += CRATE_SLOTS) {
        const cell = this.freeCell(spill.x, spill.y, spill.z);
        const part = spill.stacks.slice(i, i + CRATE_SLOTS);
        if (!cell) {
          // Nowhere to put a crate (fully walled in, or the chunk is gone): the pack gets one more try.
          for (const s of part) if (s) this.player.give(s.item, s.count, s.durability);
          continue;
        }
        const crate = createMachine('crate', cell[0], cell[1], cell[2]);
        part.forEach((s, k) => (crate.slots[k] = s));
        // The simulation adopts the stored crate when its block appears.
        this.world.setEntity(crate);
        if (this.world.setVoxel(cell[0], cell[1], cell[2], makeVoxel(CRATE), 'sim')) crates++;
        else {
          this.world.removeEntity(cell[0], cell[1], cell[2]);
          for (const s of part) if (s) this.player.give(s.item, s.count, s.durability);
        }
      }
      if (crates > 0) {
        this.bus.emit('toast', {
          text: crates === 1 ? 'Pack and ground are full - the rest is left in a crate' : `Pack and ground are full - the rest is left in ${crates} crates`,
          kind: 'warn', item: 'crate',
        });
      }
    }
  }

  private freeCell(x: number, y: number, z: number): [number, number, number] | null {
    for (const [dx, dy, dz] of OFFSETS) {
      const cx = x + dx;
      const cy = y + dy;
      const cz = z + dz;
      if (cy < 0 || cy >= WORLD_HEIGHT || !this.world.isLoaded(cx, cz) || this.world.getEntity(cx, cy, cz)) continue;
      const v = this.world.getVoxel(cx, cy, cz);
      const def = blockOf(v);
      if (voxelId(v) === 0 || (def.replaceable && !def.solid && def.machine === null && def.pipe === null)) return [cx, cy, cz];
    }
    return null;
  }
}
