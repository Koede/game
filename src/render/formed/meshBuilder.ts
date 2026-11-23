/**
 * A tiny indexed-triangle builder for the merged multiblock models: flat-shaded quads, triangles, boxes and prisms with
 * a material id and a colour per vertex. Winding is fixed up from the expected outward normal, so callers list a
 * quad's corners in any order. Pure and node-testable.
 */
import { MAX_PARTS, type PartDef, type Track } from '../parts/track';

export type V3 = readonly [number, number, number];

/** Material ids (read by the shader as aData.w). */
export const MAT = {
  brick: 0,
  plate: 1,
  casing: 2,
  gold: 3,
  trim: 4,
  glass: 5,
  glow: 6,
  metal: 7,
  slot: 8,
  lining: 9,
  conduit: 10,
  /** Bright display face above the furnace mouth. */
  display: 11,
  /** Emissive accent strip of the tier's colour. */
  strip: 12,
} as const;
export type Mat = (typeof MAT)[keyof typeof MAT];

export interface ModelData {
  /** xyz per vertex, in the model frame: origin at the box's minimum corner, units in blocks. */
  positions: Float32Array;
  normals: Float32Array;
  /** r, g, b (0..1) and the material id, per vertex. */
  data: Float32Array;
  indices: Uint16Array | Uint32Array;
  /** Part slot per vertex: 0 static, i + 1 for `parts[i]` (the shader skins by it). */
  partIds: Float32Array;
  /** The moving parts of the model (empty for a static one). */
  parts: PartDef[];
  /** Box size in blocks (the model's own extent is a little larger: plinth, hood, electrodes). */
  size: V3;
  vertexCount: number;
  triangles: number;
  /** Model-frame bounds including every protrusion: min xyz then max xyz. */
  bounds: [number, number, number, number, number, number];
}

const FACE_NORMALS: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** Bit per box face for `box`'s skip mask. */
export const FACE = { px: 1, nx: 2, py: 4, ny: 8, pz: 16, nz: 32 } as const;

export class MeshBuilder {
  private pos: number[] = [];
  private nrm: number[] = [];
  private dat: number[] = [];
  private idx: number[] = [];
  private prt: number[] = [];
  private current = 0;
  private readonly defs: PartDef[] = [];

  /**
   * Starts a moving part: everything added until `endPart()` belongs to it and follows its tracks about `pivot`.
   * `parent` is another part's index (from an earlier `part()`), or -1. Returns this part's index.
   */
  part(name: string, pivot: V3, tracks: Track[], parent = -1): number {
    if (this.defs.length >= MAX_PARTS) throw new Error(`MeshBuilder: more than ${MAX_PARTS} parts`);
    this.defs.push({ name, parent, pivot, tracks });
    this.current = this.defs.length;
    return this.defs.length - 1;
  }

  /** Back to the static model. */
  endPart(): void {
    this.current = 0;
  }

  /** One flat polygon of 3 or 4 corners facing `n`. */
  poly(pts: readonly V3[], n: V3, mat: Mat, color: V3): void {
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const nx = n[0] / len;
    const ny = n[1] / len;
    const nz = n[2] / len;
    const [a, b, c] = pts;
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
    const fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2];
    const dot = (ey * fz - ez * fy) * nx + (ez * fx - ex * fz) * ny + (ex * fy - ey * fx) * nz;
    const base = this.pos.length / 3;
    for (const p of pts) {
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(nx, ny, nz);
      this.dat.push(color[0], color[1], color[2], mat);
      this.prt.push(this.current);
    }
    for (let i = 1; i + 1 < pts.length; i++) {
      if (dot >= 0) this.idx.push(base, base + i, base + i + 1);
      else this.idx.push(base, base + i + 1, base + i);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, n: V3, mat: Mat, color: V3): void {
    this.poly([a, b, c, d], n, mat, color);
  }

  tri(a: V3, b: V3, c: V3, n: V3, mat: Mat, color: V3): void {
    this.poly([a, b, c], n, mat, color);
  }

  /** An axis-aligned box; `skip` is a mask of FACE bits to leave out. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: Mat, color: V3, skip = 0): void {
    const c = (x: number, y: number, z: number): V3 => [x, y, z];
    if (!(skip & FACE.px)) this.quad(c(x1, y0, z0), c(x1, y1, z0), c(x1, y1, z1), c(x1, y0, z1), FACE_NORMALS[0], mat, color);
    if (!(skip & FACE.nx)) this.quad(c(x0, y0, z0), c(x0, y0, z1), c(x0, y1, z1), c(x0, y1, z0), FACE_NORMALS[1], mat, color);
    if (!(skip & FACE.py)) this.quad(c(x0, y1, z0), c(x0, y1, z1), c(x1, y1, z1), c(x1, y1, z0), FACE_NORMALS[2], mat, color);
    if (!(skip & FACE.ny)) this.quad(c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1), FACE_NORMALS[3], mat, color);
    if (!(skip & FACE.pz)) this.quad(c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1), FACE_NORMALS[4], mat, color);
    if (!(skip & FACE.nz)) this.quad(c(x0, y0, z0), c(x0, y1, z0), c(x1, y1, z0), c(x1, y0, z0), FACE_NORMALS[5], mat, color);
  }

  /**
   * A prism of `sides` sides about the axis through `c` along `dir` (a unit axis vector), `h` long, radius `r`, with
   * an end cap. `capMat` colours the cap and the sides use `mat`.
   */
  prism(c: V3, dir: V3, r: number, h: number, sides: number, mat: Mat, color: V3, capMat: Mat = mat, capColor: V3 = color): void {
    // Two axes perpendicular to dir.
    const ax = Math.abs(dir[0]) > 0.5 ? 1 : 0;
    const u: V3 = ax === 1 ? [0, 1, 0] : [1, 0, 0];
    const w: V3 = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]];
    const ring = (k: number, along: number): V3 => {
      const t = (k / sides) * Math.PI * 2;
      const cu = Math.cos(t) * r;
      const cw = Math.sin(t) * r;
      return [c[0] + dir[0] * along + u[0] * cu + w[0] * cw, c[1] + dir[1] * along + u[1] * cu + w[1] * cw, c[2] + dir[2] * along + u[2] * cu + w[2] * cw];
    };
    for (let k = 0; k < sides; k++) {
      const t = ((k + 0.5) / sides) * Math.PI * 2;
      const n: V3 = [u[0] * Math.cos(t) + w[0] * Math.sin(t), u[1] * Math.cos(t) + w[1] * Math.sin(t), u[2] * Math.cos(t) + w[2] * Math.sin(t)];
      this.quad(ring(k, 0), ring(k + 1, 0), ring(k + 1, h), ring(k, h), n, mat, color);
    }
    const pts: V3[] = [];
    for (let k = 0; k < sides; k++) pts.push(ring(k, h));
    this.poly(pts, dir, capMat, capColor);
  }

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  build(size: V3): ModelData {
    const n = this.pos.length / 3;
    const positions = Float32Array.from(this.pos);
    const bounds: ModelData['bounds'] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        bounds[k] = Math.min(bounds[k], positions[i + k]);
        bounds[k + 3] = Math.max(bounds[k + 3], positions[i + k]);
      }
    }
    if (n === 0) bounds.fill(0);
    return {
      positions,
      normals: Float32Array.from(this.nrm),
      data: Float32Array.from(this.dat),
      partIds: Float32Array.from(this.prt),
      parts: this.defs.map((d) => ({ ...d })),
      indices: n <= 0xffff ? Uint16Array.from(this.idx) : Uint32Array.from(this.idx),
      size,
      vertexCount: n,
      triangles: this.idx.length / 3,
      bounds,
    };
  }
}
