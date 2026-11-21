/**
 * Builds pipe networks (spec 16.4) by flood fill, and only where something changed: a pipe or an endpoint placed or
 * removed dissolves the networks at and around that cell and floods them again. Two touching pipes of one family join
 * unless the wrench parted them, or (fluids) they would mix two different fluids, or a hot fluid would reach a cold
 * pipe - such joints stay open and are reported. A network takes at most PIPE_MAX_PIPES pipes and PIPE_MAX_PORTS
 * ports; the rest of the run is inert ("Network too long").
 */
import { PIPE_MAX_PIPES, PIPE_MAX_PORTS } from '../core/constants';
import { fluid as fluidSpec, pipeJoins } from '../core/registry';
import { CHUNK_SIZE, OPPOSITE_FACE, type BlockDef, type FluidKey, type IWorld } from '../core/types';
import { FluidNet } from './fluidNet';
import { ItemNet } from './itemNet';
import { Port, type JointReason, type PipeNet } from './pipeNet';
import { KEY_STEP, defaultConfig, defaultMode, keyX, keyY, keyZ, portId, stepKey, type PipeEntity } from './pipeState';
import { chunkKey } from './power';

export interface GraphHost {
  readonly world: IWorld;
  /** The pipe entity at a cell, if any. */
  entity(key: number): PipeEntity | undefined;
  /** An entity whose settings were pruned: drop it if it now remembers nothing. */
  pruned(e: PipeEntity): void;
}

/** What one rebuild changed, for the transport to move content across. */
export interface Rebuild {
  dissolved: PipeNet[];
  built: PipeNet[];
  /** Per new network: how many of its pipes each dissolved network had. */
  shares: Map<PipeNet, Map<PipeNet, number>>;
  /** Per new network: pipe entities holding content no live network owned (a loaded save). */
  orphans: Map<PipeNet, PipeEntity[]>;
}

const chunkOf = (v: number): number => Math.floor(v / CHUNK_SIZE);

export class PipeGraph {
  /** Network of every pipe that belongs to one (inert overflow pipes included). */
  readonly cellNet = new Map<number, PipeNet>();
  items: ItemNet[] = [];
  fluids: FluidNet[] = [];
  private dirtyCells: number[] = [];
  private readonly dirtyNets = new Set<PipeNet>();
  private seeds: number[] = [];
  private nextId = 1;

  constructor(private readonly host: GraphHost) {}

  get dirty(): boolean {
    return this.dirtyCells.length > 0 || this.dirtyNets.size > 0 || this.seeds.length > 0;
  }

  /** A pipe or an endpoint at this cell came or went. */
  changed(key: number): void {
    this.dirtyCells.push(key);
  }

  /** This network must be flooded again (a chunk it reaches loaded, or it ran dry beside a refused joint). */
  redo(net: PipeNet): void {
    this.dirtyNets.add(net);
  }

  /** Flood from this cell at the next rebuild (a pipe entity found on load). */
  seed(key: number): void {
    this.seeds.push(key);
  }

  clear(): void {
    this.cellNet.clear();
    this.items = [];
    this.fluids = [];
    this.dirtyCells = [];
    this.dirtyNets.clear();
    this.seeds = [];
  }

  private block(key: number): BlockDef {
    return this.host.world.getBlock(keyX(key), keyY(key), keyZ(key));
  }

  rebuild(): Rebuild {
    const dissolved = new Set<PipeNet>();
    const oldOf = new Map<number, PipeNet>();
    const seeds = this.seeds;
    this.seeds = [];
    const dissolve = (net: PipeNet): void => {
      if (dissolved.has(net)) return;
      dissolved.add(net);
      for (const list of [net.keys, net.overflow]) {
        for (const k of list) {
          oldOf.set(k, net);
          this.cellNet.delete(k);
          seeds.push(k);
        }
      }
    };
    for (const key of this.dirtyCells) {
      seeds.push(key);
      const net = this.cellNet.get(key);
      if (net) dissolve(net);
      for (let d = 0; d < 6; d++) {
        const k = stepKey(key, d);
        if (k < 0) continue;
        seeds.push(k);
        const n = this.cellNet.get(k);
        if (n) dissolve(n);
      }
    }
    this.dirtyCells = [];
    for (const net of this.dirtyNets) dissolve(net);
    this.dirtyNets.clear();

    const result: Rebuild = { dissolved: [], built: [], shares: new Map(), orphans: new Map() };
    const visited = new Map<number, PipeNet>();
    const edgeWhy = new Map<number, JointReason>();
    for (let s = 0; s < seeds.length; s++) {
      const seed = seeds[s];
      if (visited.has(seed) || this.cellNet.has(seed)) continue;
      const def = this.block(seed);
      if (!def.pipe) continue;
      const net = this.flood(seed, def, visited, edgeWhy, oldOf, dissolved, dissolve, result);
      result.built.push(net);
    }
    result.dissolved = [...dissolved];
    this.items = this.items.filter((n) => !dissolved.has(n));
    this.fluids = this.fluids.filter((n) => !dissolved.has(n));
    for (const net of result.built) {
      net.id = this.nextId++;
      if (net instanceof ItemNet) this.items.push(net);
      else this.fluids.push(net as FluidNet);
    }
    return result;
  }

  /** The fluid a pipe held before this rebuild (its dissolved network's, or a saved anchor's), or null. */
  private heldBefore(key: number, oldOf: Map<number, PipeNet>): FluidKey | null {
    const old = oldOf.get(key);
    if (old instanceof FluidNet) return old.store.litres > 0 ? old.store.fluid : null;
    const store = this.host.entity(key)?.store;
    return store && store.litres > 0 ? store.fluid : null;
  }

  private flood(
    seed: number, seedDef: BlockDef, visited: Map<number, PipeNet>, edgeWhy: Map<number, JointReason>,
    oldOf: Map<number, PipeNet>, dissolved: Set<PipeNet>, dissolve: (net: PipeNet) => void, result: Rebuild,
  ): PipeNet {
    const family = seedDef.pipe!.family;
    const net: PipeNet = family === 'item' ? new ItemNet() : new FluidNet();
    const world = this.host.world;
    const keys: number[] = [seed];
    const xs: number[] = [keyX(seed)];
    const ys: number[] = [keyY(seed)];
    const zs: number[] = [keyZ(seed)];
    const defs: BlockDef[] = [seedDef];
    /** Six neighbour indices (into keys) per pipe, -1 where not joined. */
    const adj: number[] = [];
    visited.set(seed, net);
    net.index.set(seed, 0);
    let held = family === 'fluid' ? this.heldBefore(seed, oldOf) : null;
    let cold = family === 'fluid' && seedDef.pipe!.hot !== true;
    const edgeId = (a: number, dir: number, b: number): number => (a < b ? a * 8 + dir : b * 8 + OPPOSITE_FACE[dir]);
    const joint = (i: number, dir: number, reason: JointReason): void => {
      net.joints.push({ key: keys[i], x: xs[i], y: ys[i], z: zs[i], dir, reason });
    };
    const portCells: Array<[number, number, BlockDef, BlockDef]> = [];
    for (let i = 0; i < keys.length; i++) {
      const a = keys[i];
      const ax = xs[i];
      const ay = ys[i];
      const az = zs[i];
      const aDef = defs[i];
      const entity = this.host.entity(a);
      let pruned = false;
      for (let dir = 0; dir < 6; dir++) {
        const by = ay + DY[dir];
        if (by < 0 || by > 127) {
          adj.push(-1);
          continue;
        }
        const bx = ax + DX[dir];
        const bz = az + DZ[dir];
        const bDef = world.getBlock(bx, by, bz);
        if (bDef.id === 0) {
          adj.push(-1);
          if ((dir === 0 || dir === 1 || dir === 4 || dir === 5) && (chunkOf(bx) !== chunkOf(ax) || chunkOf(bz) !== chunkOf(az)) && !world.isLoaded(bx, bz)) {
            net.frontier.add(chunkKey(chunkOf(bx), chunkOf(bz)));
          }
          if (entity?.ports?.[dir]) {
            entity.ports[dir] = null;
            pruned = true;
          }
          if (entity?.cut && entity.cut & (1 << dir)) {
            entity.cut &= ~(1 << dir);
            pruned = true;
          }
          continue;
        }
        const b = a + KEY_STEP[dir];
        if (bDef.pipe === null || bDef.pipe.family !== family) {
          adj.push(-1);
          if (entity?.cut && entity.cut & (1 << dir)) {
            entity.cut &= ~(1 << dir);
            pruned = true;
          }
          if (pipeJoins(aDef, bDef)) portCells.push([i, dir, aDef, bDef]);
          else if (entity?.ports?.[dir]) {
            entity.ports[dir] = null;
            pruned = true;
          }
          continue;
        }
        if (this.cut(entity, b, dir)) {
          adj.push(-1);
          joint(i, dir, 'cut');
          continue;
        }
        const other = visited.get(b);
        if (other) {
          if (other === net) adj.push(net.index.get(b) as number);
          else {
            adj.push(-1);
            joint(i, dir, edgeWhy.get(edgeId(a, dir, b)) ?? 'mismatch');
          }
          continue;
        }
        const live = this.cellNet.get(b);
        if (live && !dissolved.has(live)) dissolve(live);
        if (family === 'fluid') {
          const theirs = this.heldBefore(b, oldOf);
          const f = held ?? theirs;
          const bHot = bDef.pipe.hot === true;
          const why: JointReason | null = held && theirs && held !== theirs ? 'mismatch' : f && fluidSpec(f).hot && (!bHot || cold) ? 'hot' : null;
          if (why) {
            adj.push(-1);
            edgeWhy.set(edgeId(a, dir, b), why);
            joint(i, dir, why);
            continue;
          }
          held = f;
          if (!bHot) cold = true;
        }
        const j = keys.length;
        visited.set(b, net);
        net.index.set(b, j);
        keys.push(b);
        xs.push(bx);
        ys.push(by);
        zs.push(bz);
        defs.push(bDef);
        adj.push(j);
      }
      if (pruned && entity) this.host.pruned(entity);
    }
    this.arrange(net, keys, xs, ys, zs, defs, adj);
    for (const [i, dir, pipeDef, endDef] of portCells) {
      const key = keys[i];
      const saved = this.host.entity(key)?.ports?.[dir] ?? null;
      const cfg = saved ?? defaultConfig(defaultMode(family, endDef));
      const p = pipeDef.pipe!;
      const local = i < PIPE_MAX_PIPES ? i : -1;
      const port = new Port(portId(key, dir), local, key, xs[i], ys[i], zs[i], dir, endDef, cfg, saved !== null, p.ratePerS, p.batch ?? 1);
      if (local >= 0 && net.ports.length < PIPE_MAX_PORTS) net.ports.push(port);
      else net.extraPorts.push(port);
    }
    const shares = new Map<PipeNet, number>();
    const orphans: PipeEntity[] = [];
    for (const k of keys) {
      this.cellNet.set(k, net);
      const old = oldOf.get(k);
      if (old) shares.set(old, (shares.get(old) ?? 0) + 1);
      else {
        const e = this.host.entity(k);
        if (e && (e.store || (e.packets && e.packets.length > 0))) orphans.push(e);
      }
    }
    result.shares.set(net, shares);
    if (orphans.length > 0) result.orphans.set(net, orphans);
    return net;
  }

  /** Whether the joint from a pipe (with entity `ea`) towards `dir` to pipe `b` was parted with the wrench. */
  private cut(ea: PipeEntity | undefined, b: number, dir: number): boolean {
    if (ea?.cut && ea.cut & (1 << dir)) return true;
    const cut = this.host.entity(b)?.cut;
    return cut !== undefined && (cut & (1 << OPPOSITE_FACE[dir])) !== 0;
  }

  /** Flat arrays of the active pipes (the first PIPE_MAX_PIPES found): positions, joints, speed or capacity. */
  private arrange(net: PipeNet, keys: number[], xs: number[], ys: number[], zs: number[], defs: BlockDef[], adj: number[]): void {
    const n = Math.min(keys.length, PIPE_MAX_PIPES);
    net.keys = keys.slice(0, n);
    net.overflow = keys.slice(n);
    for (const k of net.overflow) net.index.delete(k);
    net.xs = Int32Array.from(xs.slice(0, n));
    net.ys = Int32Array.from(ys.slice(0, n));
    net.zs = Int32Array.from(zs.slice(0, n));
    net.value = new Float32Array(n);
    net.adj = new Int32Array(n * 6);
    net.hot = true;
    let cap = 0;
    for (let i = 0; i < n; i++) {
      const p = defs[i].pipe!;
      const v = net.family === 'item' ? p.speedBlocksPerS ?? 1 : p.capacityL ?? 0;
      net.value[i] = v;
      cap += v;
      if (p.hot !== true) net.hot = false;
      for (let d = 0; d < 6; d++) {
        const j = adj[i * 6 + d];
        net.adj[i * 6 + d] = j < n ? j : -1;
      }
    }
    if (net instanceof FluidNet) net.capacity = cap;
  }
}

const DX = [1, -1, 0, 0, 0, 0];
const DY = [0, 0, 1, -1, 0, 0];
const DZ = [0, 0, 0, 0, 1, -1];
