/**
 * The shape of the land: climate, biomes, surface height and surface material of any column, as pure
 * functions of (seed, x, z). Everything else in world generation is built on `sampleColumn`.
 */
import { Noise, clamp, hash32, lerp, smoothstep } from '../core/math';
import { SEA_LEVEL, WORLD_HEIGHT, type BiomeKey } from '../core/types';

export const BIOME_KEYS: readonly BiomeKey[] = ['woodland', 'dunes', 'frostfell', 'scar', 'marsh'];
export const WOODLAND = 0;
export const DUNES = 1;
export const FROSTFELL = 2;
export const SCAR = 3;
export const MARSH = 4;

export const LIQUID_NONE = 0;
export const LIQUID_WATER = 1;
export const LIQUID_LAVA = 2;
export const LIQUID_OIL = 3;

/** y of the highest water block: water fills every column whose ground is lower. */
export const WATER_TOP = SEA_LEVEL - 1;
/** y of the highest lava block in a Scar surface pool. */
export const LAVA_POOL_TOP = 35;
/** Cave air at or below this y is lava. */
export const CAVE_LAVA_TOP = 8;
/** Above this height Frostfell is bare rock under snow, without soil or trees. */
export const TREE_LINE = 64;
/** y of the highest oil block in a pool in the Dunes and in the Scar (each sits in ground at least this high). */
export const OIL_TOP_DUNES = 34;
export const OIL_TOP_SCAR = 38;
/** The Marsh never comes closer to the world origin than this, so every world starts in Woodland. */
const MARSH_NEAR = 150;
const MARSH_FULL = 300;

export const SURFACE_GRASS = 0;
export const SURFACE_SAND = 1;
export const SURFACE_GRAVEL = 2;
export const SURFACE_CLAY = 3;
export const SURFACE_STONE = 4;
export const SURFACE_SNOW = 5;
export const SURFACE_BASALT = 6;
export const SURFACE_DIRT = 7;
export const SURFACE_PEAT = 8;

export interface Terrain {
  readonly seed: number;
  readonly temp: Noise;
  readonly wet: Noise;
  readonly hills: Noise;
  readonly detail: Noise;
  readonly lake: Noise;
  readonly river: Noise;
  readonly warp: Noise;
  readonly mount: Noise;
  readonly ridge: Noise;
  readonly dune: Noise;
  readonly oasis: Noise;
  readonly scar: Noise;
  readonly crag: Noise;
  readonly pool: Noise;
  readonly forest: Noise;
  readonly patchA: Noise;
  readonly patchB: Noise;
  readonly rock: Noise;
  readonly caveA: Noise;
  readonly caveB: Noise;
  readonly caveC: Noise;
  readonly marsh: Noise;
  readonly marshPool: Noise;
  readonly oil: Noise;
  readonly flora: Noise;
}

const terrains = new Map<number, Terrain>();

/** Noise fields of a seed. Building them costs a little, so the last few seeds are kept. */
export function terrainFor(seed: number): Terrain {
  let t = terrains.get(seed);
  if (!t) {
    let n = 0;
    const next = (): Noise => new Noise(hash32(seed, 0x7e44a1, n++));
    t = {
      seed,
      temp: next(), wet: next(), hills: next(), detail: next(), lake: next(), river: next(), warp: next(),
      mount: next(), ridge: next(), dune: next(), oasis: next(), scar: next(), crag: next(), pool: next(),
      forest: next(), patchA: next(), patchB: next(), rock: next(), caveA: next(), caveB: next(), caveC: next(),
      // Appended after the original fields, so the older fields keep their seeds.
      marsh: next(), marshPool: next(), oil: next(), flora: next(),
    };
    if (terrains.size >= 4) terrains.delete(terrains.keys().next().value as number);
    terrains.set(seed, t);
  }
  return t;
}

/** Everything world generation knows about one column before caves, ores and plants. */
export class Column {
  /** y of the highest solid block. */
  height = 0;
  /** Index into BIOME_KEYS. */
  biome = WOODLAND;
  /** LIQUID_* standing on top of the ground. */
  liquid = LIQUID_NONE;
  /** y of the highest liquid block (meaningful when liquid is not LIQUID_NONE). */
  liquidTop = 0;
  wWood = 1;
  wDunes = 0;
  wFrost = 0;
  wScar = 0;
  wMarsh = 0;
}

function woodlandHeight(t: Terrain, x: number, z: number, detail: number): number {
  const hills = t.hills.fbm2(x / 130, z / 130, 4);
  let h = 40.5 + 17 * hills + 2 * detail;
  const lake = smoothstep(0.2, 0.36, t.lake.fbm2(x / 150, z / 150, 2));
  if (lake > 0) h = lerp(h, 26.5 + 1.5 * detail, lake);
  return h;
}

function dunesHeight(t: Terrain, x: number, z: number): number {
  const swell = t.dune.fbm2(x / 170, z / 170, 2);
  const crest = 1 - Math.abs(t.dune.noise2(x / 34 + 80, z / 58 - 80)) * 1.4;
  let h = Math.max(34.2, 38 + 11 * swell + 5.5 * crest * crest);
  const oasis = smoothstep(0.46, 0.58, t.oasis.noise2(x / 100, z / 100));
  if (oasis > 0) h = lerp(h, 28.5, oasis);
  return h;
}

function frostfellHeight(t: Terrain, x: number, z: number, detail: number): number {
  const peak = smoothstep(-0.22, 0.42, t.mount.fbm2(x / 190, z / 190, 4));
  const ridge = clamp(1 - Math.abs(t.ridge.noise2(x / 66, z / 66)) * 1.5, 0, 1);
  return Math.min(86, 37.5 + 3 * detail + Math.pow(peak, 1.3) * (30 + 17 * ridge));
}

/** Flat wetland at sea level: dry tussocks at y 31-32 between shallow pools one or two blocks deep. */
function marshHeight(t: Terrain, x: number, z: number, detail: number): number {
  const pools = t.marshPool.fbm2(x / 19, z / 19, 2) + 0.3 * t.marshPool.noise2(x / 6 + 40, z / 6 - 40);
  return 32.25 + 0.55 * detail - 2.8 * smoothstep(-0.04, 0.2, pools);
}

function scarHeight(t: Terrain, x: number, z: number): number {
  const base = 43 + 15 * t.scar.fbm2(x / 100, z / 100, 3);
  // Terraces: the land climbs in 5-block steps with short ramps between them.
  const q = base / 5;
  const step = Math.floor(q);
  let h = (step + smoothstep(0.3, 0.7, q - step)) * 5;
  h += Math.max(0, t.crag.noise2(x / 12, z / 12) - 0.3) * 20;
  h += Math.max(0, t.crag.noise2(x / 42 + 300, z / 42 + 300) - 0.38) * 46;
  return Math.min(80, h);
}

/** Fills `out` for the column at world x, z. */
export function sampleColumn(t: Terrain, x: number, z: number, out: Column): Column {
  // Climate. The land around the origin is always temperate, so every world starts in Woodland.
  const temp = t.temp.fbm2(x / 440 + 31.7, z / 440 - 12.3, 3) * smoothstep(90, 340, Math.hypot(x, z));
  const frost = smoothstep(0.075, 0.175, -temp);
  const hot = smoothstep(0.075, 0.175, temp);
  let wScar = 0;
  if (hot > 0) wScar = hot * smoothstep(-0.045, 0.045, t.wet.fbm2(x / 380 - 7.1, z / 380 + 44.9, 3));
  const wDunes = hot - wScar;
  const temperate = 1 - frost - hot;
  let wMarsh = 0;
  if (temperate > 0) {
    const near = smoothstep(MARSH_NEAR, MARSH_FULL, Math.hypot(x, z));
    if (near > 0) wMarsh = temperate * near * smoothstep(0.03, 0.15, t.marsh.fbm2(x / 340 + 13.1, z / 340 - 71.3, 3));
  }
  const wWood = temperate - wMarsh;

  const detail = t.detail.noise2(x / 23, z / 23);
  let h = 0;
  if (wWood > 0) h += wWood * woodlandHeight(t, x, z, detail);
  if (wDunes > 0) h += wDunes * dunesHeight(t, x, z);
  if (frost > 0) h += frost * frostfellHeight(t, x, z, detail);
  if (wScar > 0) h += wScar * scarHeight(t, x, z);
  if (wMarsh > 0) h += wMarsh * marshHeight(t, x, z, detail);

  // Rivers wind through Woodland, the Marsh and (frozen) through Frostfell; in the Dunes they are only dry beds.
  const riverStrength = wWood + wMarsh + 0.9 * frost + 0.2 * wDunes;
  let riverGap = 1;
  if (riverStrength > 0.01) {
    const wx = x + 26 * t.warp.noise2(x / 70, z / 70);
    const wz = z + 26 * t.warp.noise2(x / 70 + 91, z / 70 - 57);
    const along = Math.abs(t.river.noise2(wx / 310, wz / 310));
    riverGap = along;
    const river = 1 - smoothstep(0.012, 0.085, along);
    if (river > 0) {
      const bed = 27.6 + 1.2 * detail;
      // High mountains keep their rivers in gorges only half as deep as the full drop to sea level.
      const reach = h > 50 ? lerp(1, 0.55, smoothstep(50, 74, h)) : 1;
      if (h > bed) h = lerp(h, bed, river * riverStrength * reach);
    }
  }

  // The Scar's interior is dry high ground, so its lava pools are always walled in by rock.
  let lava = false;
  let lavaNoise = 0;
  if (wScar > 0.5) {
    h = lerp(h, Math.max(h, 38.5), smoothstep(0.5, 0.85, wScar));
    if (wScar > 0.85) lavaNoise = t.pool.fbm2(x / 52, z / 52, 2);
    if (wScar > 0.9) {
      const pool = smoothstep(0.17, 0.3, lavaNoise) * smoothstep(0.9, 0.98, wScar);
      if (pool > 0) {
        h = lerp(h, 31.4, pool);
        lava = true;
      }
    }
  }

  // Oil seeps: pools in the deep Dunes and the dry Scar, sunk below a rim that is raised to stay above the oil,
  // so oil never touches air at its sides. Kept clear of rivers, oases and lava pools.
  let oil = 0;
  let oilTop = 0;
  const oilGateD = wDunes > 0.85 ? smoothstep(0.86, 0.93, wDunes) * smoothstep(0.1, 0.16, riverGap) : 0;
  const oilGateS = wScar > 0.85 && !lava ? smoothstep(0.86, 0.93, wScar) * (1 - smoothstep(0.04, 0.12, lavaNoise)) : 0;
  const oilGate = oilGateD > 0 ? oilGateD * (1 - smoothstep(0.3, 0.4, t.oasis.noise2(x / 100, z / 100))) : oilGateS;
  if (oilGate > 0) {
    const o = t.oil.noise2(x / 34, z / 34);
    if (o > 0.12) {
      oilTop = oilGateD > 0 ? OIL_TOP_DUNES : OIL_TOP_SCAR;
      h = lerp(h, Math.max(h, oilTop + 0.95), smoothstep(0.12, 0.2, o) * oilGate);
      oil = smoothstep(0.29, 0.38, o) * smoothstep(0.97, 1, oilGate);
      if (oil > 0) h = lerp(h, oilTop - 1.6, oil);
    }
  }

  const height = clamp(Math.floor(h), 12, WORLD_HEIGHT - 8);
  out.height = height;
  out.wWood = wWood;
  out.wDunes = wDunes;
  out.wFrost = frost;
  out.wScar = wScar;
  out.wMarsh = wMarsh;
  let biome = WOODLAND;
  let best = wWood;
  if (wDunes > best) { biome = DUNES; best = wDunes; }
  if (frost > best) { biome = FROSTFELL; best = frost; }
  if (wScar > best) { biome = SCAR; best = wScar; }
  if (wMarsh > best) biome = MARSH;
  out.biome = biome;
  if (lava && height < LAVA_POOL_TOP) {
    out.liquid = LIQUID_LAVA;
    out.liquidTop = LAVA_POOL_TOP;
  } else if (oil > 0.02 && height < oilTop) {
    out.liquid = LIQUID_OIL;
    out.liquidTop = oilTop;
  } else if (height < WATER_TOP) {
    out.liquid = LIQUID_WATER;
    out.liquidTop = WATER_TOP;
  } else {
    out.liquid = LIQUID_NONE;
    out.liquidTop = height;
  }
  return out;
}

/** SURFACE_* material of the top solid block of a column. */
export function surfaceKind(t: Terrain, col: Column, x: number, z: number): number {
  const gravel = t.patchA.noise2(x / 11, z / 11);
  const clay = t.patchB.noise2(x / 15, z / 15);
  const depth = WATER_TOP - col.height;
  switch (col.biome) {
    case WOODLAND:
      if (col.liquid === LIQUID_WATER) {
        if (depth <= 3 && clay > 0.02) return SURFACE_CLAY;
        if (gravel > 0.22) return SURFACE_GRAVEL;
        return depth <= 3 ? SURFACE_SAND : SURFACE_DIRT;
      }
      if (depth >= -1) {
        if (gravel > 0.16) return SURFACE_GRAVEL;
        return clay > 0.33 ? SURFACE_CLAY : SURFACE_SAND;
      }
      if (t.rock.fbm2(x / 26, z / 26, 2) > 0.3 + (50 - col.height) * 0.012) return SURFACE_STONE;
      return gravel > 0.5 && depth >= -4 ? SURFACE_GRAVEL : SURFACE_GRASS;
    case DUNES:
      if (col.liquid === LIQUID_WATER) return clay > 0.15 ? SURFACE_CLAY : SURFACE_SAND;
      return t.rock.fbm2(x / 26, z / 26, 2) > 0.36 ? SURFACE_STONE : SURFACE_SAND;
    case FROSTFELL:
      if (col.liquid === LIQUID_WATER || depth >= -1) return gravel > 0.1 ? SURFACE_GRAVEL : SURFACE_STONE;
      return SURFACE_SNOW;
    case MARSH:
      // Clay-rich: pools are floored with clay or peat, and the wet ground between them shows both in patches.
      if (col.liquid === LIQUID_WATER) return clay > -0.12 ? SURFACE_CLAY : SURFACE_PEAT;
      if (depth >= 0) {
        if (clay > 0.26) return SURFACE_CLAY;
        if (gravel > 0.12) return SURFACE_PEAT;
      }
      return SURFACE_GRASS;
    default:
      if (col.liquid === LIQUID_NONE && gravel > 0.42) return SURFACE_GRAVEL;
      return SURFACE_BASALT;
  }
}

/** 0..1: how densely trees grow around x, z (before the biome decides whether any grow at all). */
export function forestDensity(t: Terrain, x: number, z: number): number {
  return smoothstep(-0.25, 0.4, t.forest.fbm2(x / 110, z / 110, 2));
}

/** True where caves are allowed to break through the surface. Trees and the spawn point avoid these spots. */
export function caveMouth(t: Terrain, x: number, z: number): boolean {
  return t.patchB.noise2(x / 37 + 400, z / 37 - 400) > 0.3;
}
