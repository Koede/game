/**
 * The drill rig (docs/api/drill-rig.md): an electric rig that drills out the 3 by 3 shaft beneath it, layer by layer,
 * with a drill bit that blunts as it cuts.
 *
 * - Slot 0 holds the bit (only bits go there, by hand or by pipe); slots 1-9 are the buffer, take-only.
 * - The bit sets what it can cut (its tool tier) and how fast. Every block cut takes one use off the stack's
 *   `durability`; a blunt bit is used up, and the rig takes a fresh one from a crate it touches.
 * - It needs power, a bit and room in the buffer; it wears like the other machines (src/sim/wear.ts) and the buffer
 *   goes to touching crates once a second, like the bore rig's.
 * - Within a layer it cuts every cell it can; a cell it cannot (liquid, too hard, a machine) is left standing. It stops
 *   for good when the centre column reaches what it cannot cut, or the bottom of the world.
 */
import { BROWNOUT_STALL } from '../core/constants';
import { MachineStatus } from '../core/machineStatus';
import { itemOrNull } from '../core/registry';
import type { BlockDef } from '../core/types';
import { rollDrops } from '../game/mining';
import { addToSlots, roomInSlots, type MachineEntity, type SimContext, type SimNode } from './entities';
import { isBroken, speedOf } from './wear';

export interface BitSpec {
  /** Tool tier it cuts with (iron 3, steel 4): a block with a higher minTier is left standing. */
  tier: number;
  /** Cutting speed, times the rig's secondsPerBlock. */
  speed: number;
}

/** The drill bits and what they cut. Uses per bit are the item's `wear`. */
export const BITS: Readonly<Record<string, BitSpec>> = {
  drill_bit: { tier: 3, speed: 1 },
  steel_drill_bit: { tier: 4, speed: 1.5 },
};

export const BIT_SLOT = 0;
export const isDrillBit = (item: string): boolean => Object.prototype.hasOwnProperty.call(BITS, item);

/** Uses left on the bit in slot 0 (0: no bit). */
export function bitUsesLeft(e: MachineEntity): number {
  const s = e.slots[BIT_SLOT];
  if (!s || !isDrillBit(s.item)) return 0;
  return s.durability ?? itemOrNull(s.item)?.wear ?? 0;
}

/** Uses a fresh bit of this kind has. */
export const bitUses = (item: string): number => itemOrNull(item)?.wear ?? 0;

const bitOf = (e: MachineEntity): BitSpec | null => {
  const s = e.slots[BIT_SLOT];
  return s && isDrillBit(s.item) ? BITS[s.item] : null;
};

/** Why a block cannot be cut, or '' when it can. Air is not asked. */
function refusal(def: BlockDef, tier: number): string {
  if (def.liquid) return `Stopped at ${def.name.toLowerCase()}`;
  if (def.hardness < 0) return `Reached ${def.name.toLowerCase()}`;
  if (def.minTier > tier) return `${def.name} is too hard for this bit`;
  if (def.machine) return `Blocked by a ${def.name.toLowerCase()}`;
  return '';
}

export interface DrillTarget {
  x: number;
  y: number;
  z: number;
}

/**
 * The next block to cut: the first cell of the highest layer (from the layer it last worked down) that holds a block
 * it can cut. Sets `e.halted` when the centre column is stopped, or the bottom is reached.
 */
export function drillTarget(node: SimNode, ctx: SimContext): DrillTarget | null {
  const e = node.e as MachineEntity;
  const r = Math.max(0, Math.round(node.spec.params?.radius ?? 1));
  const tier = bitOf(e)?.tier ?? 0;
  const top = Math.min(e.y - 1, e.depthY);
  for (let y = top; y >= 0; y--) {
    let found: DrillTarget | null = null;
    for (let dz = -r; dz <= r && !found; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const def = ctx.world.getBlock(e.x + dx, y, e.z + dz);
        if (def.id === 0 || refusal(def, tier) !== '') continue;
        found = { x: e.x + dx, y, z: e.z + dz };
        break;
      }
    }
    if (found) {
      e.halted = '';
      return found;
    }
    // The layer is clear (or holds only what it cannot cut). The centre column decides whether to go on down.
    const centre = ctx.world.getBlock(e.x, y, e.z);
    if (centre.id !== 0) {
      const why = refusal(centre, tier);
      if (why !== '') {
        e.halted = why;
        return null;
      }
    }
    e.depthY = y;
  }
  e.halted = 'Reached the bottom';
  return null;
}

/** Takes a drill bit from a crate the rig touches into the empty bit slot. True if it did. */
function restockBit(node: SimNode, ctx: SimContext): boolean {
  const e = node.e as MachineEntity;
  if (e.slots[BIT_SLOT]) return false;
  for (const crate of node.crates) {
    for (let i = 0; i < crate.slots.length; i++) {
      const s = crate.slots[i];
      if (!s || !isDrillBit(s.item)) continue;
      if (s.count > 1) {
        s.count -= 1;
        e.slots[BIT_SLOT] = { item: s.item, count: 1 };
      } else {
        e.slots[BIT_SLOT] = s;
        crate.slots[i] = null;
      }
      ctx.touch(crate);
      ctx.touch(e);
      return true;
    }
  }
  return false;
}

/** Takes one use off the bit; a blunt one is used up. */
function bluntBit(node: SimNode, ctx: SimContext): void {
  const e = node.e as MachineEntity;
  const s = e.slots[BIT_SLOT];
  if (!s) return;
  const left = bitUsesLeft(e) - 1;
  if (left > 0) {
    s.durability = left;
    return;
  }
  e.slots[BIT_SLOT] = null;
  ctx.bus.emit('toast', { text: 'A drill bit wore out', kind: 'info' });
  restockBit(node, ctx);
}

const bufferFull = (e: MachineEntity): boolean => {
  for (let i = BIT_SLOT + 1; i < e.slots.length; i++) if (e.slots[i] === null) return false;
  return true;
};

export const drillRig = {
  prepare(node: SimNode, ctx: SimContext): void {
    const e = node.e as MachineEntity;
    if (!bitOf(e) && ctx.everySecond) restockBit(node, ctx);
    const bit = bitOf(e);
    // The shaft is only looked at when a block is due (and once a second while stopped), not every tick.
    if (bit && e.halted !== '' && ctx.everySecond) drillTarget(node, ctx);
    if (!bit && e.halted === '') e.halted = 'Needs a drill bit';
    else if (bit && e.halted === 'Needs a drill bit') e.halted = '';
    node.job = null;
    e.demandW = e.on && bit && e.halted === '' && !bufferFull(e) && !isBroken(e) ? node.spec.drawW ?? 0 : 0;
  },
  apply(node: SimNode, ctx: SimContext, dt: number): void {
    const e = node.e as MachineEntity;
    e.f = node.net ? node.net.f : 0;
    const running = e.demandW > 0 && e.f >= BROWNOUT_STALL;
    const noBit = e.halted === 'Needs a drill bit';
    const status = e.demandW > 0 || (e.on && noBit) ? MachineStatus.Starved : e.on && e.halted === '' && bufferFull(e) ? MachineStatus.Full : MachineStatus.None;
    ctx.setActive(node, running, status);
    if (running) {
      const bit = bitOf(e);
      e.progress += dt * e.f * speedOf(e) * (bit?.speed ?? 1);
      if (e.progress >= (node.spec.params?.secondsPerBlock ?? 1)) {
        e.progress = 0;
        const t = drillTarget(node, ctx);
        if (t) {
          const def = ctx.world.getBlock(t.x, t.y, t.z);
          const drops = rollDrops(def, ctx.random);
          let fits = true;
          const buffer = e.slots.slice(BIT_SLOT + 1);
          for (const d of drops) if (roomInSlots(buffer, d.item) < d.count) fits = false;
          if (fits) {
            ctx.world.setVoxel(t.x, t.y, t.z, 0, 'sim');
            for (const d of drops) addToSlots(buffer, d.item, d.count);
            for (let i = 0; i < buffer.length; i++) e.slots[BIT_SLOT + 1 + i] = buffer[i];
            e.depthY = t.y;
            bluntBit(node, ctx);
            ctx.touch(e);
            ctx.flagOnce('drill_rig_cut');
            ctx.bus.emit('sfx', { name: 'dig_stone', x: t.x, y: t.y, z: t.z, volume: 0.45 });
          }
        }
      }
    }
    if (ctx.everySecond && e.slots.some((s, i) => i > BIT_SLOT && s !== null)) ctx.pushToCrates(node, BIT_SLOT + 1, e.slots.length);
  },
};
