/**
 * The pieces an automaton breaks into (spec 19.5): small tumbling cubes in its colours that fly out, fall, bounce off
 * the ground and walls, come to rest and shrink away; ember pieces keep glowing for a while and cool down. Pure
 * simulation in typed arrays (no THREE, no DOM, no allocation after construction); drawn by a CubeBatch.
 */

/** Asks whether the block cell holding a point is solid (the renderer passes the world's). */
export type SolidAt = (x: number, y: number, z: number) => boolean;

export interface DebrisPiece {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  r: number;
  g: number;
  b: number;
  /** 1 for a glowing ember piece (it cools over its first half-life), else 0. */
  emissive: number;
  /** Light where it broke (0..1 sky and block), for the shader. */
  sky: number;
  block: number;
  life: number;
}

/** What a piece looks like this frame (written by `forEach`). */
export interface PieceDraw {
  x: number;
  y: number;
  z: number;
  size: number;
  rx: number;
  ry: number;
  r: number;
  g: number;
  b: number;
  emissive: number;
  sky: number;
  block: number;
}

const GRAVITY = 22;
const BOUNCE = 0.32;
/** Speed below which a piece landing on the ground stops bouncing and rests. */
const REST_SPEED = 1.2;
/** Pieces shrink away over their last this many seconds. */
const SHRINK_S = 0.45;

export class DebrisField {
  private n = 0;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly rot: Float32Array;
  private readonly spin: Float32Array;
  private readonly size: Float32Array;
  private readonly color: Float32Array;
  private readonly light: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly draw: PieceDraw = { x: 0, y: 0, z: 0, size: 0, rx: 0, ry: 0, r: 0, g: 0, b: 0, emissive: 0, sky: 0, block: 0 };

  constructor(readonly capacity = 160) {
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.rot = new Float32Array(capacity * 2);
    this.spin = new Float32Array(capacity * 2);
    this.size = new Float32Array(capacity);
    this.color = new Float32Array(capacity * 4);
    this.light = new Float32Array(capacity * 2);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
  }

  get count(): number {
    return this.n;
  }

  /** Adds a piece; when full, the oldest-placed slot is reused (a burst never fails). `spinU`, `spinV` are -1..1. */
  spawn(p: DebrisPiece, spinU: number, spinV: number): void {
    let i = this.n;
    if (i >= this.capacity) i = this.oldest();
    else this.n++;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = p.vx;
    this.vel[i * 3 + 1] = p.vy;
    this.vel[i * 3 + 2] = p.vz;
    this.rot[i * 2] = spinU * 3;
    this.rot[i * 2 + 1] = spinV * 3;
    this.spin[i * 2] = spinU * 14;
    this.spin[i * 2 + 1] = spinV * 14;
    this.size[i] = p.size;
    this.color[i * 4] = p.r;
    this.color[i * 4 + 1] = p.g;
    this.color[i * 4 + 2] = p.b;
    this.color[i * 4 + 3] = p.emissive;
    this.light[i * 2] = p.sky;
    this.light[i * 2 + 1] = p.block;
    this.age[i] = 0;
    this.life[i] = Math.max(0.05, p.life);
  }

  /** Advances every piece by `dt`: gravity, tumbling, bounces off solid cells, resting, expiry. */
  step(dt: number, solid: SolidAt): void {
    if (dt <= 0) return;
    const { pos, vel, spin, rot } = this;
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.moveLast(i);
        continue;
      }
      const i3 = i * 3;
      const half = this.size[i] * 0.5;
      vel[i3 + 1] -= GRAVITY * dt;
      // Sideways: stop at walls (a little bounce back).
      const nx = pos[i3] + vel[i3] * dt;
      if (solid(nx, pos[i3 + 1], pos[i3 + 2])) vel[i3] *= -BOUNCE;
      else pos[i3] = nx;
      const nz = pos[i3 + 2] + vel[i3 + 2] * dt;
      if (solid(pos[i3], pos[i3 + 1], nz)) vel[i3 + 2] *= -BOUNCE;
      else pos[i3 + 2] = nz;
      const ny = pos[i3 + 1] + vel[i3 + 1] * dt;
      if (vel[i3 + 1] < 0 && solid(pos[i3], ny - half, pos[i3 + 2])) {
        // Land on top of the cell below: bounce, rub off speed and spin.
        pos[i3 + 1] = Math.floor(ny - half) + 1 + half;
        const v = -vel[i3 + 1] * BOUNCE;
        vel[i3 + 1] = v < REST_SPEED ? 0 : v;
        vel[i3] *= 0.55;
        vel[i3 + 2] *= 0.55;
        spin[i * 2] *= 0.5;
        spin[i * 2 + 1] *= 0.5;
        if (vel[i3 + 1] === 0) {
          // Resting: lie flat.
          rot[i * 2] = Math.round(rot[i * 2] / (Math.PI / 2)) * (Math.PI / 2);
          spin[i * 2] = 0;
          spin[i * 2 + 1] = 0;
        }
      } else if (vel[i3 + 1] > 0 && solid(pos[i3], ny + half, pos[i3 + 2])) vel[i3 + 1] = 0;
      else pos[i3 + 1] = ny;
      rot[i * 2] += spin[i * 2] * dt;
      rot[i * 2 + 1] += spin[i * 2 + 1] * dt;
      i++;
    }
  }

  /** Calls `fn` with each live piece's draw state (the same object, refilled). */
  forEach(fn: (d: PieceDraw) => void): void {
    const d = this.draw;
    for (let i = 0; i < this.n; i++) {
      const left = this.life[i] - this.age[i];
      const t = this.age[i] / this.life[i];
      d.x = this.pos[i * 3];
      d.y = this.pos[i * 3 + 1];
      d.z = this.pos[i * 3 + 2];
      d.size = this.size[i] * Math.min(1, left / SHRINK_S);
      d.rx = this.rot[i * 2];
      d.ry = this.rot[i * 2 + 1];
      d.r = this.color[i * 4];
      d.g = this.color[i * 4 + 1];
      d.b = this.color[i * 4 + 2];
      // Ember pieces cool over the first 60% of their life.
      d.emissive = this.color[i * 4 + 3] * Math.max(0, 1 - t / 0.6);
      d.sky = this.light[i * 2];
      d.block = this.light[i * 2 + 1];
      fn(d);
    }
  }

  clear(): void {
    this.n = 0;
  }

  private oldest(): number {
    let best = 0;
    for (let i = 1; i < this.n; i++) if (this.age[i] / this.life[i] > this.age[best] / this.life[best]) best = i;
    return best;
  }

  private moveLast(i: number): void {
    const last = --this.n;
    if (i === last) return;
    for (let k = 0; k < 3; k++) {
      this.pos[i * 3 + k] = this.pos[last * 3 + k];
      this.vel[i * 3 + k] = this.vel[last * 3 + k];
    }
    for (let k = 0; k < 2; k++) {
      this.rot[i * 2 + k] = this.rot[last * 2 + k];
      this.spin[i * 2 + k] = this.spin[last * 2 + k];
      this.light[i * 2 + k] = this.light[last * 2 + k];
    }
    for (let k = 0; k < 4; k++) this.color[i * 4 + k] = this.color[last * 4 + k];
    this.size[i] = this.size[last];
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
  }
}
