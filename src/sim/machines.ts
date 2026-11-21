/**
 * Behaviour of every machine except the furnace and the fission pile (spec 2.5). Each behaviour has two halves:
 * `prepare` states what the machine can generate or wants to draw this tick, `apply` runs after the network
 * was solved and does the work. All numbers come from the registry.
 */
import { BROWNOUT_STALL } from '../core/constants';
import { RECIPES, fuelOf, itemOrNull } from '../core/registry';
import type { MachineSpec, RecipeDef } from '../core/types';
import { rollDrops } from '../game/mining';
import { addToSlots, roomInSlots, type MachineEntity, type SimContext, type SimNode } from './entities';
import { powered } from './power';

export interface Behaviour {
  prepare(node: SimNode, ctx: SimContext): void;
  apply(node: SimNode, ctx: SimContext, dt: number): void;
}

const NON_MACHINE_STATIONS = new Set(['hand', 'workbench', 'furnace']);
const machineRecipes = new Map<string, Map<string, RecipeDef>>();
for (const r of RECIPES) {
  if (NON_MACHINE_STATIONS.has(r.station)) continue;
  let byInput = machineRecipes.get(r.station);
  if (!byInput) machineRecipes.set(r.station, (byInput = new Map()));
  byInput.set(r.inputs[0].item, r);
}

/** The recipe a processing machine of `kind` runs on this input item. */
export const machineRecipeFor = (kind: string, itemKey: string): RecipeDef | null => machineRecipes.get(kind)?.get(itemKey) ?? null;
export const isProcessor = (kind: string): boolean => machineRecipes.has(kind);

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** What is wrong with where a machine stands, or null. Shown on its screen. */
export function placementProblem(node: SimNode): string | null {
  const p = node.spec.params ?? {};
  switch (node.spec.kind) {
    case 'thermopile':
      return node.furnaces.length > 0 ? null : 'Must touch a furnace';
    case 'steam_engine':
      if (node.furnaces.length === 0) return 'Must sit on top of a furnace';
      return node.sideWater >= p.minWater ? null : 'Needs water on one side';
    case 'water_wheel':
    case 'fission_pile':
      return node.water >= p.minWater ? null : `Needs water on ${p.minWater} sides (${node.water} now)`;
    case 'electrolyzer':
      return node.water >= p.minWater ? null : 'Must touch water';
    case 'wind_turbine':
    case 'solar_panel':
      return node.openSky ? null : 'Needs open sky above';
    case 'geothermal_tap':
      return node.lava > 0 ? null : 'Must touch lava';
    case 'blower':
      return node.furnaces.length > 0 ? null : 'Must touch a furnace';
    default:
      return null;
  }
}

// ---- generators -------------------------------------------------------------------------------------------

/** Thermopile and steam engine: watts from the heat of a furnace, which they cool in return. */
const heatEngine: Behaviour = {
  prepare(node) {
    const e = node.e as MachineEntity;
    const p = node.spec.params ?? {};
    let hottest = node.furnaces.length > 0 ? node.furnaces[0] : null;
    for (const fe of node.furnaces) if (hottest && fe.tempC > hottest.tempC) hottest = fe;
    const ok = e.on && hottest !== null && (p.minWater === undefined || node.sideWater >= p.minWater);
    const w = ok && hottest ? clamp(p.wattsPerC * (hottest.tempC - p.minTempC), 0, p.capW) : 0;
    e.availW = w;
    if (w > 0 && hottest) hottest.extractW += p.heatPerWatt * w;
  },
  apply: followLoad,
};

function followLoad(node: SimNode, ctx: SimContext): void {
  const e = node.e as MachineEntity;
  e.outW = e.availW * (node.net ? node.net.load : 0);
  ctx.setActive(node, e.availW > 0);
}

const ambient = (watts: (node: SimNode, ctx: SimContext, spec: MachineSpec) => number): Behaviour => ({
  prepare(node, ctx) {
    const e = node.e as MachineEntity;
    e.availW = e.on ? Math.max(0, watts(node, ctx, node.spec)) : 0;
  },
  apply: followLoad,
});

const waterWheel = ambient((n, _c, s) => (n.water >= (s.params?.minWater ?? 0) ? (s.outputW ?? 0) / Math.max(1, n.wheels) : 0));
const windTurbine = ambient((n, ctx, s) => {
  const p = s.params ?? {};
  if (!n.openSky) return 0;
  return (s.outputW ?? 0) * ctx.wind * clamp((n.e.y - p.altitudeBaseY) / p.altitudeSpanY, p.altitudeMin, p.altitudeMax);
});
const solarPanel = ambient((n, ctx, s) => (n.openSky && ctx.sunlight > (s.params?.minSunlight ?? 0) ? (s.outputW ?? 0) * ctx.sunlight : 0));
const geothermalTap = ambient((n, _c, s) => Math.min(s.params?.capW ?? 0, (s.params?.wattsPerLava ?? 0) * n.lava));

/** Wind factor at a world time: a slow, deterministic wander between `min` and `max`. */
export function windAt(timeS: number, min: number, max: number): number {
  const n = 0.5 + 0.3 * Math.sin(timeS / 97) + 0.2 * Math.sin(timeS / 41 + 1.3);
  return min + (max - min) * n;
}

/** Electric joules one fuel item is worth in this generator. */
export function fuelEnergyJ(spec: MachineSpec, itemKey: string): number {
  if (!spec.fuels || !spec.fuels.includes(itemKey)) return 0;
  const heat = spec.params?.fuelEnergyJ ?? spec.params?.rodEnergyJ ?? fuelOf(itemKey)?.energyJ ?? 0;
  return heat * (spec.efficiency ?? 1);
}

export const holdsFuel = (node: SimNode): boolean => {
  const e = node.e as MachineEntity;
  const s = e.slots[0];
  return e.fuelJ > 0 || (s !== null && s !== undefined && fuelEnergyJ(node.spec, s.item) > 0);
};

/** Takes `joules` of electricity out of the fuel, loading the next item from the slot when one runs out. */
export function burnFuel(node: SimNode, ctx: SimContext, joules: number): void {
  const e = node.e as MachineEntity;
  let need = joules;
  while (need > 0) {
    if (e.fuelJ <= 0) {
      const s = e.slots[0];
      const worth = s ? fuelEnergyJ(node.spec, s.item) : 0;
      if (!s || worth <= 0) return;
      s.count--;
      if (s.count <= 0) e.slots[0] = null;
      e.fuelJ = worth;
      ctx.touch(e);
    }
    const use = Math.min(need, e.fuelJ);
    e.fuelJ -= use;
    need -= use;
  }
}

/** Burner generator and combustion engine: full output while they hold fuel, burning in proportion to the load. */
const fuelGenerator: Behaviour = {
  prepare(node) {
    const e = node.e as MachineEntity;
    e.availW = e.on && holdsFuel(node) ? node.spec.outputW ?? 0 : 0;
  },
  apply(node, ctx, dt) {
    const e = node.e as MachineEntity;
    e.outW = e.availW * (node.net ? node.net.load : 0);
    if (e.outW > 0) burnFuel(node, ctx, e.outW * dt);
    ctx.setActive(node, e.outW > 0);
  },
};

// ---- storage and simple consumers ---------------------------------------------------------------------------

/** Batteries are moved by the network solver itself. */
const storage: Behaviour = { prepare() {}, apply() {} };
const inert: Behaviour = storage;

/** Lamp and space heater: draw power, and are "active" (lit, warm) while they get enough of it. */
const simpleConsumer: Behaviour = {
  prepare(node) {
    const e = node.e as MachineEntity;
    e.demandW = e.on ? node.spec.drawW ?? 0 : 0;
  },
  apply(node, ctx) {
    const e = node.e as MachineEntity;
    e.f = node.net ? node.net.f : 0;
    ctx.setActive(node, e.demandW > 0 && powered(node.net));
  },
};

const blower: Behaviour = {
  prepare(node) {
    const e = node.e as MachineEntity;
    e.demandW = e.on && node.furnaces.length > 0 ? node.spec.drawW ?? 0 : 0;
  },
  apply(node, ctx) {
    const e = node.e as MachineEntity;
    e.f = node.net ? node.net.f : 0;
    const running = e.demandW > 0 && powered(node.net);
    if (running) {
      const floor = (node.spec.params?.draftFloor ?? 0) * e.f;
      for (const fe of node.furnaces) if (fe.draft < floor) fe.draft = floor;
    }
    ctx.setActive(node, running);
  },
};

// ---- processors -----------------------------------------------------------------------------------------------

/** Crusher, still, centrifuge, electrolyzer: slot 0 in, slot 1 out, one recipe per input item. */
const processor: Behaviour = {
  prepare(node) {
    const e = node.e as MachineEntity;
    const inp = e.slots[0];
    let r = inp ? machineRecipeFor(e.kind, inp.item) : null;
    if (r && inp && inp.count < r.inputs[0].count) r = null;
    if ((r ? r.id : null) !== e.recipe) {
      e.recipe = r ? r.id : null;
      e.progress = 0;
    }
    const minWater = node.spec.params?.minWater;
    const blocked = !e.on || r === null || (minWater !== undefined && node.water < minWater) || roomInSlots(e.slots, r.output.item, 1, 2) < r.output.count;
    node.job = blocked ? null : r;
    e.demandW = blocked ? 0 : node.spec.drawW ?? 0;
  },
  apply(node, ctx, dt) {
    const e = node.e as MachineEntity;
    const r = node.job;
    e.f = node.net ? node.net.f : 0;
    const running = r !== null && e.f >= BROWNOUT_STALL;
    ctx.setActive(node, running);
    if (r && running) {
      e.progress += dt * e.f;
      if (e.progress >= r.timeS) {
        e.progress = 0;
        const inp = e.slots[0];
        if (inp) {
          inp.count -= r.inputs[0].count;
          if (inp.count <= 0) e.slots[0] = null;
        }
        addToSlots(e.slots, r.output.item, r.output.count, 1, 2);
        ctx.pushToCrates(node, 1, 2);
        ctx.touch(e);
        ctx.bus.emit('machine:job', { kind: e.kind, x: e.x, y: e.y, z: e.z, item: r.output.item });
        ctx.bus.emit('item:made', { item: r.output.item, count: r.output.count, station: e.kind, recipeId: r.id });
        ctx.bus.emit('sfx', { name: 'machine_done', x: e.x, y: e.y, z: e.z });
        ctx.flagOnce('machine_job');
      }
    }
    if (ctx.everySecond && e.slots[1]) ctx.pushToCrates(node, 1, 2);
  },
};

// ---- bore rig -------------------------------------------------------------------------------------------------

/** Finds the next block under the rig. Returns its y, or -1 with `e.halted` set when the rig cannot go on. */
function boreTarget(node: SimNode, ctx: SimContext): number {
  const e = node.e as MachineEntity;
  const toolTier = node.spec.params?.toolTier ?? 0;
  for (let y = e.y - 1; y >= 0; y--) {
    const def = ctx.world.getBlock(e.x, y, e.z);
    if (def.id === 0) continue;
    if (def.liquid) e.halted = `Stopped at ${def.name.toLowerCase()}`;
    else if (def.hardness < 0) e.halted = `Reached ${def.name.toLowerCase()}`;
    else if (def.minTier > toolTier) e.halted = `${def.name} is too hard for the bore`;
    else if (def.machine) e.halted = `Blocked by a ${def.name.toLowerCase()}`;
    else {
      e.halted = '';
      return y;
    }
    return -1;
  }
  e.halted = 'Reached the bottom';
  return -1;
}

const boreRig: Behaviour = {
  prepare(node, ctx) {
    const e = node.e as MachineEntity;
    // The column is only looked at when a block is due (and once a second while stopped), not every tick.
    if (e.halted !== '' && ctx.everySecond) boreTarget(node, ctx);
    const full = e.slots.every((s) => s !== null);
    node.job = null;
    e.demandW = e.on && e.halted === '' && !full ? node.spec.drawW ?? 0 : 0;
  },
  apply(node, ctx, dt) {
    const e = node.e as MachineEntity;
    e.f = node.net ? node.net.f : 0;
    const running = e.demandW > 0 && e.f >= BROWNOUT_STALL;
    ctx.setActive(node, running);
    if (running) {
      e.progress += dt * e.f;
      if (e.progress >= (node.spec.params?.secondsPerBlock ?? 1)) {
        e.progress = 0;
        const y = boreTarget(node, ctx);
        if (y >= 0) {
          const def = ctx.world.getBlock(e.x, y, e.z);
          const drops = rollDrops(def, ctx.random);
          let fits = true;
          for (const d of drops) if (roomInSlots(e.slots, d.item) < d.count) fits = false;
          if (fits) {
            ctx.world.setVoxel(e.x, y, e.z, 0, 'sim');
            for (const d of drops) addToSlots(e.slots, d.item, d.count);
            e.depthY = y;
            ctx.touch(e);
            ctx.bus.emit('sfx', { name: 'dig_stone', x: e.x, y, z: e.z, volume: 0.5 });
          }
        }
      }
    }
    if (ctx.everySecond && e.slots.some((s) => s !== null)) ctx.pushToCrates(node, 0, e.slots.length);
  },
};

// ---- table ----------------------------------------------------------------------------------------------------

const BEHAVIOURS: Record<string, Behaviour> = {
  crate: inert,
  thermopile: heatEngine,
  steam_engine: heatEngine,
  burner_generator: fuelGenerator,
  combustion_engine: fuelGenerator,
  water_wheel: waterWheel,
  wind_turbine: windTurbine,
  solar_panel: solarPanel,
  geothermal_tap: geothermalTap,
  battery: storage,
  lithium_bank: storage,
  lamp: simpleConsumer,
  space_heater: simpleConsumer,
  blower,
  bore_rig: boreRig,
};

/** The behaviour of a machine kind (the fission pile has its own file). Unknown kinds do nothing. */
export function behaviourOf(kind: string): Behaviour {
  return BEHAVIOURS[kind] ?? (isProcessor(kind) ? processor : inert);
}

/** Display name of an item for status texts. */
export const itemName = (key: string): string => itemOrNull(key)?.name ?? key;
