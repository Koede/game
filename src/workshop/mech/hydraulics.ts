/**
 * Hydraulic and pneumatic circuits (docs/MECHANICS_PLAN.md 2.7). Pure. A circuit is lines (nodes with compliance) joined by elements: pump, relief valve,
 * check valve, directional (signal) valve, orifice, accumulator and cylinder. `step` returns the pump load in su so the drive layer feels it.
 * Pressure is in bar-ish units, volume in litres. Pneumatic = a high-compliance, leaky circuit (`PNEUMATIC`); hydraulic = stiff and tight (`HYDRAULIC`).
 */

export interface Medium { compliance: number; leak: number; maxP: number }
export const HYDRAULIC: Medium = { compliance: 0.05, leak: 0.0005, maxP: 60 };
export const PNEUMATIC: Medium = { compliance: 6, leak: 0.01, maxP: 12 };

/** su of shaft torque per (bar x litre per revolution): converts a pump's pressure and displacement into load. */
export const PUMP_SU = 0.06;

export type Element =
  | { kind: 'pump'; id: string; to: string; disp: number; rpm: number }
  | { kind: 'relief'; id: string; at: string; setting: number }
  | { kind: 'check'; id: string; from: string; to: string }
  | { kind: 'valve'; id: string; from: string; to: string; open: boolean }
  | { kind: 'orifice'; id: string; from: string; to: string; k: number }
  | { kind: 'accumulator'; id: string; at: string; size: number; precharge: number }
  | { kind: 'cylinder'; id: string; at: string; area: number; stroke: number; load: number; springReturn: boolean };

/** Reservoir node name (pressure 0). */
export const TANK = 'tank';

export class Circuit {
  readonly p = new Map<string, number>();
  /** Accumulator stored volume and cylinder position (0..stroke), by element id. */
  readonly vol = new Map<string, number>();
  readonly pos = new Map<string, number>();
  private readonly els: Element[] = [];
  constructor(readonly medium: Medium = HYDRAULIC) {}

  add(e: Element): this {
    this.els.push(e);
    return this;
  }

  get(id: string): Element | undefined {
    return this.els.find((e) => e.id === id);
  }

  setValve(id: string, open: boolean): void {
    const e = this.get(id);
    if (e && e.kind === 'valve') e.open = open;
  }

  setPump(id: string, rpm: number): void {
    const e = this.get(id);
    if (e && e.kind === 'pump') e.rpm = rpm;
  }

  setLoad(id: string, load: number): void {
    const e = this.get(id);
    if (e && e.kind === 'cylinder') e.load = load;
  }

  pressure(node: string): number {
    return node === TANK ? 0 : this.p.get(node) ?? 0;
  }

  position(id: string): number {
    return this.pos.get(id) ?? 0;
  }

  /** Advance dt seconds. Returns the load the pumps put on their shafts (su) and the largest pressure. */
  step(dt: number): { pumpLoad: number; maxPressure: number } {
    const sub = Math.max(8, Math.ceil(dt * 160));
    const h = dt / sub;
    let pumpLoad = 0;
    const C = this.medium.compliance;
    for (let s = 0; s < sub; s++) {
      const dq = new Map<string, number>();
      const add = (n: string, q: number): void => {
        if (n !== TANK) dq.set(n, (dq.get(n) ?? 0) + q);
      };
      for (const e of this.els) {
        switch (e.kind) {
          case 'pump': {
            const q = (e.disp * Math.max(0, e.rpm)) / 60;
            // A pump cannot push against more than maxP: it slips.
            const room = Math.max(0, 1 - this.pressure(e.to) / this.medium.maxP);
            add(e.to, q * room);
            if (s === 0) pumpLoad += PUMP_SU * this.pressure(e.to) * e.disp * (q > 0 ? 1 : 0);
            break;
          }
          case 'relief': {
            const over = this.pressure(e.at) - e.setting;
            if (over > 0) add(e.at, -over * 4);
            break;
          }
          case 'check': {
            const d = this.pressure(e.from) - this.pressure(e.to);
            if (d > 0) { add(e.from, -d * 2); add(e.to, d * 2); }
            break;
          }
          case 'valve': {
            if (!e.open) break;
            const d = this.pressure(e.from) - this.pressure(e.to);
            add(e.from, -d * 3); add(e.to, d * 3);
            break;
          }
          case 'orifice': {
            const d = this.pressure(e.from) - this.pressure(e.to);
            add(e.from, -d * e.k); add(e.to, d * e.k);
            break;
          }
          case 'accumulator': {
            // Gas spring: pressure at stored volume v is precharge + k v; it exchanges flow with its node.
            const v = this.vol.get(e.id) ?? 0;
            const pa = e.precharge + (v / e.size) * (this.medium.maxP - e.precharge);
            const d = this.pressure(e.at) - pa;
            const q = d * 3;
            const nv = Math.max(0, Math.min(e.size, v + q * h));
            this.vol.set(e.id, nv);
            add(e.at, -(nv - v) / h);
            break;
          }
          case 'cylinder': {
            const x = this.pos.get(e.id) ?? 0;
            const need = e.load / Math.max(0.01, e.area);
            const pr = this.pressure(e.at);
            if (pr > need && x < e.stroke) {
              // Extends: flow = orifice on the excess pressure, volume = area x travel.
              const q = Math.min(((pr - need) * C) / h, 40);
              const dx = Math.min(e.stroke - x, (q * h) / Math.max(0.01, e.area));
              this.pos.set(e.id, x + dx);
              add(e.at, -(dx * e.area) / h);
            } else if (e.springReturn && x > 0 && pr < need * 0.5 + 0.2) {
              const dx = Math.min(x, 1.2 * h);
              this.pos.set(e.id, x - dx);
              add(e.at, (dx * e.area * 0.2) / h);
            }
            break;
          }
        }
      }
      for (const [n] of this.pNodes(dq)) {
        const q = dq.get(n) ?? 0;
        const np = Math.max(0, (this.p.get(n) ?? 0) + (q * h) / C - (this.p.get(n) ?? 0) * this.medium.leak * h);
        this.p.set(n, Math.min(this.medium.maxP * 1.2, np));
      }
    }
    let maxPressure = 0;
    for (const v of this.p.values()) maxPressure = Math.max(maxPressure, v);
    return { pumpLoad, maxPressure };
  }

  private *pNodes(dq: Map<string, number>): Iterable<[string, number]> {
    const seen = new Set<string>();
    for (const n of this.p.keys()) { seen.add(n); yield [n, 0]; }
    for (const n of dq.keys()) if (!seen.has(n)) yield [n, 0];
  }
}
