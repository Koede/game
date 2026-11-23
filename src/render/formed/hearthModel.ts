/**
 * The merged model of a formed hearth (Blast 3, Arc 4, Plasma 5, Star 6): one continuous chamfered shell over the
 * bounding box - seamless brickwork or plating, trimmed corners, a plinth, a roof or an open-top hood - with the
 * furnace mouth framed, and windows, hatches, ports, blowers and electrodes as inset details in recessed bays.
 * Pure geometry (no three.js): the shader gives the materials their patterns, glow and the snap-in animation.
 */
import { FIRST_HEARTH_TIER } from '../../core/constants';
import { blockOf } from '../../core/registry';
import type { IWorld } from '../../core/types';
import { FACE, MAT, MeshBuilder, type Mat, type ModelData, type V3 } from './meshBuilder';
import type { Cell, FormedInstance, FormedKind, FormedPart, FormedSpec, PartKind } from './registry';

interface Style {
  wall: Mat;
  base: V3;
  trim: V3;
  accent: V3;
  lining: V3;
  /** Material of the rings round the walls every other row (0: none). */
  rings: Mat | 0;
}

const STYLES: Record<number, Style> = {
  3: { wall: MAT.brick, base: [0.68, 0.34, 0.26], trim: [0.3, 0.26, 0.24], accent: [0.55, 0.46, 0.36], lining: [0.3, 0.14, 0.11], rings: 0 },
  4: { wall: MAT.brick, base: [0.82, 0.74, 0.6], trim: [0.4, 0.36, 0.33], accent: [0.8, 0.46, 0.26], lining: [0.42, 0.34, 0.26], rings: MAT.metal },
  5: { wall: MAT.casing, base: [0.24, 0.28, 0.38], trim: [0.13, 0.15, 0.21], accent: [0.3, 0.9, 0.95], lining: [0.12, 0.14, 0.2], rings: MAT.conduit },
  6: { wall: MAT.casing, base: [0.84, 0.84, 0.9], trim: [0.96, 0.76, 0.28], accent: [0.96, 0.78, 0.3], lining: [0.5, 0.46, 0.4], rings: MAT.gold },
};
export const styleFor = (tier: number): Style => STYLES[Math.min(6, Math.max(FIRST_HEARTH_TIER, tier))];

/** Chamfer of the vertical and top edges, blocks. */
export const CHAMFER = 0.11;
const PLINTH_H = 0.28;
const PLINTH_OUT = 0.07;
const BAY_MARGIN = 0.12;
const BAY_DEPTH = 0.17;

interface Face {
  n: V3;
  A: number;
  B: number;
  P(a: number, b: number): V3;
  cell(ia: number, ib: number): Cell;
  top: boolean;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];

function facesOf(W: number, H: number, D: number): Face[] {
  return [
    { n: [1, 0, 0], A: D, B: H, P: (a, b) => [W, b, a], cell: (ia, ib) => [W - 1, ib, ia], top: false },
    { n: [-1, 0, 0], A: D, B: H, P: (a, b) => [0, b, a], cell: (ia, ib) => [0, ib, ia], top: false },
    { n: [0, 0, 1], A: W, B: H, P: (a, b) => [a, b, D], cell: (ia, ib) => [ia, ib, D - 1], top: false },
    { n: [0, 0, -1], A: W, B: H, P: (a, b) => [a, b, 0], cell: (ia, ib) => [ia, ib, 0], top: false },
    { n: [0, 1, 0], A: W, B: D, P: (a, b) => [a, H, b], cell: (ia, ib) => [ia, H - 1, ib], top: true },
  ];
}

const cellKey = (c: Cell): string => `${c[0]},${c[1]},${c[2]}`;
const faceIndex = (n: V3): number => (n[0] > 0 ? 0 : n[0] < 0 ? 1 : n[2] > 0 ? 2 : n[2] < 0 ? 3 : 4);

/** Builds the merged model of a hearth spec. */
export function buildHearthModel(spec: FormedSpec): ModelData {
  const [W, H, D] = spec.size;
  const st = styleFor(spec.tier);
  const b = new MeshBuilder();
  const c = CHAMFER;
  const faces = facesOf(W, H, D);

  const special = new Map<string, FormedPart>();
  for (const p of spec.parts) special.set(`${faceIndex(p.normal)}:${cellKey(p.cell)}`, p);
  const mouth = spec.controller ? `${faceIndex(spec.controller.normal)}:${cellKey(spec.controller.cell)}` : '';

  // ---- the continuous wall faces, one quad per cell, clipped at the chamfers ----------------------------------
  faces.forEach((f, fi) => {
    for (let ia = 0; ia < f.A; ia++) {
      for (let ib = 0; ib < f.B; ib++) {
        const cell = f.cell(ia, ib);
        const key = `${fi}:${cellKey(cell)}`;
        if (f.top && !spec.closed && ia > 0 && ia < f.A - 1 && ib > 0 && ib < f.B - 1) continue; // open top: the hole
        if (key === mouth) continue;
        const a0 = ia === 0 ? c : ia;
        const a1 = ia === f.A - 1 ? f.A - c : ia + 1;
        const b0 = f.top ? (ib === 0 ? c : ib) : ib;
        const b1 = ib === f.B - 1 ? f.B - c : ib + 1;
        const part = special.get(key);
        if (part) bay(b, f, part.kind, st, a0, a1, b0, b1);
        else b.quad(f.P(a0, b0), f.P(a1, b0), f.P(a1, b1), f.P(a0, b1), f.n, st.wall, st.base);
      }
    }
  });

  // ---- chamfers: vertical edges, top edges, top corners ---------------------------------------------------------
  const T = st.trim;
  const topY = H - c;
  const edge = (p0: V3, p1: V3, p2: V3, p3: V3, n: V3): void => b.quad(p0, p1, p2, p3, n, MAT.trim, T);
  edge([W, 0, D - c], [W - c, 0, D], [W - c, topY, D], [W, topY, D - c], [1, 0, 1]);
  edge([c, 0, D], [0, 0, D - c], [0, topY, D - c], [c, topY, D], [-1, 0, 1]);
  edge([0, 0, c], [c, 0, 0], [c, topY, 0], [0, topY, c], [-1, 0, -1]);
  edge([W - c, 0, 0], [W, 0, c], [W, topY, c], [W - c, topY, 0], [1, 0, -1]);
  edge([W, topY, c], [W, topY, D - c], [W - c, H, D - c], [W - c, H, c], [1, 1, 0]);
  edge([0, topY, D - c], [0, topY, c], [c, H, c], [c, H, D - c], [-1, 1, 0]);
  edge([c, topY, D], [W - c, topY, D], [W - c, H, D - c], [c, H, D - c], [0, 1, 1]);
  edge([W - c, topY, 0], [c, topY, 0], [c, H, c], [W - c, H, c], [0, 1, -1]);
  b.tri([W, topY, D - c], [W - c, topY, D], [W - c, H, D - c], [1, 1, 1], MAT.trim, T);
  b.tri([c, topY, D], [0, topY, D - c], [c, H, D - c], [-1, 1, 1], MAT.trim, T);
  b.tri([0, topY, c], [c, topY, 0], [c, H, c], [-1, 1, -1], MAT.trim, T);
  b.tri([W - c, topY, 0], [W, topY, c], [W - c, H, c], [1, 1, -1], MAT.trim, T);

  // The underside, for a hearth standing on a pillar or a slope: one quad in the trim colour.
  b.quad([0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D], [0, -1, 0], MAT.trim, T);

  // ---- plinth round the foot, rings round the rows ----------------------------------------------------------------
  faces.slice(0, 4).forEach((f, fi) => {
    for (let ia = 0; ia < f.A; ia++) {
      const lo = ia === 0 ? -PLINTH_OUT : ia;
      const hi = ia === f.A - 1 ? f.A + PLINTH_OUT : ia + 1;
      const foot = `${fi}:${cellKey(f.cell(ia, 0))}`;
      if (!special.has(foot) && foot !== mouth) faceBox(b, f, lo, 0, hi, PLINTH_H, 0, PLINTH_OUT, MAT.trim, T);
      if (st.rings === 0) continue;
      for (let row = 1; row < H - 1; row += 2) {
        const key = `${fi}:${cellKey(f.cell(ia, row))}`;
        if (special.has(key) || key === mouth) continue;
        faceBox(b, f, ia === 0 ? c : ia, row + 0.42, ia === f.A - 1 ? f.A - c : ia + 1, row + 0.58, 0, 0.06, st.rings, st.accent);
      }
    }
  });

  // ---- the furnace mouth: a frame round the controller cell -------------------------------------------------------
  if (spec.controller) {
    const f = faces[faceIndex(spec.controller.normal)];
    let ia = 0;
    let ib = 0;
    for (let i = 0; i < f.A; i++) for (let j = 0; j < f.B; j++) if (cellKey(f.cell(i, j)) === cellKey(spec.controller.cell)) { ia = i; ib = j; }
    const p = 0.09;
    const w = 0.16;
    faceBox(b, f, ia - w, ib - w, ia, ib + 1 + w, 0, p, MAT.trim, T);
    faceBox(b, f, ia + 1, ib - w, ia + 1 + w, ib + 1 + w, 0, p, MAT.trim, T);
    faceBox(b, f, ia, ib + 1, ia + 1, ib + 1 + w, 0, p, MAT.trim, T);
    faceBox(b, f, ia, ib - w, ia + 1, ib, 0, p, MAT.trim, T);
  }

  // ---- roof, or open-top hood -----------------------------------------------------------------------------------
  if (spec.closed) {
    b.box(0.34, H, 0.34, W - 0.34, H + 0.13, D - 0.34, MAT.trim, T, FACE.ny);
    if (spec.tier === 4) {
      // The crown of the Arc furnace: a parapet of copper bus bars round the roof.
      const y1 = H + 0.34;
      const k = 0.16;
      b.box(0.34, H + 0.13, 0.34, W - 0.34, y1, 0.34 + k, MAT.metal, st.accent, FACE.ny);
      b.box(0.34, H + 0.13, D - 0.34 - k, W - 0.34, y1, D - 0.34, MAT.metal, st.accent, FACE.ny);
      b.box(0.34, H + 0.13, 0.34 + k, 0.34 + k, y1, D - 0.34 - k, MAT.metal, st.accent, FACE.ny);
      b.box(W - 0.34 - k, H + 0.13, 0.34 + k, W - 0.34, y1, D - 0.34 - k, MAT.metal, st.accent, FACE.ny);
    }
    if (spec.tier >= 6) b.box(0.5, H + 0.13, 0.5, W - 0.5, H + 0.2, D - 0.5, MAT.gold, st.accent, FACE.ny);
    for (const p of spec.parts) if (p.kind === 'electrode') electrode(b, p.cell, st);
  } else {
    hood(b, W, H, D, st);
  }

  // ---- the lining you see through a window or over the hood ---------------------------------------------------
  const ty = spec.closed ? H - 1 : H;
  const L = st.lining;
  b.quad([1, 1, 1], [W - 1, 1, 1], [W - 1, 1, D - 1], [1, 1, D - 1], [0, 1, 0], MAT.lining, L);
  b.quad([1, 1, 1], [1, 1, D - 1], [1, ty, D - 1], [1, ty, 1], [1, 0, 0], MAT.lining, L);
  b.quad([W - 1, 1, D - 1], [W - 1, 1, 1], [W - 1, ty, 1], [W - 1, ty, D - 1], [-1, 0, 0], MAT.lining, L);
  b.quad([1, 1, 1], [W - 1, 1, 1], [W - 1, ty, 1], [1, ty, 1], [0, 0, 1], MAT.lining, L);
  b.quad([W - 1, 1, D - 1], [1, 1, D - 1], [1, ty, D - 1], [W - 1, ty, D - 1], [0, 0, -1], MAT.lining, L);
  if (spec.closed) b.quad([1, ty, 1], [1, ty, D - 1], [W - 1, ty, D - 1], [W - 1, ty, 1], [0, -1, 0], MAT.lining, L);

  return b.build([W, H, D]);
}

/** A box on a face: a, b are face coordinates, `o0..o1` the offset along the outward normal from the face plane. */
function faceBox(b: MeshBuilder, f: Face, a0: number, b0: number, a1: number, b1: number, o0: number, o1: number, mat: Mat, color: V3): void {
  const p = f.P(a0, b0);
  const q = f.P(a1, b1);
  const lo: number[] = [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])];
  const hi: number[] = [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])];
  const axis = f.n[0] !== 0 ? 0 : f.n[1] !== 0 ? 1 : 2;
  const s = f.n[axis];
  const plane = p[axis];
  lo[axis] = Math.min(plane + s * o0, plane + s * o1);
  hi[axis] = Math.max(plane + s * o0, plane + s * o1);
  // The side lying against the shell is never seen.
  const inner = axis === 0 ? (s > 0 ? FACE.nx : FACE.px) : axis === 1 ? (s > 0 ? FACE.ny : FACE.py) : s > 0 ? FACE.nz : FACE.pz;
  b.box(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], mat, color, o0 === 0 ? inner : 0);
}

/** A recessed bay in a wall cell with the part's detail on its back panel. */
function bay(b: MeshBuilder, f: Face, kind: PartKind, st: Style, a0: number, a1: number, b0: number, b1: number): void {
  const m = BAY_MARGIN;
  const d = BAY_DEPTH;
  const n = f.n;
  const at = (a: number, bb: number, off: number): V3 => {
    const p = f.P(a, bb);
    return [p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off];
  };
  const ua = sub(f.P(1, 0), f.P(0, 0));
  const vb = sub(f.P(0, 1), f.P(0, 0));
  const x0 = a0 + m;
  const x1 = a1 - m;
  const y0 = b0 + m;
  const y1 = b1 - m;
  const wall = (aa: number, bb: number, a2: number, b2: number): void => b.quad(f.P(aa, bb), f.P(a2, bb), f.P(a2, b2), f.P(aa, b2), n, st.wall, st.base);
  wall(a0, b0, x0, b1);
  wall(x1, b0, a1, b1);
  wall(x0, b0, x1, y0);
  wall(x0, y1, x1, b1);
  const rv = st.trim;
  b.quad(at(x0, y0, 0), at(x0, y1, 0), at(x0, y1, -d), at(x0, y0, -d), ua, MAT.trim, rv);
  b.quad(at(x1, y0, 0), at(x1, y1, 0), at(x1, y1, -d), at(x1, y0, -d), neg(ua), MAT.trim, rv);
  b.quad(at(x0, y0, 0), at(x1, y0, 0), at(x1, y0, -d), at(x0, y0, -d), vb, MAT.trim, rv);
  b.quad(at(x0, y1, 0), at(x1, y1, 0), at(x1, y1, -d), at(x0, y1, -d), neg(vb), MAT.trim, rv);
  const back = (mat: Mat, color: V3): void => b.quad(at(x0, y0, -d), at(x1, y0, -d), at(x1, y1, -d), at(x0, y1, -d), n, mat, color);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const centre = at(cx, cy, -d);
  const lift = -d + 0.012;
  switch (kind) {
    case 'window':
      back(MAT.glass, [0.1, 0.12, 0.14]);
      b.quad(at(cx - 0.025, y0, lift), at(cx + 0.025, y0, lift), at(cx + 0.025, y1, lift), at(cx - 0.025, y1, lift), n, MAT.trim, rv);
      b.quad(at(x0, cy - 0.025, lift), at(x1, cy - 0.025, lift), at(x1, cy + 0.025, lift), at(x0, cy + 0.025, lift), n, MAT.trim, rv);
      break;
    case 'item_hatch':
      back(MAT.trim, [0.22, 0.22, 0.24]);
      b.quad(at(cx - 0.2, cy - 0.14, lift), at(cx + 0.2, cy - 0.14, lift), at(cx + 0.2, cy + 0.14, lift), at(cx - 0.2, cy + 0.14, lift), n, MAT.slot, [0.04, 0.04, 0.05]);
      faceBox(b, f, cx - 0.26, cy + 0.15, cx + 0.26, cy + 0.21, -d, -d + 0.09, MAT.metal, [0.55, 0.55, 0.6]);
      break;
    case 'fluid_hatch':
      back(MAT.trim, [0.18, 0.2, 0.24]);
      b.prism(centre, n, 0.19, 0.2, 8, MAT.metal, [0.3, 0.5, 0.75], MAT.slot, [0.04, 0.08, 0.14]);
      b.prism(at(cx, cy, -d + 0.12), n, 0.23, 0.05, 8, MAT.metal, [0.7, 0.72, 0.78]);
      break;
    case 'port':
      back(MAT.trim, [0.2, 0.2, 0.22]);
      b.prism(centre, n, 0.2, 0.22, 8, MAT.metal, [0.8, 0.46, 0.24], MAT.metal, [0.9, 0.7, 0.3]);
      b.prism(at(cx, cy, -d + 0.12), n, 0.24, 0.05, 8, MAT.gold, [0.95, 0.8, 0.3]);
      break;
    case 'blower':
      back(MAT.trim, [0.17, 0.17, 0.19]);
      faceBox(b, f, x0 + 0.04, y0 + 0.04, x1 - 0.04, y1 - 0.04, -d, 0.12, MAT.metal, [0.44, 0.44, 0.48]);
      for (let k = 0; k < 4; k++) {
        const y = y0 + 0.12 + k * ((y1 - y0 - 0.24) / 3);
        b.quad(at(x0 + 0.1, y - 0.02, 0.122), at(x1 - 0.1, y - 0.02, 0.122), at(x1 - 0.1, y + 0.02, 0.122), at(x0 + 0.1, y + 0.02, 0.122), n, MAT.slot, [0.04, 0.04, 0.05]);
      }
      break;
    default:
      back(MAT.trim, [0.2, 0.2, 0.22]);
  }
}

/** An electrode rod standing on the roof in its ceiling cell: graphite shaft, collar and a hot tip. */
function electrode(b: MeshBuilder, cell: Cell, st: Style): void {
  const cx = cell[0] + 0.5;
  const cz = cell[2] + 0.5;
  const y = cell[1] + 1.13;
  b.prism([cx, y, cz], [0, 1, 0], 0.2, 0.1, 8, MAT.metal, st.accent);
  b.prism([cx, y + 0.1, cz], [0, 1, 0], 0.11, 0.9, 8, MAT.slot, [0.1, 0.1, 0.12], MAT.glow, [1, 0.8, 0.5]);
}

/** The open top: a tapering collar over the rim with the opening lined and lit, like a chimney hood. */
function hood(b: MeshBuilder, W: number, H: number, D: number, st: Style): void {
  const k0 = 0.22; // outer base inset
  const k1 = 0.5; // outer top inset
  const k2 = 0.9; // opening inset
  const T = st.trim;
  const y1 = H + 0.55;
  b.quad([k0, H, k0], [W - k0, H, k0], [W - k1, y1, k1], [k1, y1, k1], [0, 0.6, -1], MAT.trim, T);
  b.quad([W - k0, H, D - k0], [k0, H, D - k0], [k1, y1, D - k1], [W - k1, y1, D - k1], [0, 0.6, 1], MAT.trim, T);
  b.quad([k0, H, D - k0], [k0, H, k0], [k1, y1, k1], [k1, y1, D - k1], [-1, 0.6, 0], MAT.trim, T);
  b.quad([W - k0, H, k0], [W - k0, H, D - k0], [W - k1, y1, D - k1], [W - k1, y1, k1], [1, 0.6, 0], MAT.trim, T);
  const lip = (x0: number, z0: number, x1: number, z1: number): void => b.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], MAT.metal, st.accent);
  lip(k1, k1, W - k1, k2);
  lip(k1, D - k2, W - k1, D - k1);
  lip(k1, k2, k2, D - k2);
  lip(W - k2, k2, W - k1, D - k2);
  const lo = H - 0.3;
  b.quad([k2, y1, k2], [W - k2, y1, k2], [W - k2, lo, k2], [k2, lo, k2], [0, 0, 1], MAT.lining, st.lining);
  b.quad([W - k2, y1, D - k2], [k2, y1, D - k2], [k2, lo, D - k2], [W - k2, lo, D - k2], [0, 0, -1], MAT.lining, st.lining);
  b.quad([k2, y1, D - k2], [k2, y1, k2], [k2, lo, k2], [k2, lo, D - k2], [1, 0, 0], MAT.lining, st.lining);
  b.quad([W - k2, y1, k2], [W - k2, y1, D - k2], [W - k2, lo, D - k2], [W - k2, lo, k2], [-1, 0, 0], MAT.lining, st.lining);
}

// ---- the registry entry --------------------------------------------------------------------------------------

const PART_OF: Record<string, PartKind> = {
  glass: 'window',
  item_hatch: 'item_hatch',
  fluid_hatch: 'fluid_hatch',
  power_port: 'port',
  blower: 'blower',
  electrode: 'electrode',
};

function normalOf(min: Cell, max: Cell, closed: boolean, x: number, y: number, z: number): V3 | null {
  if (x === min[0]) return [-1, 0, 0];
  if (x === max[0]) return [1, 0, 0];
  if (z === min[2]) return [0, 0, -1];
  if (z === max[2]) return [0, 0, 1];
  if (y === max[1] && closed) return [0, 1, 0];
  if (y === min[1]) return [0, -1, 0];
  return null;
}

/** Parts of a formed hearth read off the world's shell blocks (face cells only; never on an edge, never the floor). */
export function hearthParts(world: IWorld, inst: Pick<FormedInstance, 'min' | 'max' | 'closed'>): FormedPart[] {
  const { min, max, closed } = inst;
  const out: FormedPart[] = [];
  for (let y = min[1]; y <= max[1]; y++) {
    for (let z = min[2]; z <= max[2]; z++) {
      for (let x = min[0]; x <= max[0]; x++) {
        const edges = (x === min[0] || x === max[0] ? 1 : 0) + (z === min[2] || z === max[2] ? 1 : 0) + (y === min[1] || y === max[1] ? 1 : 0);
        if (edges !== 1) continue;
        const kind = PART_OF[blockOf(world.getVoxel(x, y, z)).key];
        if (!kind) continue;
        const n = normalOf(min, max, closed, x, y, z);
        if (!n || n[1] < 0) continue;
        if (kind === 'electrode' && n[1] !== 1) continue;
        out.push({ cell: [x - min[0], y - min[1], z - min[2]], normal: n, kind });
      }
    }
  }
  return out;
}

export const hearthKind: FormedKind = {
  kind: 'hearth',
  find(world, x, z, range, out) {
    const r2 = range * range;
    for (const e of world.entities()) {
      if (e.kind !== 'furnace') continue;
      const dx = e.x + 0.5 - x;
      const dz = e.z + 0.5 - z;
      if (dx * dx + dz * dz > r2) continue;
      const h = e.hearth as { tier?: unknown; min?: unknown; max?: unknown; closed?: unknown } | null | undefined;
      if (!h || typeof h.tier !== 'number' || h.tier < FIRST_HEARTH_TIER || !Array.isArray(h.min) || !Array.isArray(h.max)) continue;
      out.push({
        id: `hearth:${e.x},${e.y},${e.z}`,
        kind: 'hearth',
        tier: h.tier,
        min: [h.min[0], h.min[1], h.min[2]],
        max: [h.max[0], h.max[1], h.max[2]],
        closed: h.closed === true,
        controller: [e.x, e.y, e.z],
        tempC: typeof e.tempC === 'number' ? e.tempC : 0,
        gold: e.ignited === true,
      });
    }
  },
  parts: hearthParts,
  listen(bus, notify) {
    const id = (p: { x: number; y: number; z: number }): string => `hearth:${p.x},${p.y},${p.z}`;
    const a = bus.on('hearth:formed', (p) => notify.formed(id(p)));
    const b = bus.on('hearth:unformed', (p) => notify.unformed(id(p)));
    return () => {
      a();
      b();
    };
  },
  build: buildHearthModel,
};
