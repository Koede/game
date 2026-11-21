/** First-pass family painters so every name is covered while the dedicated families are written. */
import { TEXTURE_NAMES } from '../../core/registry';
import type { Canvas, Painter } from './canvas';
import * as P from './palette';
import { type Ramp, type RGB, shade } from './palette';

const terrain: Record<string, Ramp> = {
  corestone: P.CORESTONE, stone: P.STONE, rubble: P.STONE, dirt: P.DIRT, grass_top: P.GRASS, sand: P.SAND,
  gravel: P.STONE, clay: P.CLAY, snow: P.SNOW, ice: P.ICE, basalt: P.BASALT, limestone: P.LIMESTONE,
  water: P.WATER, lava: P.LAVA, oak_leaves: P.OAK_LEAF, pine_leaves: P.PINE_LEAF, plank: P.WOOD,
  oak_log_side: P.OAK_BARK, pine_log_side: P.PINE_BARK, log_top: P.WOOD, concrete: P.CONCRETE, corium: P.URANIUM,
  stone_brick: P.STONE, brick: P.BRICK, crate: P.WOOD, workbench_side: P.WOOD, workbench_top: P.WOOD,
};
const fleck: Record<string, RGB> = {
  coal_ore: P.COAL[1], copper_ore: P.COPPER[3], tin_ore: P.TIN[3], iron_ore: P.RUST[3], sulfur_ore: P.SULFUR[3],
  quartz_ore: P.QUARTZ[3], bauxite: P.OXIDE_RED[3], wolframite: P.STEEL[2], spodumene: P.LILAC[3],
  pitchblende: P.URANIUM[3], oil_shale: P.AMBER[3],
};

function rampFor(name: string): Ramp {
  if (name.startsWith('furnace_clay')) return P.FIRED_CLAY;
  if (name.startsWith('furnace_blast')) return P.BRICK;
  if (name.startsWith('furnace_arc')) return P.ARC_STEEL;
  if (name.startsWith('furnace_plasma')) return P.STAR_ALLOY;
  if (name.startsWith('furnace_star')) return P.GOLD;
  if (/copper/.test(name)) return P.COPPER;
  if (/bronze/.test(name)) return P.BRONZE;
  if (/steel/.test(name)) return P.STEEL;
  if (/iron/.test(name)) return P.IRON_METAL;
  if (/tin/.test(name)) return P.TIN;
  if (/alumin/.test(name)) return P.ALUMINUM;
  if (/flint|coal|coke|graphite/.test(name)) return P.COAL;
  if (/sulfur|yellowcake/.test(name)) return P.SULFUR;
  if (/stick|plank|pail|bellows/.test(name)) return P.WOOD;
  if (/fiber|cord|coat/.test(name)) return P.CLOTH;
  return P.IRON;
}

function paint(c: Canvas, name: string): void {
  const base = terrain[name];
  if (base || name in fleck) {
    c.mottle(base ?? P.STONE, 4, 4, 0.6);
    const f = fleck[name];
    if (f) for (const [x, y] of c.scatter(6, 4)) c.rect(x, y, 2, 2, f);
    return;
  }
  const ramp = rampFor(name);
  if (name.startsWith('item_')) {
    c.disc(7.5, 7.5, 5.5, ramp[2]);
    c.disc(6.5, 6.5, 3, ramp[3]);
    c.outline();
    return;
  }
  c.mottle(ramp, 4, 4, 0.5);
  c.frame(0, 0, 16, 16, ramp[0]);
  if (/front|lamp/.test(name)) {
    const lit = name.endsWith('_on');
    c.rect(4, 5, 8, 7, lit ? P.EMBER[3] : P.SOOT);
    if (lit) c.rect(6, 7, 4, 3, shade(P.EMBER[4], 0.3));
  }
}

export const PROVISIONAL: Record<string, Painter> = {};
for (const name of TEXTURE_NAMES) PROVISIONAL[name] = (c) => paint(c, name);
