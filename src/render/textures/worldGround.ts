/**
 * Ground and masonry of the richer world (spec 14): cactus, packed ice, basalt columns, steam vents, marsh peat,
 * the Old Works ruins (cracked and mossy stone brick, a collapsed furnace mouth, rusted machine shells) and crude
 * oil. Every tile is fully opaque; the natural ones tile seamlessly.
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel, bevelCells, crack, rivet, tone } from './brush';
import { masonry, stoneBrick } from './building';
import { CASE_IRON } from './casing';
import * as P from './palette';
import { type RGB, type Ramp, mix, rgb, shade } from './palette';

const ramp = (a: number, b: number, c: number, d: number, e: number): Ramp => [rgb(a), rgb(b), rgb(c), rgb(d), rgb(e)];

const CACTUS = ramp(0x1f3d22, 0x2b5530, 0x3a6e3c, 0x4f8a4a, 0x76a862);
const SPINE: RGB = rgb(0xcfc49a);
const PACKED = ramp(0x2c5a86, 0x3c74a2, 0x5492bc, 0x78b2d2, 0xb6dcec);
const PEAT = ramp(0x1a120e, 0x261a12, 0x342418, 0x45301f, 0x5a432c);
const MOSS = ramp(0x2a4018, 0x3a561e, 0x4e6e26, 0x668a32, 0x88a84a);
const OIL = ramp(0x06060a, 0x0e0d14, 0x17151f, 0x24212e, 0x3a3548);
const SHEEN: readonly RGB[] = [rgb(0x2e5a6a), rgb(0x5a3a72), rgb(0x7a6230), rgb(0x3a6a4a)];
const MINERAL = ramp(0x8a7a3a, 0xb09a48, 0xd4bc5c, 0xe8dc96, 0xf8f4dc);

// ---- dunes and frostfell --------------------------------------------------------------------------------

/** Cactus flank: four ribs (lit crest, shaded groove) with rows of pale spines, seamless top to bottom. */
function cactusSide(c: Canvas): void {
  const f = c.noise(4, 8, 1);
  c.each((x, y) => {
    const u = x % 4;
    const base = u === 0 ? CACTUS[0] : u === 1 ? CACTUS[3] : u === 2 ? CACTUS[2] : CACTUS[1];
    return f(x, y) > 0.7 && u !== 0 ? shade(base, 0.08) : base;
  });
  // Areoles spaced down each crest, staggered between ribs: one pale spine point with a dark base.
  for (let x = 1; x < 16; x += 4) {
    for (let y = (x * 5) % 6; y < 16; y += 6) {
      c.set(x, y, SPINE);
      c.wset(x, y + 1, CACTUS[1]);
    }
  }
}

/** Cactus crown: ribs radiating from a woolly centre, spines at the rim. */
function cactusTop(c: Canvas): void {
  c.each((x, y) => {
    const dx = x - 7.5;
    const dy = y - 7.5;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const rib = Math.cos(a * 8);
    if (d < 1.6) return SPINE;
    if (d < 2.6) return shade(SPINE, -0.3);
    const lit = rib > 0.4 ? CACTUS[3] : rib > -0.3 ? CACTUS[2] : CACTUS[0];
    return d > 7.2 ? shade(lit, -0.2) : lit;
  });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    c.set(Math.round(7.5 + Math.cos(a) * 5), Math.round(7.5 + Math.sin(a) * 5), SPINE);
  }
}

/** Packed ice: deep blue and dense, two faint pressure seams across it, a few long white fractures, no bubbles. */
function packedIce(c: Canvas): void {
  const f = c.noise(8, 8, 1);
  const g = c.noise(4, 4, 2);
  c.each((x, y) => tone([PACKED[1], PACKED[2], PACKED[2], PACKED[3]], 0.45 + (f(x, y) - 0.5) * 0.8 + (g(x, y) - 0.5) * 0.3));
  // Pressure seams: thin pale lines that drift by a pixel across the tile (seamless left to right).
  const drift = c.noise(8, 16, 3);
  for (const y0 of [4, 11]) {
    for (let x = 0; x < 16; x++) {
      const y = y0 + Math.round((drift(x, y0) - 0.5) * 2);
      c.wset(x, y, shade(PACKED[3], 0.15));
      c.wset(x, y + 1, PACKED[1]);
    }
  }
  crack(c, c.int(16), c.int(16), 7, 1, 1, PACKED[4]);
  crack(c, c.int(16), c.int(16), 5, -1, 1, PACKED[4]);
  for (const [x, y] of c.scatter(2, 8)) c.wset(x, y, PACKED[0]);
}

// ---- the scar -------------------------------------------------------------------------------------------

/**
 * Basalt columns from the side: three six-sided pillars per tile, each showing a lit facet, a face-on facet and a
 * shaded facet, split by deep joints, with the pillars' cross joints at staggered heights.
 */
function basaltColumnSide(c: Canvas): void {
  const b = P.BASALT;
  const f = c.noise(4, 8, 1);
  const cols = [[0, 6], [6, 11], [11, 16]] as const;
  cols.forEach(([x0, x1], k) => {
    const cut = (k * 7 + 3) % 16;
    const w = x1 - x0;
    for (let x = x0; x < x1; x++) {
      const u = x - x0;
      const facet = u === 0 ? -1 : u <= 1 ? 0.3 : u >= w - 1 ? -0.25 : 0.05;
      for (let y = 0; y < 16; y++) {
        let col = facet < -0.5 ? shade(b[0], -0.3) : tone([b[1], b[2], b[3], b[4]], 0.45 + facet + (f(x, y) - 0.5) * 0.5);
        if (u > 0 && y === cut) col = b[0];
        else if (u > 0 && y === (cut + 1) % 16) col = shade(col, 0.18);
        c.set(x, y, col);
      }
    }
  });
  for (const [x, y] of c.scatter(3, 6)) if (x !== 0 && x !== 6 && x !== 11) c.wset(x, y, b[4]);
}

/** Basalt column tops: a packed mosaic of polygons, each a column end, dark joints between. */
function basaltColumnTop(c: Canvas): void {
  const b = P.BASALT;
  const map = c.cells(6, 5);
  bevelCells(c, map, (id, x, y) => tone([b[1], b[2], b[3]], 0.3 + c.hash(id, 0, 3) * 0.5 + c.hash(x, y, 4) * 0.15), b[0], 0.85, 0.2, 0.22);
}

/** A steam vent seen from above: a dark throat in basalt, ringed with pale mineral crust and a wet sheen. */
function steamVentTop(c: Canvas): void {
  const b = P.BASALT;
  const map = c.cells(6, 5);
  bevelCells(c, map, (id) => tone([b[1], b[2], b[3]], 0.3 + c.hash(id, 0, 2) * 0.5), b[0], 0.8, 0.15, 0.2);
  const wob = c.noise(4, 4, 3);
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5) + (wob(x, y) - 0.5) * 1.6;
    if (d < 2.2) return P.SOOT;
    if (d < 3.1) return shade(b[0], -0.2);
    if (d < 4.2) return tone(MINERAL, 0.2 + c.hash(x, y, 5) * 0.8);
    if (d < 5.4 && c.hash(x, y, 6) < 0.45) return mix(c.get(x, y), MINERAL[1], 0.55);
    return null;
  });
  // Droplets of condensed steam catching the light.
  for (const [x, y] of [[5, 4], [11, 6], [4, 10], [10, 11]] as const) c.set(x, y, P.ICE[4]);
}

// ---- the marsh -------------------------------------------------------------------------------------------

/** Peat: dark fibrous earth, matted with pale dead stems and the odd green of living moss. */
function peat(c: Canvas): void {
  const f = c.noise(4, 4, 1);
  const g = c.noise(2, 2, 2);
  c.each((x, y) => tone([PEAT[0], PEAT[1], PEAT[2], PEAT[3]], 0.45 + (f(x, y) - 0.5) * 1.1 + (g(x, y) - 0.5) * 0.5));
  // Fibres: short slanted strands of old straw.
  for (const [x, y] of c.scatter(9, 3)) {
    const dir = c.hash(x, y, 7) < 0.5 ? 1 : -1;
    c.wset(x, y, P.STRAW[1]);
    c.wset(x + dir, y + 1, P.STRAW[0]);
    if (c.hash(x, y, 8) < 0.5) c.wset(x + 2 * dir, y + 1, PEAT[4]);
  }
  for (const [x, y] of c.scatter(3, 6)) c.wset(x, y, MOSS[2]);
}

// ---- the Old Works ----------------------------------------------------------------------------------------

/** Stone brick split by frost: a few cracks running across bricks, a chipped corner and some lost mortar. */
function crackedStoneBrick(c: Canvas): void {
  // The same wall as plain stone brick (its random stream too), so a ruin reads as weathered brick of that kind.
  c.withSeed('stone_brick', () => stoneBrick(c));
  const s = P.STONE;
  // One long frost split wandering down through both courses and a short one, drawn a shade above the mortar so
  // they read as fine splits rather than marks.
  const split = shade(s[0], 0.1);
  const pts: ReadonlyArray<readonly [number, number]> = [[3, 0], [3, 1], [4, 2], [4, 3], [5, 4], [5, 5], [6, 6], [6, 8], [7, 9], [7, 10], [8, 11], [9, 12], [9, 13], [10, 14]];
  for (const [x, y] of pts) {
    if (y === 7 || y === 15) continue;
    c.set(x, y, split);
  }
  for (const [x, y] of [[13, 9], [12, 10], [12, 11], [11, 12]] as const) c.set(x, y, split);
  // A missing corner where a chunk fell away.
  c.rect(13, 1, 2, 2, shade(s[0], -0.2));
  c.set(12, 2, s[1]);
}

/** Old stone brick overgrown with moss that follows the mortar and spills over the tops of the bricks. */
function mossyStoneBrick(c: Canvas): void {
  const s = P.STONE;
  const f = c.noise(4, 4, 1);
  masonry(c, 2, 8, (id, x, y) => tone([s[1], s[2], s[3]], 0.2 + c.hash(id, 0, 2) * 0.3 + f(x, y) * 0.4), shade(s[0], -0.25), s[0]);
  const growth = c.noise(4, 4, 5);
  c.each((x, y) => {
    // Moss gathers along mortar lines (rows 7 and 15) and creeps up and down from them.
    const fromJoint = Math.min(Math.abs(y - 7), Math.abs(y - 15), Math.abs(y + 1));
    const m = growth(x, y) - fromJoint * 0.16;
    if (m < 0.35) return null;
    return tone([MOSS[1], MOSS[2], MOSS[3], MOSS[4]], (m - 0.35) * 1.6 + (c.hash(x, y, 6) - 0.5) * 0.4);
  });
}

/** The fallen-in mouth of an old clay furnace: cracked fired clay round a cold, half-buried arch. */
function collapsedFurnace(c: Canvas): void {
  const k = P.FIRED_CLAY;
  const map = c.cells(9, 4.5);
  bevelCells(c, map, (id, x, y) => tone([k[0], k[1], k[2]], c.hash(id, 0, 1) * 0.8 + c.hash(x >> 2, y >> 2, 2) * 0.2), shade(k[0], -0.25), 0.8, 0.12, 0.25);
  const mouth = (x: number, y: number): boolean => y >= 6 && y <= 13 && (y >= 8 ? x >= 4 && x <= 11 : y === 7 ? x >= 5 && x <= 10 : x >= 6 && x <= 9);
  c.each((x, y) => (mouth(x, y) ? (y < 9 ? P.SOOT : shade(P.SOOT, 0.1)) : null));
  // What is left of the arch's pale clay rim, broken away on the right where the crown fell in.
  c.each((x, y) => (!mouth(x, y) && x < 10 && (mouth(x - 1, y) || mouth(x + 1, y) || mouth(x, y - 1) || mouth(x, y + 1)) ? k[4] : null));
  // The crown has slumped: its lintel bricks lie across the mouth, rubble half fills it.
  const s = P.STONE;
  c.sprite(
    ['....ab......', '...abbc.....', '..abbbbcab..', '.abbcbbbbbc.', 'abbbbcbbbbbc'],
    { a: s[3], b: s[2], c: s[0] },
    2,
    9,
  );
  c.rect(5, 8, 3, 1, k[3]);
  c.rect(6, 9, 3, 1, k[1]);
  crack(c, 2, 1, 6, 1, 1, shade(k[0], -0.3));
  crack(c, 13, 2, 5, -1, 1, shade(k[0], -0.3));
  // Old soot above where the fire once was.
  for (let x = 3; x <= 12; x++) for (let y = 2; y < 6; y++) if (c.hash(x, y, 3) < 0.45 - Math.abs(x - 7.5) * 0.05) c.blend(x, y, P.SOOT, 0.45);
}

/** A machine casing gone to rust: flaking patches, streaks below the rivets and a hole punched through. */
function rustedShell(c: Canvas): void {
  const I = CASE_IRON;
  const R = P.RUST;
  const f = c.noise(4, 4, 1);
  const rust = c.noise(4, 4, 2);
  c.each((x, y) => {
    const r = rust(x, y) + (c.hash(x, y, 3) - 0.5) * 0.25;
    if (r > 0.52) return tone([R[0], R[1], R[2], R[3]], (r - 0.52) * 2.6 + f(x, y) * 0.3);
    return tone([I[1], I[2], I[3]], 0.2 + f(x, y) * 0.6);
  });
  c.frame(0, 0, 16, 16, I[0]);
  bevel(c, 1, 1, 14, 14, shade(R[2], 0.1), I[1]);
  for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]] as const) {
    rivet(c, x, y, R[3], I[0]);
    for (let d = 2; d < 5; d++) if (c.hash(x, d, 4) < 0.7) c.set(x, y + d, R[1]);
  }
  // A ragged hole through the plate with flaking edges.
  c.each((x, y) => {
    const d = Math.hypot(x - 9.5, y - 7.5) + (c.hash(x, y, 5) - 0.5) * 1.2;
    return d < 2 ? P.SOOT : d < 2.8 ? R[0] : null;
  });
  // The ghost of a louvred vent, rusted shut.
  for (let y = 4; y <= 10; y += 2) c.rect(3, y, 3, 1, R[0]);
}

// ---- crude oil ---------------------------------------------------------------------------------------------

/** Crude oil: near-black, slow swirls, with a thin rainbow sheen drifting over it. */
function oil(c: Canvas): void {
  const f = c.noise(8, 8, 1);
  const swirl = c.noise(4, 4, 2);
  c.each((x, y) => tone([OIL[0], OIL[1], OIL[2], OIL[3]], 0.35 + (f(x, y) - 0.5) * 1.2 + (swirl(x, y) - 0.5) * 0.5));
  // Sheen bands: where a smooth field crosses thin levels, tint with a slowly shifting hue.
  const sheen = c.noise(8, 4, 3);
  c.each((x, y) => {
    const v = sheen(x, y) * 8;
    if (v % 1 > 0.18) return null;
    return mix(c.get(x, y), SHEEN[Math.floor(v) % SHEEN.length], 0.55);
  });
  // Glossy highlights.
  for (const [x, y] of c.scatter(4, 5)) {
    c.wset(x, y, OIL[4]);
    c.wset(x + 1, y, shade(OIL[4], 0.2));
  }
}

export const WORLD_GROUND: PainterSet = {
  cactus_side: cactusSide,
  cactus_top: cactusTop,
  packed_ice: packedIce,
  basalt_column_side: basaltColumnSide,
  basalt_column_top: basaltColumnTop,
  steam_vent_top: steamVentTop,
  peat,
  cracked_stone_brick: crackedStoneBrick,
  mossy_stone_brick: mossyStoneBrick,
  collapsed_furnace: collapsedFurnace,
  rusted_shell: rustedShell,
  oil,
};
