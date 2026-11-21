/** Icons of the Current Age engines: the chainsaw, the tractor and its tiller and harvester attachments (16x16). */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { icon } from './shapes';

const ORANGE = [P.rgb(0x6a2410), P.rgb(0xa8400f), P.rgb(0xe0701c), P.rgb(0xf79a38), P.rgb(0xffcb7a)];
const GREEN = [P.rgb(0x1e3a22), P.rgb(0x2f5a30), P.rgb(0x437a3b), P.rgb(0x5fa04a), P.rgb(0x8cc96a)];

function chainsaw(c: Canvas): void {
  // Engine housing (left), rear handle, front grip, a long steel bar with a toothed chain, pull-start and fuel cap.
  c.rect(1, 5, 7, 6, ORANGE[2]);
  c.rect(1, 5, 7, 1, ORANGE[4]);
  c.rect(1, 10, 7, 1, ORANGE[0]);
  c.rect(1, 5, 1, 6, ORANGE[3]);
  c.rect(1, 2, 6, 1, P.GRAPHITE[2]);
  c.rect(1, 2, 1, 3, P.GRAPHITE[2]);
  c.rect(6, 2, 1, 3, P.GRAPHITE[2]);
  c.rect(2, 11, 4, 3, P.GRAPHITE[2]);
  c.rect(2, 11, 4, 1, P.GRAPHITE[4]);
  c.rect(8, 6, 7, 3, P.STEEL[2]);
  c.rect(8, 6, 7, 1, P.STEEL[4]);
  c.rect(8, 8, 7, 1, P.STEEL[0]);
  for (let x = 8; x <= 14; x += 2) {
    c.set(x, 5, P.STEEL[4]);
    c.set(x + 1, 9, P.STEEL[4]);
  }
  c.set(15, 7, P.STEEL[3]);
  c.rect(4, 6, 2, 2, P.GRAPHITE[1]);
  c.set(3, 8, P.SOOT);
  c.set(6, 9, ORANGE[0]);
}

function tractor(c: Canvas): void {
  // Side view: big rear wheel, small front wheel, bonnet, cab frame and an exhaust stack.
  c.rect(1, 6, 8, 5, GREEN[2]);
  c.rect(1, 6, 8, 1, GREEN[4]);
  c.rect(1, 10, 8, 1, GREEN[0]);
  c.rect(8, 7, 6, 3, GREEN[2]);
  c.rect(8, 7, 6, 1, GREEN[4]);
  c.rect(1, 3, 6, 1, P.GRAPHITE[2]);
  c.rect(1, 3, 1, 4, P.GRAPHITE[2]);
  c.rect(6, 3, 1, 4, P.GRAPHITE[2]);
  c.rect(3, 5, 2, 1, ORANGE[2]);
  c.rect(12, 4, 1, 3, P.GRAPHITE[3]);
  c.rect(2, 8, 5, 6, P.GRAPHITE[1]);
  c.rect(3, 9, 3, 4, P.GRAPHITE[3]);
  c.set(4, 11, ORANGE[3]);
  c.rect(10, 10, 4, 4, P.GRAPHITE[1]);
  c.rect(11, 11, 2, 2, P.GRAPHITE[3]);
  c.set(12, 7, P.rgb(0xfff0a0));
}

function tiller(c: Canvas): void {
  // A frame bar carrying a drum of tines.
  c.rect(1, 2, 14, 2, P.IRON_METAL[2]);
  c.rect(1, 2, 14, 1, P.IRON_METAL[4]);
  c.rect(3, 3, 1, 4, P.IRON_METAL[2]);
  c.rect(12, 3, 1, 4, P.IRON_METAL[2]);
  c.rect(2, 7, 12, 3, P.STEEL[2]);
  c.rect(2, 7, 12, 1, P.STEEL[4]);
  for (let x = 2; x <= 13; x += 2) {
    c.rect(x, 10, 1, 4, P.STEEL[3]);
    c.set(x, 13, P.STEEL[4]);
    c.set(x + 1, 11, P.STEEL[1]);
  }
}

function harvester(c: Canvas): void {
  // A reel with slats over a cutter bar and a grain hopper.
  c.rect(1, 12, 14, 2, P.STEEL[2]);
  for (let x = 1; x <= 14; x += 2) c.set(x, 14, P.STEEL[4]);
  c.rect(2, 3, 12, 1, ORANGE[2]);
  c.rect(2, 3, 1, 9, P.IRON_METAL[2]);
  c.rect(13, 3, 1, 9, P.IRON_METAL[2]);
  for (let x = 4; x <= 11; x += 2) c.rect(x, 4, 1, 7, ORANGE[3]);
  c.rect(5, 1, 6, 2, P.WOOD[2]);
  c.rect(5, 1, 6, 1, P.WOOD[4]);
  for (let x = 4; x <= 11; x += 2) c.set(x, 11, P.STRAW[3]);
}

export const VEHICLE_ICONS: PainterSet = {
  item_chainsaw: icon(chainsaw),
  item_tractor: icon(tractor),
  item_tractor_tiller: icon(tiller),
  item_tractor_harvester: icon(harvester),
};
