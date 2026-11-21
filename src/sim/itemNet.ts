/**
 * Item networks (spec 16.4): pulling ends send packets to pushing ends. The destination is chosen when the items
 * leave (priority first, then nearest by path or round-robin, never back into the block they came from) and space is
 * reserved there; travel is a timer along a fixed path (rendering only interpolates). On arrival the items go in; what
 * does not fit is re-routed to the next destination, else sent back to where it came from, else it waits at its end
 * ("Blocked") and tries again every second. Items never spill out of a pipe and never clog it.
 */
import { PIPE_MAX_PACKETS } from '../core/constants';
import type { BlockEntity } from '../core/types';
import type { ItemEndpoint } from './endpoints';
import { PipeNet, type Port } from './pipeNet';
import { cellKey, passes, portId, type SavedPacket } from './pipeState';

/** Seconds a blocked packet waits before it tries again. */
export const BLOCKED_RETRY_S = 1;

/** What an item network needs from the transport that owns it. */
export interface ItemEnv {
  /** Network time in seconds. */
  readonly time: number;
  itemEndpoint(port: Port): ItemEndpoint | null;
  /** Items of a kind already promised to a block by packets on their way. */
  reserved(entity: BlockEntity, item: string): number;
  reserve(entity: BlockEntity, item: string, delta: number): void;
}

/** A fixed route: the pipes in travel order and the polyline a packet follows (world coordinates of the vertices). */
export interface Path {
  cells: Int32Array;
  /** Pipe (local index) each vertex belongs to. */
  vcell: Int32Array;
  points: Float32Array;
  /** Seconds and blocks along at each vertex. */
  cumT: Float32Array;
  cumL: Float32Array;
  total: number;
  length: number;
}

export class Packet {
  elapsed = 0;
  /** Polyline segment it is on. */
  seg = 0;
  blocked = false;
  retry = 0;
  /** The port it is heading for (or waits at); null while blocked in the middle of a pipe. */
  to: Port | null;
  /** Where it waits while blocked with no port (a pipe it was in when the network changed). */
  cell = 0;
  reservedOn: BlockEntity | null = null;
  reservedN = 0;

  constructor(readonly rec: SavedPacket, public path: Path, to: Port | null) {
    this.to = to;
  }

  /** Blocks travelled along the path's polyline. */
  get along(): number {
    const p = this.path;
    if (this.blocked || this.elapsed >= p.total) return p.length;
    const s = this.seg;
    const dt = p.cumT[s + 1] - p.cumT[s];
    return dt > 0 ? p.cumL[s] + ((this.elapsed - p.cumT[s]) / dt) * (p.cumL[s + 1] - p.cumL[s]) : p.cumL[s];
  }

  /** Blocks per second right now (0 while waiting). */
  get speed(): number {
    const p = this.path;
    if (this.blocked || this.elapsed >= p.total) return 0;
    const s = this.seg;
    const dt = p.cumT[s + 1] - p.cumT[s];
    return dt > 0 ? (p.cumL[s + 1] - p.cumL[s]) / dt : 0;
  }

  /** The pipe it is in now (local index). */
  get here(): number {
    if (this.blocked) return this.to ? this.to.pipe : this.cell;
    const p = this.path;
    const s = Math.min(this.seg, p.vcell.length - 2);
    const mid = (p.cumL[s] + p.cumL[s + 1]) / 2;
    return this.along < mid ? p.vcell[s] : p.vcell[s + 1];
  }
}

const DIR = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;

/** One candidate destination (scratch). */
interface Candidate {
  port: Port;
  room: number;
}

export class ItemNet extends PipeNet {
  packets: Packet[] = [];
  /** The saved form of every packet: the same array lives on the anchor entity. */
  saved: SavedPacket[] = [];
  private readonly paths = new Map<number, Path>();
  private readonly scratch: Candidate[] = [];

  constructor() {
    super('item');
  }

  // ---- paths ----------------------------------------------------------------------------------------------------

  /**
   * The route from a pipe (starting at the face of `fromPort` when it departs from one, else at the pipe's centre)
   * to the end face of `to`. Cached per start and destination.
   */
  path(from: number, fromPort: Port | null, to: Port): Path | null {
    const toIdx = this.ports.indexOf(to);
    const key = fromPort ? 1_000_000 + this.ports.indexOf(fromPort) * 128 + toIdx : from * 128 + toIdx;
    const cached = this.paths.get(key);
    if (cached) return cached;
    const reach = this.reach(to);
    if (reach.dist[from] < 0) return null;
    const n = reach.dist[from] + 1;
    const cells = new Int32Array(n);
    for (let i = 0, c = from; i < n; i++, c = reach.next[c]) cells[i] = c;
    const vertices = n + (fromPort ? 2 : 1);
    const points = new Float32Array(vertices * 3);
    const vcell = new Int32Array(vertices);
    const cumT = new Float32Array(vertices);
    const cumL = new Float32Array(vertices);
    let v = 0;
    const put = (x: number, y: number, z: number, cell: number): void => {
      points[v * 3] = x;
      points[v * 3 + 1] = y;
      points[v * 3 + 2] = z;
      vcell[v++] = cell;
    };
    const centre = (c: number): void => put(this.xs[c] + 0.5, this.ys[c] + 0.5, this.zs[c] + 0.5, c);
    const face = (c: number, dir: number): void => {
      const d = DIR[dir];
      put(this.xs[c] + 0.5 + d[0] * 0.5, this.ys[c] + 0.5 + d[1] * 0.5, this.zs[c] + 0.5 + d[2] * 0.5, c);
    };
    if (fromPort) face(cells[0], fromPort.dir);
    for (let i = 0; i < n; i++) centre(cells[i]);
    face(cells[n - 1], to.dir);
    for (let i = 1; i < vertices; i++) {
      const a = vcell[i - 1];
      const b = vcell[i];
      const len = Math.hypot(points[i * 3] - points[i * 3 - 3], points[i * 3 + 1] - points[i * 3 - 2], points[i * 3 + 2] - points[i * 3 - 1]);
      const speed = Math.min(this.value[a], this.value[b]);
      cumL[i] = cumL[i - 1] + len;
      cumT[i] = cumT[i - 1] + len / speed;
    }
    const path: Path = { cells, vcell, points, cumT, cumL, total: cumT[vertices - 1], length: cumL[vertices - 1] };
    this.paths.set(key, path);
    return path;
  }

  // ---- ticking ----------------------------------------------------------------------------------------------------

  tick(env: ItemEnv, dt: number): void {
    const packets = this.packets;
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      if (p.blocked) {
        p.retry -= dt;
        if (p.retry <= 0) this.settle(env, p);
        continue;
      }
      p.elapsed += dt;
      const path = p.path;
      while (p.seg < path.cumT.length - 2 && path.cumT[p.seg + 1] <= p.elapsed) p.seg++;
      if (p.elapsed >= path.total) this.settle(env, p);
    }
    if (packets.length > 0) this.busyAt = env.time;
    for (const port of this.ports) {
      if (port.cfg.mode !== 'pull') continue;
      port.cool -= dt;
      if (port.cool > 0) continue;
      port.cool = Math.max(port.cool + 1 / port.rate, 0);
      if (packets.length >= PIPE_MAX_PACKETS) port.state = 'cap';
      else this.pull(env, port);
    }
  }

  /** A pulling end fires: take the first stack that has somewhere to go, reserve room there, send it. */
  private pull(env: ItemEnv, port: Port): void {
    const ep = env.itemEndpoint(port);
    if (!ep) {
      port.state = 'no_endpoint';
      return;
    }
    const cfg = port.cfg;
    const own = ep.entity;
    const pick: { dest: Candidate | null } = { dest: null };
    const offer = ep.offer((item) => passes(cfg, item) && (pick.dest = this.choose(env, port.pipe, item, own, port)) !== null);
    const dest = pick.dest;
    if (!offer || !dest) {
      this.diagnose(env, port, ep);
      return;
    }
    const want = Math.min(port.batch, offer.count, dest.room);
    const got = ep.take(offer.item, want);
    if (!got || got.count <= 0) {
      port.state = 'empty';
      return;
    }
    const rec: SavedPacket = { item: got.item, count: got.count, from: [port.x, port.y, port.z, port.dir], to: [0, 0, 0, 0] };
    if (got.durability !== undefined) rec.durability = got.durability;
    const p = new Packet(rec, this.path(port.pipe, port, dest.port) as Path, dest.port);
    this.send(env, p, port.pipe, port, dest.port);
    this.packets.push(p);
    this.saved.push(rec);
    port.state = 'moving';
    port.last = got.count;
    port.at = env.time;
    port.subject = got.item;
  }

  /** Why a pulling end sent nothing. */
  private diagnose(env: ItemEnv, port: Port, ep: ItemEndpoint): void {
    const any = ep.offer((item) => passes(port.cfg, item));
    if (!any) {
      port.state = 'empty';
      port.subject = null;
      return;
    }
    port.subject = any.item;
    let takers = false;
    for (const q of this.ports) {
      if (q === port || q.cfg.mode !== 'push' || !passes(q.cfg, any.item)) continue;
      const qe = env.itemEndpoint(q);
      if (qe && qe.entity !== ep.entity) takers = true;
    }
    port.state = takers ? 'dest_full' : 'no_dest';
  }

  /**
   * The destination for `item` leaving from pipe `from`: pushing ends whose filter takes it, with room left after
   * what is already on its way there, never `exclude` (the block it came from). Highest priority first; then the
   * nearest by path, or the next in turn for a 'round' source.
   */
  private choose(env: ItemEnv, from: number, item: string, exclude: BlockEntity | null, source: Port | null): Candidate | null {
    const list = this.scratch;
    list.length = 0;
    let best = -Infinity;
    for (const q of this.ports) {
      if (q.cfg.mode !== 'push' || q.cfg.priority < best || !passes(q.cfg, item)) continue;
      const qe = env.itemEndpoint(q);
      if (!qe || qe.entity === exclude) continue;
      const room = qe.room(item) - env.reserved(qe.entity, item);
      if (room <= 0) continue;
      if (q.cfg.priority > best) {
        best = q.cfg.priority;
        list.length = 0;
      }
      list.push({ port: q, room });
    }
    if (list.length === 0) return null;
    if (source && source.cfg.distribution === 'round') {
      let pick = list[0];
      for (const c of list) {
        if (this.ports.indexOf(c.port) >= source.rr) {
          pick = c;
          break;
        }
      }
      source.rr = this.ports.indexOf(pick.port) + 1;
      return { ...pick };
    }
    let pick: Candidate | null = null;
    let near = Infinity;
    for (const c of list) {
      const d = this.reach(c.port).dist[from];
      if (d >= 0 && d < near) {
        near = d;
        pick = c;
      }
    }
    return pick ? { ...pick } : null;
  }

  /** Puts a packet on its way from pipe `from` to `to`, reserving room there unless it is going home. */
  private send(env: ItemEnv, p: Packet, from: number, fromPort: Port | null, to: Port): void {
    const path = this.path(from, fromPort, to);
    if (!path) return;
    p.path = path;
    p.elapsed = 0;
    p.seg = 0;
    p.blocked = false;
    p.to = to;
    p.rec.to = [to.x, to.y, to.z, to.dir];
    if (!p.rec.back) {
      const ep = env.itemEndpoint(to);
      if (ep) {
        env.reserve(ep.entity, p.rec.item, p.rec.count);
        p.reservedOn = ep.entity;
        p.reservedN = p.rec.count;
      }
    }
  }

  release(env: ItemEnv, p: Packet): void {
    if (p.reservedOn) env.reserve(p.reservedOn, p.rec.item, -p.reservedN);
    p.reservedOn = null;
    p.reservedN = 0;
  }

  /** The port a packet came from, if this network still has it. */
  source(p: Packet): Port | null {
    const f = p.rec.from;
    return this.port(portId(cellKey(f[0], f[1], f[2]), f[3]));
  }

  /**
   * A packet reached its end (or tries again after waiting): in it goes; what is left is re-routed, else sent home,
   * else it waits where it is.
   */
  settle(env: ItemEnv, p: Packet): void {
    const rec = p.rec;
    const here = p.to;
    this.release(env, p);
    if (here) {
      const ep = env.itemEndpoint(here);
      const took = ep ? ep.insert(rec.item, rec.count, rec.durability) : 0;
      if (took > 0) {
        rec.count -= took;
        here.at = env.time;
        here.last = took;
        here.subject = rec.item;
        if (here.cfg.mode === 'push') here.state = 'moving';
      }
      if (rec.count <= 0) {
        this.remove(p);
        return;
      }
    }
    const at = here ? here.pipe : p.cell;
    const src = this.source(p);
    const srcEp = src ? env.itemEndpoint(src) : null;
    const next = this.choose(env, at, rec.item, srcEp ? srcEp.entity : null, src && src.cfg.mode === 'pull' ? src : null);
    if (next && next.port !== here) {
      delete rec.back;
      this.send(env, p, at, here, next.port);
      return;
    }
    if (src && src !== here) {
      rec.back = true;
      this.send(env, p, at, here, src);
      return;
    }
    p.blocked = true;
    p.retry = BLOCKED_RETRY_S;
    p.cell = at;
    if (here) here.state = here.cfg.mode === 'pull' ? here.state : 'full';
  }

  /** A path that stays at the centre of one pipe (a packet waiting there). */
  stay(at: number): Path {
    const points = new Float32Array([this.xs[at] + 0.5, this.ys[at] + 0.5, this.zs[at] + 0.5]);
    return { cells: new Int32Array([at]), vcell: new Int32Array([at]), points, cumT: new Float32Array(1), cumL: new Float32Array(1), total: 0, length: 0 };
  }

  /**
   * Takes over a packet from a network that was rebuilt (it is in pipe `at` now), or from a save (`arrived`: it is
   * delivered at its destination at once, spec 16.4). It heads on for the port it was going to, if this network has
   * it; otherwise it is re-routed, sent home or left waiting like any packet that found its end full.
   */
  adopt(env: ItemEnv, rec: SavedPacket, at: number, arrived: boolean): Packet {
    const t = rec.to;
    const to = this.port(portId(cellKey(t[0], t[1], t[2]), t[3]));
    const p = new Packet(rec, this.stay(at), null);
    p.cell = at;
    this.packets.push(p);
    this.saved.push(rec);
    if (to && arrived) {
      p.path = this.path(to.pipe, null, to) as Path;
      p.to = to;
      p.elapsed = p.path.total;
      p.seg = Math.max(0, p.path.cumT.length - 2);
    } else if (to) this.send(env, p, at, null, to);
    else this.settle(env, p);
    return p;
  }

  remove(p: Packet): void {
    const i = this.packets.indexOf(p);
    if (i >= 0) this.packets.splice(i, 1);
    const j = this.saved.indexOf(p.rec);
    if (j >= 0) this.saved.splice(j, 1);
  }

  /** Packets waiting at a port. */
  blockedAt(port: Port): number {
    let n = 0;
    for (const p of this.packets) if (p.blocked && p.to === port) n++;
    return n;
  }
}
