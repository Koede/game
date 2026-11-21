/**
 * Generator fronts, each showing how it makes power: thermopile fins, boiler and piston, firebox and dynamo,
 * paddle wheel, rotor, engine cylinders, lava exchanger, hazard core - plus the solar cells on a panel's top.
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel, tone } from './brush';
import { front, well } from './casing';
import * as P from './palette';
import { type RGB, mix, shade } from './palette';

const I = P.IRON;
const M = P.IRON_METAL;
const WHITE: RGB = P.rgb(0xffffff);

function thermopile(c: Canvas, lit: boolean): void {
  // Stacked junction fins, copper and iron alternating, rooted in a hot base plate.
  well(c, 2, 2, 12, 9);
  for (let x = 3; x <= 12; x++) {
    const copper = x % 2 === 1;
    for (let y = 3; y <= 10; y++) {
      let col = copper ? (y === 3 ? P.COPPER[4] : P.COPPER[2]) : y === 3 ? P.IRON_METAL[4] : P.IRON_METAL[1];
      if (lit) col = mix(col, P.EMBER[3], Math.max(0, (y - 5) / 6) * 0.75);
      c.set(x, y, col);
    }
  }
  c.rect(2, 11, 12, 1, lit ? P.EMBER[2] : P.FIRED_CLAY[0]);
}

function steamEngine(c: Canvas, lit: boolean): void {
  // Riveted boiler drum on top, pressure gauge on its end, piston and flywheel below.
  c.rect(2, 2, 9, 5, P.COPPER[2]);
  c.rect(2, 2, 9, 1, P.COPPER[4]);
  c.rect(2, 6, 9, 1, P.COPPER[0]);
  for (const x of [3, 6, 9]) c.set(x, 4, P.COPPER[4]);
  c.disc(12, 4.5, 2.3, P.CERAMIC[3]);
  c.ring(12, 4.5, 2.3, I[0]);
  if (lit) c.line(12, 4, 13, 3, P.rgb(0xc03020));
  else c.line(12, 4, 11, 3, I[0]);
  // Piston cylinder, rod and crank wheel.
  c.rect(2, 8, 5, 3, P.IRON_METAL[2]);
  bevel(c, 2, 8, 5, 3, P.IRON_METAL[4], P.IRON_METAL[0]);
  c.rect(7, 9, lit ? 3 : 2, 1, P.IRON_METAL[4]);
  c.ring(10.5, 9.5, 1.9, P.IRON_METAL[3]);
  c.set(lit ? 11 : 10, lit ? 8 : 11, P.BRONZE[3]);
  if (lit) {
    c.set(4, 1, WHITE);
    c.set(5, 0, P.SNOW[2]);
    c.set(3, 0, P.SNOW[1]);
  }
}

function burnerGenerator(c: Canvas, lit: boolean): void {
  // Firebox with a grate on the left, dynamo windings on the right, joined by a shaft.
  well(c, 2, 4, 6, 7, lit ? P.EMBER[2] : P.SOOT);
  if (lit) {
    c.rect(3, 8, 4, 2, P.EMBER[4]);
    c.set(4, 6, P.EMBER[3]);
    c.set(5, 5, P.EMBER[3]);
  }
  for (const y of [6, 8, 10]) c.rect(2, y, 6, 1, I[0]);
  c.rect(9, 3, 5, 8, P.COPPER[1]);
  for (let y = 3; y < 11; y += 2) c.rect(9, y, 5, 1, P.COPPER[3]);
  bevel(c, 9, 3, 5, 8, P.IRON_METAL[3], I[0]);
  c.rect(8, 7, 1, 2, P.IRON_METAL[3]);
  c.rect(3, 2, 2, 2, I[1]);
}

function waterWheel(c: Canvas, lit: boolean): void {
  // A paddle wheel in a timber frame; when it turns the paddles trail water.
  const wood = P.WOOD;
  c.ring(7.5, 7, 5, wood[1], 1.2);
  const turn = lit ? Math.PI / 8 : 0;
  for (let k = 0; k < 8; k++) {
    const a = turn + (k * Math.PI) / 4;
    const x = Math.round(7.5 + Math.cos(a) * 5);
    const y = Math.round(7 + Math.sin(a) * 5);
    c.line(7.5, 7, x, y, wood[2]);
    c.rect(x - 1, y - 1, 2, 2, wood[3]);
  }
  c.disc(7.5, 7, 1.4, I[0]);
  c.set(7, 6, P.IRON_METAL[3]);
  if (lit) for (const [x, y] of [[3, 12], [5, 13], [10, 12], [8, 13], [12, 11]]) c.set(x, y, P.WATER[4]);
  else c.rect(2, 12, 9, 1, P.WATER[1]);
}

function windTurbine(c: Canvas, lit: boolean): void {
  // Three pale blades round a hub; spinning, they smear into a faint disc.
  if (lit) c.each((x, y) => (Math.hypot(x - 7.5, y - 7) < 5.8 ? mix(c.get(x, y), P.ALUMINUM[2], 0.22) : null));
  const turn = lit ? 0.6 : 0;
  for (let k = 0; k < 3; k++) {
    const a = turn - Math.PI / 2 + (k * Math.PI * 2) / 3;
    for (let r = 1.5; r <= 5.8; r += 0.5) {
      const x = 7.5 + Math.cos(a) * r;
      const y = 7 + Math.sin(a) * r;
      c.set(Math.floor(x), Math.floor(y), r > 4.5 ? P.ALUMINUM[4] : P.ALUMINUM[3]);
      c.set(Math.floor(x + Math.cos(a + 1.57)), Math.floor(y + Math.sin(a + 1.57)), P.ALUMINUM[1]);
    }
  }
  c.disc(7.5, 7, 1.5, I[3]);
  c.set(7, 6, P.IRON_METAL[4]);
}

function combustionEngine(c: Canvas, lit: boolean): void {
  // Three finned cylinders with domed heads under an exhaust manifold that glows when the engine runs.
  c.rect(2, 1, 12, 2, M[0]);
  c.rect(2, 1, 12, 1, M[2]);
  for (const x of [4, 8, 12]) c.set(x, 2, lit ? P.EMBER[4] : P.SOOT);
  for (const x0 of [2, 6, 10]) {
    c.rect(x0 + 1, 3, 2, 1, M[4]);
    for (let y = 4; y <= 10; y++) c.rect(x0, y, 4, 1, y % 2 === 0 ? M[3] : M[1]);
    c.rect(x0 + 3, 4, 1, 7, M[0]);
  }
  c.rect(2, 11, 10, 1, lit ? P.BRONZE[3] : P.BRONZE[1]);
}

function geothermalTap(c: Canvas, lit: boolean): void {
  // A heat-exchanger column fed by lava, with a dial reading its temperature.
  well(c, 5, 2, 6, 10, lit ? P.LAVA[2] : P.rgb(0x2a1410));
  for (let y = 3; y <= 11; y++) {
    for (let x = 6; x <= 10; x++) {
      const wave = (x + y * 2) % 5 === 0;
      if (lit) c.set(x, y, wave ? P.LAVA[4] : y % 3 === 0 ? P.LAVA[3] : P.LAVA[2]);
      else if (wave) c.set(x, y, P.LAVA[0]);
    }
  }
  for (const y of [4, 8]) {
    c.rect(4, y, 1, 2, P.IRON_METAL[3]);
    c.rect(11, y, 1, 2, P.IRON_METAL[3]);
  }
  c.rect(2, 3, 2, 7, P.IRON_METAL[1]);
  c.rect(12, 3, 2, 7, P.IRON_METAL[1]);
}

function fissionPile(c: Canvas, lit: boolean): void {
  // Hazard-striped bezel around the core and its four rod channels.
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7);
    if (d > 5.8 || d < 4.6) return null;
    return Math.floor((x + y) / 2) % 2 === 0 ? P.HAZARD : P.SOOT;
  });
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7);
    if (d >= 4.6) return null;
    if (!lit) return d < 3.5 ? shade(P.URANIUM[0], -0.3) : I[0];
    return d < 2 ? WHITE : d < 3.2 ? P.ARC_GLOW[2] : P.ARC_GLOW[1];
  });
  for (const [x, y] of [[6, 5], [9, 5], [6, 8], [9, 8]]) c.set(x, y, lit ? P.URANIUM[4] : P.URANIUM[1]);
}

function solarTop(c: Canvas): void {
  // Aluminium frame around 2x2 groups of deep-blue cells split by silver bus bars.
  const cell: RGB[] = [P.rgb(0x1a2550), P.rgb(0x22306a), P.rgb(0x2c3d80)];
  c.each((x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return P.ALUMINUM[1];
    if (x === 1 || y === 1) return P.ALUMINUM[3];
    if (x === 14 || y === 14) return P.ALUMINUM[0];
    if (x === 8 || y === 8) return P.ALUMINUM[2];
    if (x % 3 === 2 && y % 6 !== 0) return shade(cell[0], 0.2);
    return tone(cell, ((x + y) % 7) / 7);
  });
  for (const [x, y] of [[3, 5], [4, 4], [10, 11], [11, 10]]) c.set(x, y, P.rgb(0x7f9ad8));
}

export const GENERATORS: PainterSet = {
  ...front('thermopile', thermopile),
  ...front('steam_engine', steamEngine),
  ...front('burner_generator', burnerGenerator),
  ...front('water_wheel', waterWheel),
  ...front('wind_turbine', windTurbine),
  ...front('combustion_engine', combustionEngine),
  ...front('geothermal_tap', geothermalTap),
  ...front('fission_pile', fissionPile),
  solar_panel_top: solarTop,
};
