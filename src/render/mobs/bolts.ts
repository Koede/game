/**
 * Ember bolts in flight (spec 19.5): which of the bolts the mob manager reports are new, which moved since the last
 * frame (so the trail can be laid along the path, not just at the end of it) and which are gone (a burst where they
 * ended). Pure, fixed arrays, allocation-free; the capacity is the most bolts drawn at once.
 */

/** What is read of each bolt (src/mobs' ProjectileView fits). */
export interface BoltView {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export const BOLT_CAPACITY = 8;

export class BoltTracker {
  /** Bolts drawn this frame: position now, position last frame (= now for a new one) and whether it is new. */
  count = 0;
  readonly x = new Float32Array(BOLT_CAPACITY);
  readonly y = new Float32Array(BOLT_CAPACITY);
  readonly z = new Float32Array(BOLT_CAPACITY);
  readonly fromX = new Float32Array(BOLT_CAPACITY);
  readonly fromY = new Float32Array(BOLT_CAPACITY);
  readonly fromZ = new Float32Array(BOLT_CAPACITY);
  readonly fresh = new Uint8Array(BOLT_CAPACITY);
  /** Bolts that were in flight last frame and are not now: where they were last seen. */
  ended = 0;
  readonly endX = new Float32Array(BOLT_CAPACITY);
  readonly endY = new Float32Array(BOLT_CAPACITY);
  readonly endZ = new Float32Array(BOLT_CAPACITY);

  private readonly ids = new Int32Array(BOLT_CAPACITY);
  private prevCount = 0;
  private readonly prevIds = new Int32Array(BOLT_CAPACITY);
  private readonly prevX = new Float32Array(BOLT_CAPACITY);
  private readonly prevY = new Float32Array(BOLT_CAPACITY);
  private readonly prevZ = new Float32Array(BOLT_CAPACITY);

  /** Takes this frame's bolts (at most BOLT_CAPACITY are kept, the first ones). */
  update(views: readonly BoltView[]): void {
    const n = Math.min(BOLT_CAPACITY, views.length);
    for (let i = 0; i < n; i++) {
      const v = views[i];
      let j = -1;
      for (let k = 0; k < this.prevCount; k++) {
        if (this.prevIds[k] === v.id) {
          j = k;
          break;
        }
      }
      this.ids[i] = v.id;
      this.x[i] = v.x;
      this.y[i] = v.y;
      this.z[i] = v.z;
      this.fresh[i] = j < 0 ? 1 : 0;
      this.fromX[i] = j < 0 ? v.x : this.prevX[j];
      this.fromY[i] = j < 0 ? v.y : this.prevY[j];
      this.fromZ[i] = j < 0 ? v.z : this.prevZ[j];
    }
    let ended = 0;
    for (let k = 0; k < this.prevCount; k++) {
      let alive = false;
      for (let i = 0; i < n; i++) {
        if (this.ids[i] === this.prevIds[k]) {
          alive = true;
          break;
        }
      }
      if (alive) continue;
      this.endX[ended] = this.prevX[k];
      this.endY[ended] = this.prevY[k];
      this.endZ[ended] = this.prevZ[k];
      ended++;
    }
    this.ended = ended;
    this.count = n;
    for (let i = 0; i < n; i++) {
      this.prevIds[i] = this.ids[i];
      this.prevX[i] = this.x[i];
      this.prevY[i] = this.y[i];
      this.prevZ[i] = this.z[i];
    }
    this.prevCount = n;
  }
}
