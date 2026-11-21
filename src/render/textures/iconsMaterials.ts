/** Item icons of raw materials, fuels, metals, powders and drawn stock. */
import type { Canvas, Painter, PainterSet } from './canvas';
import * as P from './palette';
import { type RGB, type Ramp, mix, shade } from './palette';
import { crushedPile, icon, ingot, lump, mound, plate, rampLegend, rod } from './shapes';

const FLINT: Ramp = [P.rgb(0x23232d), P.rgb(0x363744), P.rgb(0x4d4f60), P.rgb(0x6b6f85), P.rgb(0x959bb3)];
const SILICA: Ramp = [P.rgb(0x8e949c), P.rgb(0xb9bec4), P.rgb(0xd8dbdc), P.rgb(0xeceeec), P.rgb(0xffffff)];
const ALUMINA: Ramp = [P.rgb(0xa8806e), P.rgb(0xc9a28e), P.rgb(0xdfbfae), P.rgb(0xefd8ca), P.rgb(0xfcefe6)];
const LITHIUM: Ramp = [P.rgb(0x8a7fa4), P.rgb(0xb1a6c8), P.rgb(0xd2c9e2), P.rgb(0xe9e3f2), P.rgb(0xffffff)];
const CHAR: Ramp = [P.rgb(0x1a1412), P.rgb(0x2e2420), P.rgb(0x45362f), P.rgb(0x76583f), P.rgb(0xa07a58)];
const COAL: Ramp = [P.rgb(0x16161c), P.rgb(0x2a2a34), P.rgb(0x40404e), P.rgb(0x5f6076), P.rgb(0x9a9eba)];
const TIN: Ramp = [P.rgb(0x62665f), P.rgb(0x848a80), P.rgb(0xa5ab9e), P.rgb(0xc0c5b6), P.rgb(0xdfe2d2)];
const COKE: Ramp = [P.rgb(0x2b2c31), P.rgb(0x43454c), P.rgb(0x5e6069), P.rgb(0x7e818b), P.rgb(0xa9adb6)];

function stick(c: Canvas): void {
  rod(c, P.WOOD, 2, 2, 13);
  c.line(7, 8, 5, 5, P.WOOD[2]);
  c.set(5, 4, P.OAK_LEAF[3]);
  c.set(9, 6, P.WOOD[0]);
  c.set(4, 11, P.WOOD[0]);
}

function fiber(c: Canvas): void {
  // A bundle of plant strands, tied at the waist and splayed at both ends.
  const cols: RGB[] = [P.STRAW[3], P.GRASS[3], P.STRAW[4], P.GRASS[2], P.STRAW[2], P.GRASS[4]];
  const tops: [number, number][] = [[3, 1], [6, 1], [9, 1], [12, 2], [14, 4], [1, 3]];
  const bottoms: [number, number][] = [[2, 13], [5, 14], [8, 14], [11, 14], [13, 12], [1, 11]];
  for (let k = 0; k < 6; k++) {
    c.line(tops[k][0], tops[k][1], 7 + (k % 2), 7, cols[k]);
    c.line(7 + (k % 2), 8, bottoms[k][0], bottoms[k][1], cols[(k + 2) % 6]);
  }
  c.rect(6, 6, 4, 3, P.CLOTH[1]);
  c.rect(6, 6, 4, 1, P.CLOTH[3]);
}

function cord(c: Canvas): void {
  const k = P.CLOTH;
  c.each((x, y) => {
    const d = Math.hypot(x - 7, y - 7);
    if (d < 2.6 || d > 5.6) return null;
    const a = Math.atan2(y - 7, x - 7);
    const twist = Math.floor(a * 3 + d * 1.2) % 2 === 0;
    return twist ? (y < 7 ? k[4] : k[3]) : y < 7 ? k[2] : k[1];
  });
  for (let i = 0; i < 4; i++) {
    c.set(11 + i, 11 + (i >> 1), i % 2 === 0 ? k[3] : k[1]);
    c.set(11 + i, 12 + (i >> 1), k[1]);
  }
}

function flint(c: Canvas): void {
  // A knapped shard: three edges, conchoidal ripples spreading from the striking point.
  const inside = (x: number, y: number): boolean => {
    const s = (ax: number, ay: number, bx: number, by: number): number => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    return s(7, 1, 14, 12) >= 0 && s(14, 12, 2, 13) >= 0 && s(2, 13, 7, 1) >= 0;
  };
  c.each((x, y) => {
    if (!inside(x + 0.5, y + 0.5)) return null;
    const ripple = Math.floor(Math.hypot(x - 3, y - 13) / 2.2) % 2 === 0;
    const base = x - y * 0.3 < 3 ? 3 : ripple ? 2 : 1;
    return FLINT[base + (y < 6 ? 1 : 0)];
  });
  c.line(7, 1, 3, 11, FLINT[4]);
}

function coal(c: Canvas): void {
  lump(c, 5.5, 9.5, 4.5, 3.6, COAL);
  lump(c, 10, 7.5, 4, 4.2, COAL);
  c.set(9, 4, P.rgb(0xd0d8ff));
  c.set(3, 7, P.rgb(0xb0b8e0));
}

function charcoal(c: Canvas): void {
  // Two charred log sections: black checked bark, brown end grain with rings.
  for (const [x0, y0, len] of [[1, 3, 10], [4, 9, 10]]) {
    for (let y = y0; y <= y0 + 4; y++) {
      for (let x = x0; x < x0 + len; x++) {
        const crack = (x + (y >> 1)) % 3 === 0;
        c.set(x, y, y === y0 ? CHAR[3] : y === y0 + 4 ? CHAR[0] : crack ? CHAR[0] : CHAR[2]);
      }
    }
    c.each((x, y) => {
      const d = Math.hypot((x - (x0 + len)) * 1.4, y - (y0 + 2));
      if (d > 2.9) return null;
      return d < 1 ? CHAR[2] : Math.floor(d * 1.3) % 2 === 0 ? CHAR[4] : CHAR[3];
    });
  }
}

function coke(c: Canvas): void {
  lump(c, 7.5, 8, 6.2, 5, COKE);
  for (const [x, y] of [[4, 7], [7, 5], [9, 9], [11, 6], [6, 10], [10, 11], [3, 9]]) c.set(x, y, COKE[0]);
  c.set(5, 5, COKE[4]);
}

function sulfur(c: Canvas): void {
  const s = rampLegend(P.SULFUR);
  c.sprite(
    [
      '.....5.....',
      '....554..6.',
      '....5434.54',
      '.6..4433543',
      '.54.443343.',
      '5443443332.',
      '4433343322.',
      '3332332221.',
      '.22222221..',
    ],
    s,
    2,
    4,
  );
}

const ingotOf = (r: Ramp): Painter => icon((c) => ingot(c, r));
const plateOf = (r: Ramp): Painter => icon((c) => plate(c, r));
const crushedOf = (r: Ramp): Painter => icon((c) => crushedPile(c, r, P.STONE));
const powderOf = (r: Ramp, grains: RGB | null): Painter => icon((c) => mound(c, r, grains));

function fusedQuartz(c: Canvas): void {
  // A clear quartz point: pale rose facets, a white central ridge, a darker shadowed facet.
  const q = P.QUARTZ;
  const left = mix(q[3], P.GLASS[3], 0.4);
  const right = mix(q[1], P.GLASS[1], 0.4);
  for (let y = 1; y <= 14; y++) {
    const half = y < 5 ? y : 4;
    for (let x = 8 - half; x < 8 + half; x++) {
      const col = x < 7 ? left : x < 9 ? P.rgb(0xffffff) : right;
      c.set(x, y, y === 14 ? shade(right, -0.2) : col);
    }
  }
  c.line(5, 7, 6, 11, q[2]);
  c.set(10, 8, q[3]);
  c.set(10, 11, q[3]);
}

function copperWire(c: Canvas): void {
  // A hank of drawn wire: three loose loops and a free end.
  for (let k = 0; k < 3; k++) {
    c.each((x, y) => {
      const d = Math.hypot((x - 7 - k * 0.6) / 5.5, (y - 6.5 - k) / 3.6);
      return Math.abs(d - 1) < 0.13 ? (y < 6 + k ? P.COPPER[4] : P.COPPER[2]) : null;
    });
  }
  c.line(12, 10, 14, 14, P.COPPER[3]);
}

function copperCoil(c: Canvas): void {
  // Windings on a drum between two iron cheeks.
  for (let x = 3; x <= 12; x++) {
    for (let y = 4; y <= 11; y++) {
      const ridge = x % 2 === 1;
      c.set(x, y, y === 4 ? P.COPPER[4] : y === 11 ? P.COPPER[0] : ridge ? P.COPPER[3] : P.COPPER[1]);
    }
  }
  for (const x of [1, 13]) {
    c.rect(x, 3, 2, 10, P.IRON_METAL[2]);
    c.rect(x, 3, 1, 10, P.IRON_METAL[4]);
    c.rect(x, 12, 2, 1, P.IRON_METAL[0]);
  }
}

function graphiteElectrode(c: Canvas): void {
  rod(c, P.GRAPHITE, 3, 3, 12);
  for (const t of [4, 7, 10]) c.set(t, 15 - t - 1, P.GRAPHITE[0]);
  c.set(13, 1, P.GRAPHITE[4]);
}

function tungstenRod(c: Canvas): void {
  rod(c, P.TUNGSTEN, 2, 1, 14);
  c.set(15, 0, P.STEEL[4]);
  c.set(9, 5, P.STEEL[3]);
}

export const MATERIAL_ICONS: PainterSet = {
  item_stick: icon(stick),
  item_fiber: icon(fiber),
  item_cord: icon(cord),
  item_flint: icon(flint),
  item_coal: icon(coal),
  item_charcoal: icon(charcoal),
  item_coke: icon(coke),
  item_sulfur: icon(sulfur),
  item_copper_ingot: ingotOf(P.COPPER),
  item_tin_ingot: ingotOf(TIN),
  item_bronze_ingot: ingotOf(P.BRONZE),
  item_iron_ingot: ingotOf(P.IRON_METAL),
  item_steel_ingot: ingotOf(P.STEEL),
  item_aluminum_ingot: ingotOf(P.ALUMINUM),
  item_superalloy: ingotOf(P.SUPERALLOY),
  item_crushed_copper: crushedOf(P.COPPER),
  item_crushed_tin: crushedOf(TIN),
  item_crushed_iron: crushedOf(P.RUST),
  item_iron_plate: plateOf(P.IRON_METAL),
  item_steel_plate: plateOf(P.STEEL),
  item_silica: powderOf(SILICA, P.GLASS[2]),
  item_alumina: powderOf(ALUMINA, null),
  item_tungsten_powder: powderOf(P.TUNGSTEN, P.STEEL[3]),
  item_lithium_salt: powderOf(LITHIUM, P.rgb(0xffffff)),
  item_yellowcake: powderOf(P.YELLOWCAKE, P.URANIUM[3]),
  item_fused_quartz: icon(fusedQuartz),
  item_copper_wire: icon(copperWire),
  item_copper_coil: icon(copperCoil),
  item_graphite_electrode: icon(graphiteElectrode),
  item_tungsten_rod: icon(tungstenRod),
};

