/**
 * Surface and cave life of the richer world (spec 14): wild flowers, ferns, reeds, berry bushes, glowcaps, crystal
 * clusters and the ice spike tip. Cutout tiles (alpha 0 or 255) that grow up from the bottom edge, where the cross
 * mesh meets the ground, like the farm plants.
 */
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { type RGB, type Ramp, rgb, shade } from './palette';

const ramp = (a: number, b: number, c: number, d: number, e: number): Ramp => [rgb(a), rgb(b), rgb(c), rgb(d), rgb(e)];

const STEM = ramp(0x2c4419, 0x3d5c21, 0x53782b, 0x6c9436, 0x94b85a);
const POPPY = ramp(0x5c0e12, 0x941a1a, 0xc8301f, 0xec5a2c, 0xff9a5a);
const SKYBELL = ramp(0x1e2c6e, 0x2f4aa8, 0x4a74d8, 0x7aa6f0, 0xc0dcff);
const LILY = ramp(0x8a92b4, 0xb4bcd6, 0xd8def0, 0xf0f4fc, 0xffffff);
const FERN = ramp(0x1a3a1c, 0x245226, 0x316c30, 0x44893c, 0x6eac58);
const REED = ramp(0x4a5628, 0x66742f, 0x83903a, 0xa2ab4c, 0xc4c672);
const CATTAIL = ramp(0x2e1a10, 0x472816, 0x60391e, 0x7a4c2a, 0x9a683e);
const BUSH = ramp(0x172e1a, 0x213f22, 0x2d532b, 0x3d6a35, 0x588a48);
const BERRY = ramp(0x2a0c24, 0x4e1238, 0x7a1a4c, 0xa8306a, 0xe07aa4);
const UNRIPE = ramp(0x51682a, 0x6c8634, 0x8aa442, 0xa8c05c, 0xccdc8a);
const GILL = ramp(0x0e2a30, 0x14404a, 0x1e5a64, 0x2c7880, 0x4aa0a6);
const GLOWCAP = ramp(0x1a6c78, 0x2ea4b0, 0x52d2d8, 0x9cf2f0, 0xe8fffc);
const STALK_PALE = ramp(0x8a8a7a, 0xa8a692, 0xc6c2aa, 0xdedac4, 0xf4f0de);
const CRYSTAL = ramp(0x3a6a78, 0x5f9aa8, 0x92cad2, 0xc8eeee, 0xffffff);
const POLLEN: RGB = rgb(0xf2c440);

/** A stem rising from the bottom row: `h` tall, curving by `lean` pixels at the tip. Returns the tip. */
function stem(c: Canvas, x0: number, h: number, lean: number, r: Ramp = STEM): [number, number] {
  let tip: [number, number] = [x0, 15];
  for (let i = 0; i < h; i++) {
    const x = x0 + Math.round(lean * (i / h) * (i / h));
    const y = 15 - i;
    c.set(x, y, i === 0 ? r[0] : i > h - 3 ? r[3] : r[2]);
    tip = [x, y];
  }
  return tip;
}

/** A lance leaf from (x, y) outwards in direction `dir`, `len` long, rising a little: lit on top, shaded below. */
function blade(c: Canvas, x: number, y: number, dir: 1 | -1, len: number, r: Ramp = STEM): void {
  for (let i = 1; i <= len; i++) {
    const yy = y - Math.floor(i / 2.5);
    c.set(x + dir * i, yy, i === len ? r[4] : r[3]);
    if (i < len - 1) c.set(x + dir * i, yy + 1, r[1]);
  }
}

// ---- flowers ---------------------------------------------------------------------------------------

/** A poppy head: a cup of four broad petals round a black eye. (x, y) is its centre. */
function poppyHead(c: Canvas, x: number, y: number): void {
  c.sprite(['.cdc.', 'bcdcb', 'bcecb', '.aba.'], { a: POPPY[0], b: POPPY[1], c: POPPY[2], d: POPPY[3], e: P.COAL[1] }, x - 2, y - 2);
  c.set(x - 1, y - 2, POPPY[4]);
}

function emberPoppy(c: Canvas): void {
  const [ax, ay] = stem(c, 7, 12, 1);
  const [bx, by] = stem(c, 11, 8, 1);
  const [ux, uy] = stem(c, 4, 9, -1);
  blade(c, 7, 13, -1, 4);
  blade(c, 8, 12, 1, 3);
  blade(c, 11, 14, 1, 3);
  blade(c, 4, 14, -1, 3);
  poppyHead(c, ax, ay);
  poppyHead(c, bx, by);
  // A nodding bud, still in its green sepals with red showing at the tip.
  c.sprite(['.a.', 'bcb', '.b.'], { a: POPPY[2], b: STEM[2], c: POPPY[1] }, ux - 1, uy - 1);
}

/** A nodding bell hanging below (x, y): flared mouth at the bottom, lit on its left. */
function bell(c: Canvas, x: number, y: number): void {
  c.sprite(['.b.', 'cdb', 'cdb', 'a.a'], { a: SKYBELL[1], b: SKYBELL[2], c: SKYBELL[4], d: SKYBELL[3] }, x - 1, y);
}

function skybell(c: Canvas): void {
  // Two arching stems, each carrying bells that hang from short pedicels, over grassy leaves.
  const arch = (x0: number, h: number, reach: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= h; i++) pts.push([x0 + Math.round(reach * Math.pow(i / h, 3)), 15 - i]);
    for (let i = 1; i <= Math.abs(reach); i++) pts.push([x0 + reach + Math.sign(reach) * i, 15 - h + Math.floor(i / 2)]);
    return pts;
  };
  const stems = [arch(5, 12, 3), arch(10, 9, -3)];
  for (const pts of stems) pts.forEach(([x, y], i) => c.set(x, y, i < 2 ? STEM[0] : STEM[2]));
  for (const [x, y] of [[9, 4], [11, 5], [12, 7], [6, 7], [4, 8]] as const) {
    c.set(x, y, STEM[3]);
    bell(c, x, y + 1);
  }
  blade(c, 5, 14, -1, 4);
  blade(c, 6, 13, 1, 3);
  blade(c, 10, 14, 1, 4);
}

/** A lily trumpet seen from the side, opening upwards: three reflexed petals and stamens. (x, y) = its foot. */
function lilyHead(c: Canvas, x: number, y: number): void {
  c.sprite(
    ['a..e..a', 'bc.e.cb', '.cdddc.', '..cdc..', '...c...'],
    { a: LILY[4], b: LILY[3], c: LILY[2], d: LILY[1], e: POLLEN },
    x - 3,
    y - 4,
  );
}

function frostLily(c: Canvas): void {
  const [ax, ay] = stem(c, 6, 11, 0);
  const [bx, by] = stem(c, 11, 8, 1);
  // Broad strap leaves from the base, frosted at their tips.
  blade(c, 6, 14, -1, 5);
  blade(c, 7, 13, 1, 3);
  blade(c, 11, 14, 1, 4);
  c.set(1, 12, LILY[3]);
  c.set(15, 12, LILY[3]);
  lilyHead(c, ax, ay);
  lilyHead(c, bx, by);
}

// ---- foliage -----------------------------------------------------------------------------------------

/** A fern frond rising from the base and arching over: a midrib with leaflets that shorten towards the tip. */
function fernFrond(c: Canvas, x0: number, h: number, reach: number): void {
  for (let i = 0; i <= h; i++) {
    const t = i / h;
    const x = x0 + Math.round(reach * t * t);
    const y = 15 - Math.round(i - (t > 0.75 ? (t - 0.75) * 8 : 0));
    c.set(x, y, i < 2 ? FERN[0] : FERN[2]);
    if (i < 3) continue;
    const len = Math.max(1, Math.round((1 - t) * 3.2));
    for (let k = 1; k <= len; k++) {
      c.set(x - k, y + (k > 1 ? 1 : 0), i % 2 === 0 ? FERN[3] : FERN[1]);
      c.set(x + k, y + (k > 1 ? 1 : 0), i % 2 === 0 ? FERN[1] : FERN[3]);
    }
    if (len >= 2) c.set(x - len, y + 1, FERN[4]);
  }
}

function fern(c: Canvas): void {
  fernFrond(c, 7, 12, -4);
  fernFrond(c, 8, 13, 4);
  fernFrond(c, 6, 9, -6);
  fernFrond(c, 9, 10, 5);
  // A fiddlehead still uncurling at the heart of the clump.
  c.sprite(['.ab', 'a.b', '.bb'], { a: FERN[4], b: FERN[3] }, 7, 4);
  for (let y = 7; y < 15; y++) c.set(8, y, FERN[2]);
}

function reeds(c: Canvas): void {
  // Tall stiff stems, three of them carrying brown cattail heads, and long ribbon leaves.
  const stems: Array<[number, number, number, boolean]> = [[2, 12, 0, false], [4, 15, 0, true], [7, 13, -1, false], [9, 14, 0, true], [12, 15, 1, true], [14, 11, 0, false]];
  for (const [x, h, lean, head] of stems) {
    const [tx, ty] = stem(c, x, h, lean, REED);
    if (!head) continue;
    for (let i = 0; i < 4; i++) {
      c.set(tx, ty + 1 + i, i === 0 ? CATTAIL[3] : CATTAIL[2]);
      c.set(tx + 1, ty + 1 + i, i === 3 ? CATTAIL[0] : CATTAIL[1]);
    }
    c.set(tx, ty, REED[4]);
  }
  for (const [x, y, dir, len] of [[4, 11, -1, 3], [9, 12, 1, 3], [12, 9, -1, 2], [7, 14, 1, 4]] as const) blade(c, x, y, dir, len, REED);
}

// ---- berry bushes -------------------------------------------------------------------------------------

/** The leafy mass both bush stages share (painted on the berry bush's own random stream so they match). */
function bushBody(c: Canvas, sparse: boolean): void {
  c.withSeed('berry_bush', () => {
    const edge = c.noise(4, 4, 1);
    const tex = c.noise(2, 2, 2);
    c.each((x, y) => {
      const dx = (x + 0.5 - 8) / 7.2;
      const dy = (y + 0.5 - 9.6) / 6.4;
      const d = dx * dx + dy * dy + (edge(x, y) - 0.5) * 0.55;
      if (d > 1 || y > 14) return null;
      // Gaps between leaf clumps let the cutout breathe; a picked bush is thinner still.
      if (c.hash(x, y, 4) < (sparse ? 0.3 : 0.12)) return null;
      const lit = -dx * 0.5 - dy * 0.7 + (tex(x, y) - 0.5) * 0.9;
      return lit > 0.45 ? BUSH[4] : lit > 0.05 ? BUSH[3] : lit > -0.35 ? BUSH[2] : BUSH[1];
    });
    // Woody stems where the bush meets the ground.
    for (const x of [6, 8, 10]) {
      c.set(x, 15, P.OAK_BARK[1]);
      c.set(x + (x < 8 ? 1 : x > 8 ? -1 : 0), 14, P.OAK_BARK[2]);
    }
  });
}

/** A round berry with a highlight on its upper left. */
function berry(c: Canvas, x: number, y: number, r: Ramp): void {
  c.set(x, y, r[2]);
  c.set(x + 1, y, r[1]);
  c.set(x, y + 1, r[1]);
  c.set(x + 1, y + 1, r[0]);
  c.set(x, y, r[4]);
}

function berryBush(c: Canvas): void {
  bushBody(c, false);
  for (const [x, y] of [[3, 7], [6, 5], [10, 6], [12, 9], [8, 9], [4, 11], [11, 12], [7, 12], [13, 6]] as const) berry(c, x, y, BERRY);
}

function berryBushBare(c: Canvas): void {
  bushBody(c, true);
  // Tiny green fruit already setting.
  for (const [x, y] of [[5, 6], [10, 8], [7, 11]] as const) c.set(x, y, UNRIPE[3]);
  c.set(12, 10, UNRIPE[2]);
}

// ---- the dark: glowcaps and crystals -----------------------------------------------------------------

/** A mushroom: a pale stem and a glowing dome cap with dark gills under its rim. (x, y) = centre of the cap's foot. */
function mushroom(c: Canvas, x: number, y: number, w: number, h: number): void {
  for (let yy = y + 1; yy <= 15; yy++) {
    c.set(x, yy, yy === 15 ? STALK_PALE[1] : STALK_PALE[3]);
    if (w > 4) c.set(x + 1, yy, STALK_PALE[2]);
  }
  const half = w / 2;
  for (let j = 0; j < h; j++) {
    const span = Math.round(half * Math.sqrt(1 - Math.pow(j / h, 2)));
    for (let i = -span; i <= span; i++) {
      const lit = i < 0 && j > 0 ? 4 : i <= span / 2 ? 3 : 2;
      c.set(Math.round(x + 0.5 * (w > 4 ? 1 : 0) + i), y - j, GLOWCAP[j === h - 1 && i > -2 ? 4 : lit]);
    }
  }
  for (let i = -Math.round(half); i <= Math.round(half); i++) c.set(Math.round(x + 0.5 * (w > 4 ? 1 : 0) + i), y + 1, i % 2 === 0 ? GILL[1] : GILL[2]);
  // Brighter spots on the cap.
  c.set(x - 1, y - 1, GLOWCAP[4]);
  if (w > 4) c.set(x + 2, y - 2, GLOWCAP[4]);
}

function glowcap(c: Canvas): void {
  mushroom(c, 7, 8, 7, 4);
  mushroom(c, 3, 11, 4, 2);
  mushroom(c, 12, 12, 3, 2);
  // Spores drifting off the big cap.
  c.set(10, 3, GLOWCAP[3]);
  c.set(5, 2, GLOWCAP[2]);
}

/** One prism of crystal from the floor at (x, 15), `h` tall, leaning by `lean` px at the tip: lit left facet, shaded right. */
function prism(c: Canvas, x: number, h: number, lean: number, w: number): void {
  for (let i = 0; i < h; i++) {
    const t = i / h;
    const cx = x + Math.round(lean * t);
    const half = i > h - 3 ? 0 : Math.floor(w / 2);
    for (let k = -half; k <= half; k++) {
      const col = i === h - 1 ? CRYSTAL[4] : k < 0 ? CRYSTAL[3] : k === 0 ? CRYSTAL[2] : CRYSTAL[1];
      c.set(cx + k, 15 - i, col);
    }
    if (half > 0 && i % 4 === 2) c.set(cx - half, 15 - i, CRYSTAL[4]);
  }
}

function crystalCluster(c: Canvas): void {
  prism(c, 8, 14, 0, 4);
  prism(c, 4, 9, -2, 2);
  prism(c, 12, 10, 2, 2);
  prism(c, 6, 6, -1, 2);
  prism(c, 11, 6, 1, 2);
  // The geode floor they grow from.
  c.rect(3, 15, 11, 1, CRYSTAL[0]);
}

function iceSpike(c: Canvas): void {
  // One tall tapering spike: a lit left face, a glassy core streak and a shaded right face, frosted at the base.
  const i = P.ICE;
  for (let y = 0; y < 16; y++) {
    const half = Math.max(0, Math.round((y - 1) * 0.27));
    for (let x = 8 - half - 1; x <= 8 + half; x++) {
      const u = x - 7.5;
      const col = y < 2 ? i[4] : u < -half + 1 ? i[4] : u < 0 ? i[3] : u < 1 ? i[2] : u > half - 1 ? i[0] : i[1];
      c.set(x, y, col);
    }
  }
  for (let y = 4; y < 14; y += 3) c.set(7, y, P.SNOW[4]);
  for (let x = 3; x <= 12; x++) c.set(x, 15, (x & 1) === 0 ? P.SNOW[3] : P.SNOW[2]);
}

export const WORLD_PLANTS: PainterSet = {
  ember_poppy: emberPoppy,
  skybell,
  frost_lily: frostLily,
  fern,
  reeds,
  berry_bush: berryBush,
  berry_bush_bare: berryBushBare,
  glowcap,
  crystal_cluster: crystalCluster,
  ice_spike: iceSpike,
};
