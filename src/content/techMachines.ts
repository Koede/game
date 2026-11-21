/**
 * Machines of item and fluid transport (spec 16) and the parts of multiblock hearths (spec 17). Behaviour lives in
 * src/sim; it reads these numbers through `machine(kind)`. Pipes are not machines: their numbers are on the pipe
 * blocks (BlockSpec.pipe), the network caps in core/constants (PIPE_*), the hearth rules on FurnaceTierSpec.structure
 * and core/constants (HEARTH_*).
 */
import { LITRES_PER_BUCKET } from '../core/constants';
import type { MachineSpec } from '../core/types';

export const TECH_MACHINES: MachineSpec[] = [
  // pump - a consumer that fills its buffer from the liquid source it touches and gives it to pulling pipes. A water
  // source with two sources beside it never runs dry (it would refill by the flow rules, spec 18.3); lone water
  // sources, lava and oil blocks are removed as they are drained, the farthest connected source first. params:
  //   litresPerS        litres drawn per second while powered (scaled by the network's satisfaction)
  //   litresPerBlock    litres in one source block (removed once that much is drawn)
  //   searchLimit       most source blocks the breadth-first search for the next block to drain may visit
  {
    kind: 'pump', name: 'Pump', role: 'consumer', blocks: ['pump'], drawW: 50,
    params: { litresPerS: 200, litresPerBlock: LITRES_PER_BUCKET, searchLimit: 32 },
    fluids: { gives: ['water', 'lava', 'crude_oil'], capacityL: 1000 },
    desc: 'Draws 50 W and pumps 200 litres a second of the still liquid it touches. Water with two sources beside it never runs dry; every 1000 litres of a lone source, lava or oil uses up a block.',
    placementHint: 'Must touch still water, lava or oil.',
  },
  // tank - one fluid at a time; vertically stacked tanks share one fluid and one level (their capacities add up).
  {
    kind: 'tank', name: 'Tank', role: 'tank', blocks: ['tank'],
    fluids: { accepts: ['water', 'lava', 'steam', 'crude_oil', 'fuel'], gives: ['water', 'lava', 'steam', 'crude_oil', 'fuel'], capacityL: 16_000 },
    desc: 'Holds 16 000 litres of any one fluid. Stack tanks to share one level, and fill or empty them with pipes or buckets.',
  },
  // boiler - sits directly on top of a furnace or a hearth's ceiling and turns its heat into steam, drawing heat like a
  // heat engine (it lowers the fire as it works). Steam per second = clamp(steamLPerC * (T - minTempC), 0, capLPerS),
  // limited by the water it holds. params:
  //   minTempC       furnace temperature at which it starts to boil
  //   steamPerWater  litres of steam from one litre of water
  //   steamLPerC     litres of steam per second for every degree above minTempC
  //   capLPerS       most steam it makes per second
  //   heatPerSteamL  joules of heat taken from the furnace per litre of steam (a turbine makes 10 J of power per litre)
  {
    kind: 'boiler', name: 'Boiler', role: 'boiler', blocks: ['boiler'],
    params: { minTempC: 200, steamPerWater: 10, steamLPerC: 1, capLPerS: 800, heatPerSteamL: 20 },
    fluids: { accepts: ['water'], gives: ['steam'], capacityL: 1000 },
    desc: 'Boils piped water into ten times as much steam with the heat of the furnace below it: up to 800 litres a second, taking 20 J of heat for every litre.',
    placementHint: 'Goes directly on top of a furnace or a hearth.',
  },
  // steam_turbine - output = outputW * min(1, steam used per second / steamLPerS); it takes steam through a hot pipe.
  // params:
  //   steamLPerS  steam per second at full output
  {
    kind: 'steam_turbine', name: 'Steam Turbine', role: 'generator', blocks: ['steam_turbine'], outputW: 8000,
    params: { steamLPerS: 800 },
    fluids: { accepts: ['steam'], capacityL: 1000 },
    desc: 'Makes up to 8 kW from 800 litres of steam a second, and less from less. Steam comes from boilers through a hot pipe.',
  },

  // ---- hearth parts: set into a face of a hearth's shell, they act for its controller (spec 17.1) ----
  // item_hatch - the furnace's smart sides for pipes (spec 16.2): fuel to the firebox, smeltables to a crucible,
  // finished crucible output out. No inventory of its own.
  {
    kind: 'item_hatch', name: 'Item Hatch', role: 'hearth_part', blocks: ['item_hatch'],
    desc: 'Lets item pipes reach the hearth it is built into: fuel goes to the firebox, ores to a crucible, and finished metal can be pulled out.',
    placementHint: 'Build it into a face of a hearth wall.',
  },
  // fluid_hatch - takes piped lava as furnace fuel. params:
  //   lavaLPerFuel  litres of lava that burn like one lava bucket (its FuelSpec)
  {
    kind: 'fluid_hatch', name: 'Fluid Hatch', role: 'hearth_part', blocks: ['fluid_hatch'],
    params: { lavaLPerFuel: LITRES_PER_BUCKET },
    fluids: { accepts: ['lava'], capacityL: 1000 },
    desc: 'Lets a hot pipe feed lava to the hearth it is built into. Every 1000 litres burns like a lava bucket.',
    placementHint: 'Build it into a face of a hearth wall.',
  },
  // power_port - joins cable networks and passes the hearth's electric heating (one consumer) through to the controller.
  {
    kind: 'power_port', name: 'Power Port', role: 'hearth_part', blocks: ['power_port'],
    desc: 'Carries cable power through a hearth wall. A Plasma hearth needs two, a Starhearth four.',
    placementHint: 'Build it into a face of a hearth wall.',
  },
];
