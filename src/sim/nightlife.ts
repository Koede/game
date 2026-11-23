/**
 * Day/night creatures (docs/api/nightlife.md): harmless fireflies, bats and owls that exist only as a pure function of
 * (seed, world time, weather, biome, the cell they live in). Nothing is stored, nothing can be hurt or hurt you: the
 * renderer asks `critters` each frame for the ones around the player and draws them as light particles.
 *
 *  - fireflies: dark and dry; thick over marsh pools, sparse in woodland; they blink and drift
 *  - bats: dusk and dawn only (the sky half dark), circling high, never in the frostfell
 *  - owls: deep night in the woodland, perched still on the highest block of a cell, eyes blinking
 */
import { hashFloat } from '../core/math';

export type CritterKind = 'firefly' | 'bat' | 'owl';
export interface Critter { kind: CritterKind; x: number; y: number; z: number; /** 0..1 brightness (blink). */ glow: number }

export interface NightEnv {
  seed: number;
  /** 0 full day .. 1 deepest night. */
  dark: number;
  raining: boolean;
  /** World seconds, for motion. */
  timeS: number;
  biomeAt(x: number, z: number): 'woodland' | 'dunes' | 'frostfell' | 'scar' | 'marsh';
  /** Highest non-air block of a column, or -1 when unloaded. */
  surfaceY(x: number, z: number): number;
}

export const CELL = 12;
export const RADIUS_CELLS = 3;
export const FIREFLY_DARK = 0.55;
export const OWL_DARK = 0.85;
/** Bats fly while the sky is between these darkness levels. */
export const BAT_DARK: readonly [number, number] = [0.2, 0.8];

const S_FIREFLY = 0x6666;
const S_BAT = 0x6b61;
const S_OWL = 0x6f77;

/** Darkness 0..1 from the clock's sunlight factor (1 = full sun). */
export const darkOf = (sunlight: number): number => Math.min(1, Math.max(0, 1 - sunlight));

/** Critters in the cells within RADIUS_CELLS of (px, pz). Reuse `out` to avoid garbage. */
export function critters(env: NightEnv, px: number, pz: number, out: Critter[] = []): Critter[] {
  out.length = 0;
  const cx0 = Math.floor(px / CELL);
  const cz0 = Math.floor(pz / CELL);
  for (let cx = cx0 - RADIUS_CELLS; cx <= cx0 + RADIUS_CELLS; cx++) {
    for (let cz = cz0 - RADIUS_CELLS; cz <= cz0 + RADIUS_CELLS; cz++) cell(env, cx, cz, out);
  }
  return out;
}

function cell(env: NightEnv, cx: number, cz: number, out: Critter[]): void {
  const { seed, dark, timeS } = env;
  const mx = cx * CELL + CELL / 2;
  const mz = cz * CELL + CELL / 2;
  const biome = env.biomeAt(mx, mz);
  const ground = env.surfaceY(mx, mz);
  if (ground < 0) return;
  if (!env.raining && dark >= FIREFLY_DARK && (biome === 'marsh' || biome === 'woodland')) {
    const chance = biome === 'marsh' ? 0.75 : 0.25;
    if (hashFloat(seed, cx, cz, S_FIREFLY) < chance) {
      const n = 2 + Math.floor(hashFloat(seed, cx, cz, S_FIREFLY + 1) * 3);
      for (let i = 0; i < n; i++) {
        const ph = hashFloat(seed, cx, cz, S_FIREFLY + 10 + i) * 6.283;
        const ox = (hashFloat(seed, cx, cz, S_FIREFLY + 20 + i) - 0.5) * CELL;
        const oz = (hashFloat(seed, cx, cz, S_FIREFLY + 30 + i) - 0.5) * CELL;
        out.push({
          kind: 'firefly', x: mx + ox + Math.sin(timeS * 0.5 + ph) * 1.2, y: ground + 1.4 + Math.sin(timeS * 0.8 + ph * 2) * 0.5,
          z: mz + oz + Math.cos(timeS * 0.45 + ph) * 1.2, glow: 0.5 + 0.5 * Math.sin(timeS * 2.2 + ph * 3),
        });
      }
    }
  }
  if (dark >= BAT_DARK[0] && dark <= BAT_DARK[1] && biome !== 'frostfell' && hashFloat(seed, cx, cz, S_BAT) < 0.1) {
    const n = 1 + Math.floor(hashFloat(seed, cx, cz, S_BAT + 1) * 3);
    for (let i = 0; i < n; i++) {
      const ph = hashFloat(seed, cx, cz, S_BAT + 10 + i) * 6.283;
      const r = 2.5 + hashFloat(seed, cx, cz, S_BAT + 20 + i) * 2.5;
      const w = 1.6 + hashFloat(seed, cx, cz, S_BAT + 30 + i) * 0.8;
      out.push({ kind: 'bat', x: mx + Math.cos(timeS * w + ph) * r, y: ground + 6 + Math.sin(timeS * 3 + ph) * 0.8, z: mz + Math.sin(timeS * w + ph) * r, glow: 0 });
    }
  }
  if (dark >= OWL_DARK && biome === 'woodland' && hashFloat(seed, cx, cz, S_OWL) < 0.06) {
    const ox = Math.floor((hashFloat(seed, cx, cz, S_OWL + 1) - 0.5) * CELL);
    const oz = Math.floor((hashFloat(seed, cx, cz, S_OWL + 2) - 0.5) * CELL);
    const top = env.surfaceY(mx + ox, mz + oz);
    if (top >= 0) {
      const blink = Math.sin(timeS * 0.7 + hashFloat(seed, cx, cz, S_OWL + 3) * 6.283) > 0.93 ? 0 : 1;
      out.push({ kind: 'owl', x: Math.floor(mx + ox) + 0.5, y: top + 1.2, z: Math.floor(mz + oz) + 0.5, glow: blink });
    }
  }
}
