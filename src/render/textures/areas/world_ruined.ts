/** Tiles of the ruined and repaired old-age machine (src/content/areas/world_ruined.ts). */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { rgb } from '../palette';

const RUST = [rgb(0x3a2418), rgb(0x573420), rgb(0x7a4a2a), rgb(0x9a6234), rgb(0xb98048)];

function ruined(c: Canvas): void {
  c.fill(RUST[2]);
  c.each((x, y) => (c.hash(x, y) < 0.25 ? RUST[1] : c.hash(x, y, 1) > 0.85 ? RUST[3] : c.hash(x, y, 2) > 0.95 ? RUST[4] : null));
  c.frame(0, 0, 16, 16, RUST[0]);
  c.disc(8, 8, 4, RUST[1]);
  c.ring(8, 8, 4, RUST[0], 1);
  for (let i = 0; i < 8; i++) c.set(8 + Math.round(Math.cos(i * 0.785) * 5), 8 + Math.round(Math.sin(i * 0.785) * 5), RUST[4]);
  c.rect(7, 7, 2, 2, RUST[0]);
}

function ruinedTop(c: Canvas): void {
  c.fill(RUST[1]);
  c.each((x, y) => (c.hash(x, y, 5) < 0.3 ? RUST[0] : c.hash(x, y, 6) > 0.8 ? RUST[3] : c.hash(x, y, 7) > 0.9 ? RUST[4] : null));
  c.frame(0, 0, 16, 16, RUST[0]);
  c.rect(3, 3, 10, 10, RUST[2]);
  c.frame(3, 3, 10, 10, RUST[0]);
}

function repaired(c: Canvas): void {
  c.fill(P.BRONZE[2]);
  c.each((x, y) => (c.hash(x, y) < 0.2 ? P.BRONZE[1] : c.hash(x, y, 1) > 0.88 ? P.BRONZE[3] : null));
  c.frame(0, 0, 16, 16, P.BRONZE[0]);
  c.disc(8, 8, 4, P.BRONZE[3]);
  c.ring(8, 8, 4, P.BRONZE[0], 1);
  c.rect(7, 7, 2, 2, rgb(0x9fe3d4));
  for (let i = 0; i < 8; i++) c.set(8 + Math.round(Math.cos(i * 0.785) * 5), 8 + Math.round(Math.sin(i * 0.785) * 5), P.BRONZE[4]);
}

function repairedTop(c: Canvas): void {
  c.fill(P.BRONZE[3]);
  c.each((x, y) => (c.hash(x, y, 5) < 0.25 ? P.BRONZE[2] : c.hash(x, y, 6) > 0.9 ? P.BRONZE[4] : null));
  c.frame(0, 0, 16, 16, P.BRONZE[1]);
  c.rect(3, 3, 10, 10, P.BRONZE[2]);
  c.frame(3, 3, 10, 10, P.BRONZE[0]);
  c.rect(7, 7, 2, 2, rgb(0x9fe3d4));
}

export default { ruined_machine: ruined, ruined_machine_top: ruinedTop, repaired_machine: repaired, repaired_machine_top: repairedTop } satisfies PainterSet;
