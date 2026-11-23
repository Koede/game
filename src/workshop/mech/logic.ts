/**
 * Mechanical logic (docs/MECHANICS_PLAN.md 2.5). Pure. Signals are levels 0..15 (0 = off). A small graph of cells is evaluated once per tick in
 * dependency order; a feedback loop reads the previous tick's value of the cell that closes it (so a loop acts as a one-tick delay and cannot hang).
 * State cells: latch (set/reset), counter, delay. Deterministic and allocation-light: 200 cells cost well under a millisecond.
 */

export const LEVEL_MAX = 15;

export type LogicKind = 'source' | 'and' | 'or' | 'not' | 'xor' | 'cmp' | 'latch' | 'counter' | 'delay' | 'gate_min' | 'scale';

export interface LogicCell {
  id: string;
  kind: LogicKind;
  /** Ids of the input cells. */
  ins: readonly string[];
  /** cmp: offset (a >= b + arg); counter: count to (default 4); delay: ticks (default 1); scale: divisor x10 (arg 20 = halve); */
  arg?: number;
}

interface State {
  out: number;
  /** latch holds, counter count, delay ring */
  held: number;
  prev: number;
  ring: number[];
}

export class LogicNet {
  private readonly cells = new Map<string, LogicCell>();
  private readonly state = new Map<string, State>();
  private order: string[] | null = null;
  private readonly back = new Set<string>();
  private readonly external = new Map<string, number>();

  add(cell: LogicCell): void {
    this.cells.set(cell.id, cell);
    if (!this.state.has(cell.id)) this.state.set(cell.id, { out: 0, held: 0, prev: 0, ring: [] });
    this.order = null;
  }

  remove(id: string): void {
    this.cells.delete(id);
    this.state.delete(id);
    this.external.delete(id);
    this.order = null;
  }

  get size(): number {
    return this.cells.size;
  }

  /** Drive a `source` cell from outside (a lever, a plate, a sensor). */
  set(id: string, level: number): void {
    this.external.set(id, Math.max(0, Math.min(LEVEL_MAX, Math.round(level))));
  }

  level(id: string): number {
    return this.state.get(id)?.out ?? 0;
  }

  private sort(): void {
    const order: string[] = [];
    const done = new Set<string>();
    const visiting = new Set<string>();
    this.back.clear();
    const visit = (id: string): void => {
      if (done.has(id)) return;
      visiting.add(id);
      for (const i of this.cells.get(id)?.ins ?? []) {
        if (!this.cells.has(i)) continue;
        if (visiting.has(i)) this.back.add(`${id}<${i}`);
        else visit(i);
      }
      visiting.delete(id);
      done.add(id);
      order.push(id);
    };
    for (const id of this.cells.keys()) visit(id);
    this.order = order;
  }

  /** Evaluate one tick. */
  tick(): void {
    if (!this.order) this.sort();
    const order = this.order as string[];
    for (const id of order) {
      const c = this.cells.get(id) as LogicCell;
      const st = this.state.get(id) as State;
      const read = (i: number): number => {
        const src = c.ins[i];
        if (src === undefined) return 0;
        // A back edge (loop) reads last tick's value, which is still in `out` because `id` runs before `src` this tick.
        return this.state.get(src)?.out ?? 0;
      };
      let out = 0;
      switch (c.kind) {
        case 'source': out = this.external.get(id) ?? 0; break;
        case 'and': { let m = LEVEL_MAX; let any = c.ins.length > 0; for (let i = 0; i < c.ins.length; i++) { const v = read(i); if (v <= 0) any = false; m = Math.min(m, v); } out = any ? m : 0; break; }
        case 'gate_min': { let m = LEVEL_MAX; for (let i = 0; i < c.ins.length; i++) m = Math.min(m, read(i)); out = c.ins.length ? m : 0; break; }
        case 'or': { let m = 0; for (let i = 0; i < c.ins.length; i++) m = Math.max(m, read(i)); out = m; break; }
        case 'not': out = read(0) > 0 ? 0 : LEVEL_MAX; break;
        case 'xor': { let n = 0; for (let i = 0; i < c.ins.length; i++) if (read(i) > 0) n++; out = n === 1 ? LEVEL_MAX : 0; break; }
        case 'cmp': out = read(0) >= read(1) + (c.arg ?? 0) ? LEVEL_MAX : 0; break;
        case 'scale': out = Math.max(0, Math.min(LEVEL_MAX, Math.round((read(0) * 10) / Math.max(1, c.arg ?? 10)))); break;
        case 'latch': {
          if (read(1) > 0) st.held = 0;
          else if (read(0) > 0) st.held = 1;
          out = st.held ? LEVEL_MAX : 0;
          break;
        }
        case 'counter': {
          const pulse = read(0) > 0 ? 1 : 0;
          if (read(1) > 0) st.held = 0;
          else if (pulse && !st.prev) st.held++;
          st.prev = pulse;
          const n = Math.max(1, c.arg ?? 4);
          if (st.held >= n) {
            out = LEVEL_MAX;
            st.held = 0;
          }
          break;
        }
        case 'delay': {
          const n = Math.max(1, c.arg ?? 1);
          st.ring.push(read(0));
          out = st.ring.length > n ? (st.ring.shift() as number) : 0;
          break;
        }
      }
      st.out = out;
    }
  }

  /** Counter value (for goggles and saves). */
  count(id: string): number {
    return this.state.get(id)?.held ?? 0;
  }

  toJSON(): { id: string; held: number; out: number }[] {
    const out: { id: string; held: number; out: number }[] = [];
    for (const [id, s] of this.state) if (s.held || s.out) out.push({ id, held: s.held, out: s.out });
    return out;
  }

  load(raw: unknown): void {
    if (!Array.isArray(raw)) return;
    for (const r of raw) {
      const s = r && typeof r === 'object' ? this.state.get((r as { id?: string }).id ?? '') : undefined;
      if (!s) continue;
      const h = (r as { held?: unknown }).held;
      const o = (r as { out?: unknown }).out;
      s.held = typeof h === 'number' && Number.isFinite(h) ? Math.max(0, Math.floor(h)) : 0;
      s.out = typeof o === 'number' && Number.isFinite(o) ? Math.max(0, Math.min(LEVEL_MAX, Math.round(o))) : 0;
    }
  }
}
