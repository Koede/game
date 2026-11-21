/**
 * Fronts of the machines that use power, each showing what it does: fan, glowing coils, crusher jaws, flask
 * and condenser, drill head, spinning drum, electrolysis cells.
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel } from './brush';
import { CASE_IRON, front, well } from './casing';
import * as P from './palette';
import { type RGB, mix } from './palette';

const I = CASE_IRON;
const M = P.IRON_METAL;
const WHITE: RGB = P.rgb(0xffffff);

function blower(c: Canvas, lit: boolean): void {
  // A fan in a round shroud with a three-bar guard; running, the blades blur into a pale disc.
  c.disc(7.5, 6.5, 5.5, M[0]);
  c.disc(7.5, 6.5, 4.6, P.SOOT);
  if (lit) c.disc(7.5, 6.5, 4.2, mix(P.SOOT, M[3], 0.35));
  else {
    c.sprite(
      ['..bb.....', '..bbb....', '...bb..aa', '....o.aaa', '.aa.o..a.', 'aaa......', '.a..bb...', '....bbb..', '.....bb..'],
      { a: M[2], b: M[3], o: M[1] },
      3,
      2,
    );
  }
  c.disc(7.5, 6.5, 1.3, lit ? P.CYAN : M[4]);
  for (const y of [3, 6, 9]) c.rect(3, y, 10, 1, mix(M[1], P.SOOT, 0.15));
  c.ring(7.5, 6.5, 5.5, M[3]);
}

function spaceHeater(c: Canvas, lit: boolean): void {
  // A reflector behind three coiled elements that glow when powered.
  well(c, 2, 2, 12, 9, lit ? P.rgb(0x3a1a10) : P.SOOT);
  for (const y of [3, 6, 9]) {
    for (let x = 3; x <= 12; x++) {
      const up = x % 4 < 2;
      const hi = lit ? P.EMBER[4] : M[3];
      const lo = lit ? P.EMBER[2] : M[1];
      c.set(x, up ? y : y + 1, up ? hi : lo);
      if (x % 2 === 0) c.set(x, up ? y + 1 : y, lo);
    }
  }
  if (lit) for (let x = 3; x <= 12; x++) c.blend(x, 11, P.EMBER[2], 0.4);
}

function crusher(c: Canvas, lit: boolean): void {
  // Hazard-striped feed hopper over two toothed steel jaws that close towards the bottom.
  for (let x = 3; x <= 12; x++) {
    c.set(x, 2, Math.floor(x / 2) % 2 === 0 ? P.HAZARD : P.SOOT);
    c.set(x, 3, M[0]);
  }
  well(c, 3, 4, 10, 7);
  c.sprite(
    [
      'AAAa....bBBB',
      'AAAAa..bBBBB',
      'AAAa....bBBB',
      'AAAAAa.bBBBB',
      'AAAAa..bBBBB',
      'AAAAAAbBBBBB',
      'AAAAAa.bBBBB',
    ],
    { A: P.STEEL[2], a: P.STEEL[4], B: P.STEEL[0], b: P.STEEL[1] },
    2,
    4,
  );
  if (lit) for (const [x, y] of [[7, 4], [8, 5], [7, 7], [8, 11], [7, 12]]) c.set(x, y, P.RUST[3]);
  else c.set(7, 11, P.SOOT);
}

function still(c: Canvas, lit: boolean): void {
  // Round-bottomed flask on the left, copper condenser coil on the right, drip into a cup.
  const liquid = lit ? P.AMBER[3] : P.GLASS[0];
  c.rect(4, 2, 2, 3, P.GLASS[3]);
  c.disc(4.5, 7.5, 3.1, P.GLASS[2]);
  c.disc(4.5, 8, 2.4, lit ? liquid : mix(P.GLASS[1], P.SOOT, 0.5));
  c.set(3, 6, WHITE);
  if (lit) {
    c.set(4, 7, P.AMBER[4]);
    c.set(5, 9, P.AMBER[4]);
    c.rect(2, 11, 6, 1, P.EMBER[3]);
  } else c.rect(2, 11, 6, 1, I[0]);
  c.line(6, 2, 10, 2, P.COPPER[3]);
  for (let y = 3; y <= 9; y += 2) {
    c.line(9, y, 12, y, P.COPPER[3]);
    c.line(9, y + 1, 12, y + 1, P.COPPER[1]);
  }
  c.rect(11, 10, 1, 1, P.COPPER[2]);
  c.rect(10, 11, 3, 1, M[2]);
  if (lit) c.set(11, 11, P.AMBER[3]);
}

function boreRig(c: Canvas, lit: boolean): void {
  // A derrick frame round an auger bit; when running the flutes shift and the tip sparks.
  c.line(3, 2, 6, 12, M[2]);
  c.line(12, 2, 9, 12, M[2]);
  c.rect(3, 2, 10, 1, M[3]);
  c.rect(6, 3, 4, 1, P.HAZARD);
  const shift = lit ? 1 : 0;
  for (let y = 4; y <= 10; y++) {
    const w = y > 8 ? 1 : 2;
    const x0 = 8 - w;
    for (let x = x0; x < x0 + w * 2; x++) c.set(x, y, (x + y + shift) % 3 === 0 ? P.TUNGSTEN[4] : P.TUNGSTEN[2]);
  }
  c.rect(7, 11, 2, 1, P.TUNGSTEN[3]);
  if (lit) {
    c.set(6, 12, P.EMBER[4]);
    c.set(9, 12, P.EMBER[3]);
    c.set(8, 13, P.EMBER[4]);
  }
}

function centrifuge(c: Canvas, lit: boolean): void {
  // A drum with four sample tubes; spinning, the tubes smear into a glowing yellow ring.
  c.disc(7.5, 7, 5.5, M[3]);
  c.disc(7.5, 7, 4.6, P.SOOT);
  if (lit) {
    c.ring(7.5, 7, 3.2, P.YELLOWCAKE[3], 1.6);
    c.ring(7.5, 7, 3.2, P.YELLOWCAKE[4], 0.5);
  } else {
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      for (let r = 2; r <= 4; r++) c.set(Math.floor(7.5 + dx * r), Math.floor(7 + dy * r), r === 4 ? P.YELLOWCAKE[2] : M[2]);
    }
  }
  c.disc(7.5, 7, 1.3, M[4]);
  bevel(c, 2, 1, 12, 1, M[4], M[4]);
}

function electrolyzer(c: Canvas, lit: boolean): void {
  // Three glass cells of water, an electrode in each; bubbles stream up while it works.
  for (const x0 of [2, 6, 10]) {
    c.rect(x0, 2, 4, 10, P.GLASS[1]);
    c.rect(x0 + 1, 4, 2, 7, P.WATER[2]);
    c.rect(x0, 2, 4, 1, M[2]);
    c.rect(x0 + 1, 2, 1, 7, lit ? P.CYAN : P.GRAPHITE[3]);
    c.set(x0 + 3, 3, P.GLASS[4]);
    if (lit) for (const y of [5, 8, 10]) c.set(x0 + 2, y - (x0 % 3), WHITE);
  }
  c.rect(2, 12, 12, 1, I[0]);
}

export const CONSUMERS: PainterSet = {
  ...front('blower', blower),
  ...front('space_heater', spaceHeater),
  ...front('crusher', crusher),
  ...front('still', still),
  ...front('bore_rig', boreRig),
  ...front('centrifuge', centrifuge),
  ...front('electrolyzer', electrolyzer),
};
