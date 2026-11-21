/**
 * One BufferGeometry per species, built from its CreatureSpec boxes: every part's six faces, in blocks, with the
 * attributes the animal shader animates and lights per vertex:
 *   aColor  the part colour (display space)        aPivot  the part's pivot, blocks
 *   aPart   0 rigid, 1 head, 2 legs swinging forward with the stride phase, 3 legs swinging backward,
 *           4 left arm, 5 right arm (automatons); + EMISSIVE_FLAG for an ember part (spec 19.5)
 *   normal  face normal (model space)              uv      position on the face in model pixels (1/16 block),
 *                                                          offset per box so neighbouring boxes do not share noise
 *   aFeature  centre of the part's box and 1 for grown-up features (horns, tusks) that young animals only
 *             have as small nubs, else 0
 * The geometry is the adult at the origin of its feet, facing north (-Z); the instance matrix places it.
 */
import * as THREE from 'three';
import type { CreatureAnim, CreaturePart, CreatureSpec } from '../../core/types';

/**
 * Animation group of each anim tag. Legs swing in diagonal pairs (FL with BR, FR with BL); an automaton's middle legs
 * join them (MR with FL/BR, ML with FR/BL). Automaton arms (spec 19) pivot at the shoulder on their own angle.
 */
export const PART_GROUP: Record<CreatureAnim, number> = {
  none: 0, head: 1, legFL: 2, legBR: 2, legMR: 2, legFR: 3, legBL: 3, legML: 3, armL: 4, armR: 5,
};

/** Added to `aPart` for an emissive (ember) part; the shader splits it off again. */
export const EMISSIVE_FLAG = 8;

const PX = 1 / 16;

/** Parts young animals have only as nubs: horns and tusks (by part name). */
export const isAdultFeature = (p: CreaturePart): boolean => /^(horn|tusk)/i.test(p.name);

export interface SpeciesGeometry {
  geometry: THREE.BufferGeometry;
  /** Height of the tallest leg in blocks (sets the stride frequency), and of the whole model. */
  legHeight: number;
  height: number;
  /** Radius of a sphere around the model's centre (frustum culling), blocks. */
  radius: number;
}

/** Corner order of each face (indices into the box's 8 corners, counter-clockwise seen from outside). */
const FACES: { n: [number, number, number]; c: [number, number, number, number]; u: 0 | 1 | 2; v: 0 | 1 | 2 }[] = [
  { n: [1, 0, 0], c: [5, 1, 3, 7], u: 2, v: 1 },
  { n: [-1, 0, 0], c: [0, 4, 6, 2], u: 2, v: 1 },
  { n: [0, 1, 0], c: [6, 7, 3, 2], u: 0, v: 2 },
  { n: [0, -1, 0], c: [0, 1, 5, 4], u: 0, v: 2 },
  { n: [0, 0, 1], c: [4, 5, 7, 6], u: 0, v: 1 },
  { n: [0, 0, -1], c: [1, 0, 2, 3], u: 0, v: 1 },
];

/** Builds the geometry of one species. Pure apart from the THREE objects it returns. */
export function buildSpeciesGeometry(spec: CreatureSpec): SpeciesGeometry {
  const parts = spec.model;
  const n = parts.length * 24;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 3);
  const piv = new Float32Array(n * 3);
  const grp = new Float32Array(n);
  const feat = new Float32Array(n * 4);
  const idx: number[] = [];
  let v = 0;
  let legHeight = 0;
  let top = 0;
  let reach = 0;
  parts.forEach((p: CreaturePart, pi) => {
    const group = PART_GROUP[p.anim];
    if (group === 2 || group === 3) legHeight = Math.max(legHeight, (p.to[1] - p.from[1]) * PX);
    top = Math.max(top, p.to[1] * PX);
    const pivot = p.pivot ?? [0, 0, 0];
    const r = ((p.color >> 16) & 255) / 255;
    const g = ((p.color >> 8) & 255) / 255;
    const b = (p.color & 255) / 255;
    // Per-box noise offset (whole pixels), so the pattern does not continue across a seam.
    const adult = isAdultFeature(p) ? 1 : 0;
    const centre = [((p.from[0] + p.to[0]) / 2) * PX, ((p.from[1] + p.to[1]) / 2) * PX, ((p.from[2] + p.to[2]) / 2) * PX, adult];
    const ou = (pi * 7) % 32;
    const ov = (pi * 13) % 32;
    for (const f of FACES) {
      const base = v;
      for (let k = 0; k < 4; k++) {
        const c = f.c[k];
        const corner = [c & 1 ? p.to[0] : p.from[0], c & 2 ? p.to[1] : p.from[1], c & 4 ? p.to[2] : p.from[2]];
        pos.set([corner[0] * PX, corner[1] * PX, corner[2] * PX], v * 3);
        reach = Math.max(reach, Math.hypot(corner[0] * PX, corner[1] * PX - 0.5, corner[2] * PX));
        nor.set(f.n, v * 3);
        uv[v * 2] = corner[f.u] + ou;
        uv[v * 2 + 1] = corner[f.v] + ov;
        col.set([r, g, b], v * 3);
        piv.set([pivot[0] * PX, pivot[1] * PX, pivot[2] * PX], v * 3);
        grp[v] = group + (p.emissive ? EMISSIVE_FLAG : 0);
        feat.set(centre, v * 4);
        v++;
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geometry.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3));
  geometry.setAttribute('aPart', new THREE.BufferAttribute(grp, 1));
  geometry.setAttribute('aFeature', new THREE.BufferAttribute(feat, 4));
  geometry.setIndex(idx);
  return { geometry, legHeight: Math.max(legHeight, 2 * PX), height: top, radius: reach + 0.25 };
}
