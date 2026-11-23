/**
 * The sixteen generated structure types of the synergy overhaul (docs/SYNERGY_PLAN.md section 4): camps, shrines, kilns,
 * foundries and altars of the people who were artificers before the player. Each one is built ONLY from blocks that
 * occur in its own biome, is drawn by a pure function of its site (src/world/structures.ts) and names where its crate
 * stands and which guardians keep it. Local coordinates: x in [0, w), z in [0, d), y = 0 is the first block above the
 * floor row (y = -1).
 */
import { hash32 } from '../core/math';
import { blockId } from '../core/registry';
import { DUNES, FROSTFELL, MARSH, SCAR, WOODLAND } from './terrain';

/** A guardian slot: species key, local cell, extra height above the floor to start looking for a stand, and role. */
export interface GuardSlot {
  species: string;
  x: number;
  z: number;
  up?: number;
  role?: 'guard' | 'turret';
}

export interface StructureDef {
  key: string;
  name: string;
  desc: string;
  /** Biome indices it may stand in (src/world/terrain.ts). */
  biomes: number[];
  w: number;
  d: number;
  /** Age index of what it holds (src/magic/ageMap.ts): 0 ember, 1 bronze, 2 forge. */
  age: number;
  /** Cell of the loot crate (at y = 0); it is left empty for the World to fill. */
  crate: [number, number];
  guards: GuardSlot[];
  /** Blocks of ground under the footprint (the row at y = -1). */
  floor: 'biome' | number;
  build(c: Canvas): void;
}

const B = {
  air: 0,
  stone: blockId('stone'), rubble: blockId('rubble'), dirt: blockId('dirt'), grass: blockId('grass'), sand: blockId('sand'),
  gravel: blockId('gravel'), clay: blockId('clay'), snow: blockId('snow'), ice: blockId('ice'), basalt: blockId('basalt'),
  limestone: blockId('limestone'), water: blockId('water'), lava: blockId('lava'), oakLog: blockId('oak_log'),
  oakLeaves: blockId('oak_leaves'), pineLog: blockId('pine_log'), pineLeaves: blockId('pine_leaves'), plank: blockId('plank'),
  stoneBrick: blockId('stone_brick'), brick: blockId('brick'), glass: blockId('glass'), torch: blockId('torch'),
  mossy: blockId('mossy_stone_brick'), cracked: blockId('cracked_stone_brick'), peat: blockId('peat'), reeds: blockId('reeds'),
  glowcap: blockId('glowcap'), cactus: blockId('cactus'), packedIce: blockId('packed_ice'), iceSpike: blockId('ice_spike'),
  column: blockId('basalt_column'), vent: blockId('steam_vent'), rusted: blockId('rusted_shell'), corestone: blockId('corestone'),
  coalOre: blockId('coal_ore'), asphalt: blockId('asphalt'), poppy: blockId('ember_poppy'), skybell: blockId('skybell'),
  fern: blockId('fern'), lily: blockId('frost_lily'), shrub: blockId('dry_shrub'), light: blockId('magic_light'),
  jar: blockId('essentia_jar'), furnace: blockId('collapsed_furnace'), crystal: blockId('crystal_cluster'), berry: blockId('berry_bush'),
};
export { B as STRUCTURE_BLOCKS };

/** Where a structure writes: local coordinates clipped to the chunk being generated. */
export class Canvas {
  constructor(
    private readonly voxels: Uint16Array,
    private readonly chunkX: number,
    private readonly chunkZ: number,
    readonly x0: number,
    readonly z0: number,
    readonly floorY: number,
    readonly bits: number,
    readonly w: number,
    readonly d: number,
    private readonly crate: readonly [number, number],
    private readonly index: (lx: number, y: number, lz: number) => number,
    private readonly height: number,
  ) {}

  /** 0..255 from the site and a cell: the same everywhere in the world, so chunks agree. */
  roll(x: number, y: number, z: number): number {
    return hash32(this.bits, x, y, z) & 0xff;
  }

  /** One of `ids`, by the cell's roll. */
  mix(x: number, y: number, z: number, ...ids: number[]): number {
    return ids[this.roll(x, y, z) % ids.length];
  }

  set(x: number, y: number, z: number, id: number): void {
    if (x < 0 || z < 0 || x >= this.w || z >= this.d) return;
    if (y === 0 && x === this.crate[0] && z === this.crate[1]) return;
    const wy = this.floorY + 1 + y;
    const lx = this.x0 + x - this.chunkX;
    const lz = this.z0 + z - this.chunkZ;
    if (lx < 0 || lx >= 16 || lz < 0 || lz >= 16 || wy < 1 || wy >= this.height) return;
    this.voxels[this.index(lx, wy, lz)] = id;
  }

  /** A solid box of `id`, inclusive corners. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: number): void {
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, z, id);
  }

  /** A box whose block is chosen per cell by `pick(x, y, z)`; a return of -1 leaves the cell as it was. */
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pick: (x: number, y: number, z: number) => number): void {
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const id = pick(x, y, z);
          if (id >= 0) this.set(x, y, z, id);
        }
      }
    }
  }

  /** The perimeter of a rectangle, `h` high from y0, each block chosen by pick; `decay` of 0..255 drops tops at random. */
  ring(x0: number, z0: number, x1: number, z1: number, y0: number, h: number, pick: (x: number, y: number, z: number) => number, decay = 0): void {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
        let top = h;
        if (decay > 0 && this.roll(x, 40, z) < decay) top = h - 1 - (this.roll(x, 41, z) & 1);
        for (let y = y0; y < y0 + top; y++) this.set(x, y, z, pick(x, y, z));
      }
    }
  }

  /** Makes a doorway: clears cells y0..y1 at (x, z). */
  gap(x: number, z: number, y0 = 0, y1 = 1): void {
    for (let y = y0; y <= y1; y++) this.set(x, y, z, B.air);
  }

  /** The floor row (y = -1). */
  floor(x0: number, z0: number, x1: number, z1: number, pick: (x: number, z: number) => number): void {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, -1, z, pick(x, z));
  }

  /** A column of `id` from y0 up. */
  pillar(x: number, z: number, y0: number, h: number, id: number): void {
    for (let y = y0; y < y0 + h; y++) this.set(x, y, z, id);
  }
}

/** Walls of brick and its aged kin, mostly weathered. */
const oldBrick = (c: Canvas) => (x: number, y: number, z: number): number => c.mix(x, y, z, B.stoneBrick, B.mossy, B.cracked, B.brick);
const mossyBrick = (c: Canvas) => (x: number, y: number, z: number): number => c.mix(x, y, z, B.mossy, B.mossy, B.stoneBrick, B.cracked);

// ---------------------------------------------------------------------------------------------------- woodland

const CHARCOAL_CAMP: StructureDef = {
  key: 'charcoal_camp', name: "Charcoal Burner's Camp", desc: 'A turf-covered burn mound, a lean-to and a stack of logs: someone made charcoal here and left in a hurry.',
  biomes: [WOODLAND], w: 9, d: 9, age: 0, crate: [2, 2], guards: [], floor: 'biome',
  build(c) {
    // The burn mound: turf over a hot heart of rubble, with a smoke hole.
    c.box(5, 0, 5, 7, 0, 7, B.dirt); c.box(5, 1, 5, 7, 1, 7, B.dirt); c.set(6, 2, 6, B.dirt); c.set(6, 1, 6, B.rubble);
    c.set(4, 0, 6, B.dirt); c.set(8, 0, 6, B.dirt); c.set(6, 0, 4, B.dirt); c.set(6, 0, 8, B.dirt);
    // The lean-to over the crate: two posts, a plank roof sloping up to the back.
    for (const x of [0, 4]) { c.pillar(x, 0, 0, 2, B.oakLog); c.pillar(x, 4, 0, 3, B.oakLog); }
    c.box(0, 2, 0, 4, 2, 4, B.plank); c.box(0, 3, 3, 4, 3, 4, B.plank);
    c.box(1, -1, 1, 3, -1, 3, B.plank);
    c.set(3, 0, 0, B.torch);
    // Split logs piled by the track, a stump and a few poppies.
    c.box(0, 0, 7, 2, 1, 8, B.oakLog); c.set(3, 0, 6, B.oakLog);
    c.set(8, 0, 1, B.poppy); c.set(7, 0, 2, B.fern); c.set(8, 0, 3, B.poppy);
  },
};

const HOLLOW_OAK_SHRINE: StructureDef = {
  key: 'hollow_oak_shrine', name: 'Hollow Oak Shrine', desc: 'A giant oak, hollow to the root, ringed with moss-covered stones and glowcaps. The first artificers left offerings here to teach the fire.',
  biomes: [WOODLAND], w: 9, d: 9, age: 0, crate: [4, 4], guards: [{ species: 'barkwright', x: 2, z: 6 }], floor: 'biome',
  build(c) {
    c.floor(3, 3, 5, 5, () => B.mossy);
    c.fill(3, 0, 3, 5, 4, 5, (x, y, z) => (x === 4 && z === 4) || (x === 4 && z === 5 && y < 2) ? B.air : B.oakLog);
    c.fill(1, 4, 1, 7, 5, 7, (x, y, z) => ((x - 4) ** 2 + (z - 4) ** 2 <= (y === 4 ? 10 : 6) && c.roll(x, y, z) < 235 ? B.oakLeaves : -1));
    c.fill(3, 6, 3, 5, 6, 5, () => B.oakLeaves);
    for (const [x, z] of [[1, 1], [7, 1], [1, 7], [7, 7]]) { c.set(x, 0, z, B.mossy); c.set(x, 1, z, c.roll(x, 3, z) < 140 ? B.mossy : B.air); }
    for (const [x, z] of [[2, 4], [6, 4], [4, 2], [3, 6], [5, 6]]) c.set(x, 0, z, B.glowcap);
    c.set(6, 0, 6, B.poppy); c.set(2, 0, 2, B.skybell);
  },
};

const LUMBER_MILL: StructureDef = {
  key: 'lumber_mill', name: 'Lumber Mill', desc: 'A plank-walled mill with its saw bench still standing. Whoever worked here turned logs to boards by the hundred before the shafts stopped.',
  biomes: [WOODLAND], w: 11, d: 9, age: 1, crate: [9, 2], guards: [{ species: 'barkwright', x: 4, z: 4 }, { species: 'barkwright', x: 7, z: 6 }], floor: 'biome',
  build(c) {
    c.floor(0, 0, 10, 8, (x, z) => c.mix(x, 0, z, B.plank, B.plank, B.stoneBrick));
    c.ring(0, 0, 10, 8, 0, 4, (x, y, z) => (y === 0 ? B.stoneBrick : (x === 0 || x === 10) && (z === 0 || z === 8) ? B.oakLog : B.plank), 90);
    c.gap(5, 8, 0, 2); c.gap(0, 4, 1, 2); c.gap(10, 4, 1, 2);
    // The saw bench: a long table with a log on it, a stack of boards, drive posts.
    c.box(2, 0, 2, 7, 0, 2, B.plank); c.box(3, 1, 2, 4, 1, 2, B.oakLog); c.box(7, 0, 6, 8, 1, 7, B.plank);
    c.pillar(2, 6, 0, 3, B.oakLog); c.pillar(5, 6, 0, 3, B.oakLog);
    c.fill(1, 4, 1, 9, 4, 7, (x, y, z) => (c.roll(x, 4, z) < 130 ? B.plank : -1));
    c.set(1, 1, 1, B.torch); c.set(9, 1, 6, B.torch);
  },
};

// ------------------------------------------------------------------------------------------------------ dunes

const GLASSBLOWER_KILN: StructureDef = {
  key: 'glassblower_kiln', name: "Glassblower's Kiln", desc: 'A brick kiln half-buried in drifted sand, its roof set with panes of glass the wind has not found yet.',
  biomes: [DUNES], w: 9, d: 9, age: 1, crate: [1, 7], guards: [{ species: 'glass_scarab', x: 6, z: 6 }, { species: 'glass_scarab', x: 7, z: 5 }], floor: 'biome',
  build(c) {
    c.floor(0, 0, 8, 8, (x, z) => (c.roll(x, 0, z) < 70 ? B.brick : B.sand));
    c.ring(0, 0, 8, 8, 0, 3, (x, y, z) => (y === 1 && c.roll(x, y, z) < 100 ? B.glass : B.brick), 70);
    c.gap(4, 0, 0, 1);
    // The furnace pillar in the middle with a glass crown.
    c.box(3, 0, 3, 5, 2, 5, B.brick); c.box(4, 3, 4, 4, 3, 4, B.glass); c.set(4, 0, 3, B.air);
    c.fill(1, 3, 1, 7, 3, 7, (x, y, z) => ((x === 1 || x === 7 || z === 1 || z === 7) && c.roll(x, 3, z) < 60 ? B.glass : -1));
    for (const [x, z] of [[7, 1], [1, 1], [7, 7]]) c.set(x, 0, z, B.sand);
    c.set(8, 0, 4, B.shrub);
  },
};

const CARAVAN_WELL: StructureDef = {
  key: 'caravan_well', name: 'Caravan Well', desc: 'A stone-rimmed well in a low brick court, with cactus hedges and a clay awning. Travellers left supplies for those who came after.',
  biomes: [DUNES], w: 11, d: 11, age: 0, crate: [2, 8], guards: [], floor: 'biome',
  build(c) {
    c.floor(0, 0, 10, 10, (x, z) => (c.roll(x, 0, z) < 90 ? B.limestone : B.sand));
    c.ring(0, 0, 10, 10, 0, 2, (x, y, z) => (y === 0 ? B.brick : c.mix(x, y, z, B.brick, B.clay)), 100);
    c.gap(5, 0, 0, 1); c.gap(5, 10, 0, 1);
    // The well: a limestone ring over water.
    c.ring(4, 4, 6, 6, 0, 1, () => B.limestone); c.set(5, -1, 5, B.water); c.set(5, -2, 5, B.water);
    // The awning: four posts and a clay roof over the crate corner.
    for (const [x, z] of [[1, 7], [4, 7], [1, 9], [4, 9]]) c.pillar(x, z, 0, 2, B.brick);
    c.box(1, 2, 7, 4, 2, 9, B.clay);
    for (const [x, z] of [[1, 1], [9, 1], [9, 9]]) c.pillar(x, z, 0, 2, B.cactus);
    c.set(8, 0, 7, B.shrub); c.set(8, 0, 3, B.shrub);
  },
};

const OIL_DERRICK: StructureDef = {
  key: 'oil_derrick', name: 'Oil Derrick', desc: 'A lattice tower of rusted shell over an asphalt pad. The Old Works pumped the dunes dry here and left a sentry on the beam.',
  biomes: [DUNES], w: 7, d: 7, age: 2, crate: [3, 1],
  guards: [{ species: 'forge_warden', x: 2, z: 4 }, { species: 'kiln_sentry', x: 0, z: 0, up: 7, role: 'turret' }], floor: B.asphalt,
  build(c) {
    c.floor(1, 1, 5, 5, (x, z) => (c.roll(x, 0, z) < 40 ? B.rusted : B.asphalt));
    for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) c.pillar(x, z, 0, 8, B.rusted);
    for (const y of [3, 7]) c.ring(0, 0, 6, 6, y, 1, () => B.rusted, 60);
    c.set(0, 8, 0, B.rusted);
    c.box(3, 0, 3, 3, 4, 3, B.rusted); c.set(3, 5, 3, B.corestone);
    c.set(5, 0, 5, B.rusted); c.set(1, 0, 5, B.rubble);
  },
};

// -------------------------------------------------------------------------------------------------- frostfell

const HUNTERS_LODGE: StructureDef = {
  key: 'hunters_lodge', name: "Hunter's Lodge", desc: 'A pine-log lodge under a plank roof heaped with snow. The hearth is cold, but the hunters left their winter stores behind.',
  biomes: [FROSTFELL], w: 9, d: 7, age: 0, crate: [1, 4], guards: [], floor: 'biome',
  build(c) {
    c.floor(0, 0, 8, 6, (x, z) => (c.roll(x, 0, z) < 160 ? B.plank : B.stoneBrick));
    c.ring(0, 0, 8, 6, 0, 3, (x, y, z) => ((x === 0 || x === 8) && (z === 0 || z === 6) ? B.pineLog : B.pineLog), 50);
    c.gap(4, 6, 0, 1); c.gap(8, 3, 1, 1);
    c.box(0, 3, 0, 8, 3, 6, B.plank); c.box(0, 4, 0, 8, 4, 6, B.snow);
    c.box(6, 0, 1, 7, 1, 1, B.stoneBrick); c.set(7, 2, 1, B.stoneBrick); c.set(6, 0, 2, B.torch);
    c.box(3, 0, 1, 5, 0, 1, B.pineLog); c.set(2, 0, 5, B.torch);
    c.set(8, 0, 8, B.lily); c.set(0, 0, 8, B.lily);
  },
};

const FROST_CAIRN: StructureDef = {
  key: 'frost_cairn', name: 'Frost Cairn', desc: 'A ring of packed ice around a stone cairn. The artificers of the cold hills kept a vial of frost here, and the ice itself remembers them.',
  biomes: [FROSTFELL], w: 9, d: 9, age: 1, crate: [4, 4], guards: [{ species: 'rime_husk', x: 2, z: 2 }, { species: 'rime_husk', x: 6, z: 6 }], floor: 'biome',
  build(c) {
    c.floor(1, 1, 7, 7, (x, z) => c.mix(x, 0, z, B.stoneBrick, B.packedIce));
    c.ring(1, 1, 7, 7, 0, 3, (x, y, z) => (y === 2 ? B.ice : B.packedIce), 80);
    c.gap(4, 7, 0, 1);
    for (const [x, z] of [[0, 0], [8, 0], [0, 8], [8, 8], [4, 0], [4, 8]]) c.pillar(x, z, 0, 2, B.iceSpike);
    c.box(3, 0, 3, 5, 0, 5, B.stoneBrick); c.set(3, 1, 4, B.stoneBrick); c.set(4, 0, 4, B.air);
    c.set(3, 1, 3, B.iceSpike); c.set(5, 1, 5, B.iceSpike); c.set(2, 0, 6, B.lily);
  },
};

const FROZEN_FOUNDRY: StructureDef = {
  key: 'frozen_foundry', name: 'Frozen Foundry', desc: 'A foundry that froze with its furnace still in the wall: stone brick, hanging ice and a hearth gone to rust. The wardens never left their posts.',
  biomes: [FROSTFELL], w: 11, d: 9, age: 2, crate: [9, 2], guards: [{ species: 'forge_warden', x: 3, z: 4 }, { species: 'forge_warden', x: 7, z: 5 }], floor: 'biome',
  build(c) {
    c.floor(0, 0, 10, 8, (x, z) => c.mix(x, 0, z, B.stoneBrick, B.cracked, B.packedIce));
    c.ring(0, 0, 10, 8, 0, 4, (x, y, z) => c.mix(x, y, z, B.stoneBrick, B.cracked, B.stoneBrick), 110);
    c.gap(5, 0, 0, 2);
    c.set(5, 0, 8, B.furnace); c.pillar(5, 8, 1, 3, B.stoneBrick);
    c.fill(1, 3, 1, 9, 3, 7, (x, y, z) => (c.roll(x, 3, z) < 55 ? B.packedIce : -1));
    c.fill(1, 2, 1, 9, 2, 7, (x, y, z) => (c.roll(x, 2, z) < 25 ? B.iceSpike : -1));
    c.set(2, 0, 7, B.rusted); c.set(8, 0, 7, B.rusted); c.set(8, 1, 7, B.rusted);
    c.box(1, 0, 3, 2, 0, 3, B.packedIce);
  },
};

// ------------------------------------------------------------------------------------------------------- scar

const BASALT_FORGE_PIT: StructureDef = {
  key: 'basalt_forge_pit', name: 'Basalt Forge-Pit', desc: 'A ring of basalt pillars around a pit of living lava, steam rising from cracks at its feet. The Old Works forged here with the land\'s own fire.',
  biomes: [SCAR], w: 11, d: 11, age: 2, crate: [1, 9], guards: [{ species: 'bellows_hound', x: 8, z: 8 }, { species: 'bellows_hound', x: 9, z: 3 }], floor: B.basalt,
  build(c) {
    c.floor(0, 0, 10, 10, () => B.basalt);
    c.floor(4, 4, 6, 6, () => B.lava);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = 5 + Math.round(Math.cos(a) * 4);
      const z = 5 + Math.round(Math.sin(a) * 4);
      c.pillar(x, z, 0, 3 + (c.roll(x, 9, z) % 3), B.column);
    }
    c.set(3, 0, 5, B.vent); c.set(7, 0, 5, B.vent); c.set(5, 0, 3, B.vent);
    c.box(0, 0, 8, 2, 0, 10, B.corestone); c.set(0, 1, 10, B.rusted);
    c.set(9, 0, 9, B.rusted);
  },
};

const EMBER_ALTAR: StructureDef = {
  key: 'ember_altar', name: 'Ember Altar', desc: 'A stepped basalt dais crowned with a column and a steady light that has not gone out in an age. The artificers came here to be taught by fire.',
  biomes: [SCAR], w: 9, d: 9, age: 1, crate: [4, 2], guards: [{ species: 'magma_crawler', x: 2, z: 6 }, { species: 'magma_crawler', x: 6, z: 6 }], floor: B.basalt,
  build(c) {
    c.floor(0, 0, 8, 8, () => B.basalt);
    c.box(2, 0, 3, 6, 0, 7, B.basalt); c.box(3, 1, 4, 5, 1, 6, B.basalt); c.set(4, 2, 5, B.column); c.set(4, 3, 5, B.light);
    for (const [x, z] of [[0, 0], [8, 0], [0, 8], [8, 8]]) c.pillar(x, z, 0, 4, B.column);
    c.set(1, 0, 4, B.vent); c.set(7, 0, 4, B.vent);
    c.set(4, 0, 8, B.rubble);
  },
};

const SLAG_DEPOT: StructureDef = {
  key: 'slag_depot', name: 'Slag Depot', desc: 'A yard of rusted shells, slag heaps and a crumbling basalt wall. Ore was hauled here from the deep; a sentry still watches the haul road.',
  biomes: [SCAR], w: 11, d: 9, age: 2, crate: [1, 1],
  guards: [{ species: 'kiln_sentry', x: 10, z: 8, up: 2, role: 'turret' }, { species: 'cinder_mite', x: 5, z: 4 }, { species: 'cinder_mite', x: 7, z: 4 }, { species: 'cinder_mite', x: 6, z: 6 }], floor: B.basalt,
  build(c) {
    c.floor(0, 0, 10, 8, (x, z) => c.mix(x, 0, z, B.basalt, B.basalt, B.rubble));
    c.ring(0, 0, 10, 8, 0, 3, (x, y, z) => c.mix(x, y, z, B.basalt, B.corestone), 120);
    c.gap(5, 8, 0, 2);
    for (const [x, z] of [[3, 3], [7, 3], [4, 6], [8, 5]]) { c.box(x, 0, z, x + 1, 1, z, B.rusted); c.set(x, 2, z, B.rusted); }
    for (const [x, z] of [[2, 2], [9, 2], [3, 5]]) { c.box(x, 0, z, x + 1, 0, z + 1, B.rubble); c.set(x, 1, z, B.coalOre); }
    c.box(9, 0, 7, 10, 2, 8, B.corestone);
  },
};

// ------------------------------------------------------------------------------------------------------ marsh

const PEAT_STILT_HUT: StructureDef = {
  key: 'peat_stilt_hut', name: "Peat-Cutter's Hut", desc: 'A plank hut on a log platform above the sucking ground, with stacked peat drying at the door. The cutters brewed tea here between shifts.',
  biomes: [MARSH], w: 7, d: 8, age: 0, crate: [5, 2], guards: [], floor: 'biome',
  build(c) {
    c.floor(0, 0, 6, 6, () => B.plank);
    c.ring(0, 0, 6, 6, 0, 4, (x, y, z) => ((x === 0 || x === 6) && (z === 0 || z === 6) ? B.oakLog : B.plank), 60);
    c.gap(3, 6, 0, 1); c.gap(0, 3, 1, 2);
    c.box(0, 4, 0, 6, 4, 6, B.plank);
    c.set(3, 0, 7, B.peat); c.box(5, 0, 7, 6, 0, 7, B.peat); c.set(6, 1, 7, B.peat);
    c.set(1, 0, 7, B.reeds); c.set(2, 0, 7, B.reeds);
  },
};

const ALCHEMIST_TOWER: StructureDef = {
  key: 'sunken_alchemist_tower', name: "Sunken Alchemist's Tower", desc: 'A mossy tower leaning into the marsh, glowcaps in every crack and a jar still standing on its shelf. Someone studied what the water remembered.',
  biomes: [MARSH], w: 7, d: 7, age: 1, crate: [2, 2], guards: [{ species: 'bog_lantern', x: 4, z: 4 }, { species: 'bog_lantern', x: 3, z: 4 }], floor: 'biome',
  build(c) {
    c.floor(0, 0, 6, 6, (x, z) => c.mix(x, 0, z, B.mossy, B.stoneBrick, B.clay));
    c.ring(0, 0, 6, 6, 0, 8, mossyBrick(c), 140);
    c.gap(3, 0, 0, 1);
    for (const y of [3, 5]) c.fill(1, y, 1, 5, y, 5, (x, yy, z) => (x === 1 || x === 5 || z === 1 || z === 5 ? B.plank : -1));
    c.set(6, 4, 3, B.glass); c.set(3, 4, 6, B.glass); c.set(0, 5, 3, B.glass);
    c.set(4, 0, 5, B.jar); c.set(5, 0, 5, B.glowcap); c.set(1, 0, 5, B.glowcap);
    c.set(3, -1, 7, B.reeds); c.set(2, 0, 7, B.reeds);
  },
};

const PUMP_HOUSE: StructureDef = {
  key: 'pump_house', name: 'Pump House', desc: 'A mossy stone pump house over a still black basin. The marsh was drained here once, by machines that no longer answer.',
  biomes: [MARSH], w: 9, d: 7, age: 1, crate: [7, 1], guards: [{ species: 'forge_warden', x: 4, z: 3 }], floor: 'biome',
  build(c) {
    c.floor(0, 0, 8, 6, (x, z) => c.mix(x, 0, z, B.stoneBrick, B.mossy));
    c.ring(0, 0, 8, 6, 0, 3, mossyBrick(c), 90);
    c.gap(4, 6, 0, 1);
    for (const x of [0, 8]) for (const z of [0, 6]) c.set(x, 3, z, B.oakLog);
    c.box(3, -1, 2, 5, -1, 4, B.water); c.box(3, -2, 2, 5, -2, 4, B.water);
    c.ring(2, 1, 6, 5, 0, 1, () => B.stoneBrick); c.set(4, 0, 1, B.air);
    c.fill(1, 3, 1, 7, 3, 5, (x, y, z) => (c.roll(x, 3, z) < 90 ? B.plank : -1));
    c.set(1, 0, 5, B.reeds); c.set(7, 0, 5, B.reeds);
  },
};

// ------------------------------------------------------------------------------------------------------- any

const WAYSTONE: StructureDef = {
  key: 'waystone', name: 'Waystone', desc: 'A small obelisk of mossy brick with a lamp that never dims. Artificers marked their roads with these; a traveller can rest in its light.',
  biomes: [WOODLAND, DUNES, FROSTFELL, MARSH], w: 5, d: 5, age: 1, crate: [2, 3], guards: [], floor: 'biome',
  build(c) {
    c.floor(1, 1, 3, 3, () => B.stoneBrick);
    c.box(1, 0, 1, 3, 0, 3, B.stoneBrick); c.box(2, 1, 2, 2, 3, 2, B.mossy); c.set(2, 4, 2, B.light);
    for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) c.set(x, 0, z, B.torch);
    c.set(2, 0, 3, B.air);
  },
};

export const STRUCTURE_DEFS: readonly StructureDef[] = [
  CHARCOAL_CAMP, HOLLOW_OAK_SHRINE, LUMBER_MILL, GLASSBLOWER_KILN, CARAVAN_WELL, OIL_DERRICK, HUNTERS_LODGE, FROST_CAIRN,
  FROZEN_FOUNDRY, BASALT_FORGE_PIT, EMBER_ALTAR, SLAG_DEPOT, PEAT_STILT_HUT, ALCHEMIST_TOWER, PUMP_HOUSE, WAYSTONE,
];
