/**
 * Stacked tanks (spec 16.1): tanks standing on each other share one fluid and one level. The stack is the column of
 * touching tanks around the one asked about, as far as they hold the same fluid (or nothing); it fills from the
 * bottom up and drains from the top down, so its level is the same however it is reached - a pipe on any tank, or a
 * bucket. Each tank's part is kept in its own `fluidIn` (saved with it); breaking a tank loses what it held.
 */
import { machine } from '../core/registry';
import type { FluidKey } from '../core/types';
import type { FluidEndpoint } from './endpoints';
import type { FluidStack, MachineEntity } from './entities';

const TANK = machine('tank');
const TANK_L = TANK.fluids?.capacityL ?? 0;
const TAKES = new Set<FluidKey>(TANK.fluids?.accepts ?? []);

export type TankAt = (x: number, y: number, z: number) => MachineEntity | null;

/** The tanks of the stack around (x, y, z), bottom first; empty when there is no tank there. */
export function tankColumn(tankAt: TankAt, x: number, y: number, z: number): MachineEntity[] {
  const self = tankAt(x, y, z);
  if (!self) return [];
  let fluid: FluidKey | null = self.fluidIn && self.fluidIn.litres > 0 ? self.fluidIn.fluid : null;
  const fits = (t: MachineEntity): boolean => {
    const f = t.fluidIn && t.fluidIn.litres > 0 ? t.fluidIn.fluid : null;
    if (f === null || fluid === null || f === fluid) {
      fluid = fluid ?? f;
      return true;
    }
    return false;
  };
  const below: MachineEntity[] = [];
  for (let yy = y - 1; ; yy--) {
    const t = tankAt(x, yy, z);
    if (!t || !fits(t)) break;
    below.push(t);
  }
  const above: MachineEntity[] = [];
  for (let yy = y + 1; ; yy++) {
    const t = tankAt(x, yy, z);
    if (!t || !fits(t)) break;
    above.push(t);
  }
  return [...below.reverse(), self, ...above];
}

/** What a stack holds: its fluid, litres and capacity. */
export function stackContent(tanks: readonly MachineEntity[]): { fluid: FluidKey | null; litres: number; capacityL: number } {
  let fluid: FluidKey | null = null;
  let litres = 0;
  for (const t of tanks) {
    if (!t.fluidIn || t.fluidIn.litres <= 0) continue;
    fluid = t.fluidIn.fluid;
    litres += t.fluidIn.litres;
  }
  return { fluid, litres, capacityL: tanks.length * TANK_L };
}

/** Sets a stack to hold `litres` of `fluid`, bottom tanks full first. */
function level(tanks: readonly MachineEntity[], fluid: FluidKey, litres: number): void {
  let left = litres;
  for (const t of tanks) {
    const put = Math.min(TANK_L, left);
    left -= put;
    if (put <= 0) t.fluidIn = null;
    else if (t.fluidIn) {
      const b: FluidStack = t.fluidIn;
      b.fluid = fluid;
      b.litres = put;
    } else t.fluidIn = { fluid, litres: put };
  }
}

/** The fluid endpoint of a whole stack (reached through any of its tanks). */
export function tankStackEndpoint(tanks: readonly MachineEntity[]): FluidEndpoint | null {
  if (tanks.length === 0) return null;
  const capacity = tanks.length * TANK_L;
  const content = (): { fluid: FluidKey | null; litres: number } => stackContent(tanks);
  return {
    entity: tanks[0],
    room(fluid) {
      if (!TAKES.has(fluid)) return 0;
      const c = content();
      return c.fluid === null || c.fluid === fluid ? Math.max(0, capacity - c.litres) : 0;
    },
    fill(fluid, litres) {
      const n = Math.min(litres, this.room(fluid));
      if (n <= 0) return 0;
      level(tanks, fluid, content().litres + n);
      return n;
    },
    offer() {
      const c = content();
      return c.fluid !== null && c.litres > 0 ? { fluid: c.fluid, litres: c.litres } : null;
    },
    drain(fluid, litres) {
      const c = content();
      if (c.fluid !== fluid) return 0;
      const n = Math.min(litres, c.litres);
      if (n <= 0) return 0;
      level(tanks, fluid, c.litres - n);
      return n;
    },
  };
}
