/** Power networks (spec 3.2): flood-filled groups of touching power blocks, solved once per tick. */
import { BATTERY_EFFICIENCY, BROWNOUT_STALL } from '../core/constants';
import type { GameBus } from '../core/context';
import { CHUNK_SIZE, FACE_DIRS, type IWorld } from '../core/types';
import { posKey, type MachineEntity, type SimNode } from './entities';

export type NetworkState = 'ok' | 'brownout' | 'overload';

/** Seconds of history kept per network (one sample per second). */
export const HISTORY_SECONDS = 60;
/** A new state must hold this many ticks before it is announced, so a machine starting up does not flicker alerts. */
const ALERT_HOLD_TICKS = 10;
/** Below this satisfaction a network counts as browned out (just under 1 to ignore rounding). */
const BROWNOUT_BELOW = 0.999;

/** Numeric key of a chunk column (|cx|, |cz| < 32768). */
export const chunkKey = (cx: number, cz: number): number => ((cx & 0xffff) << 16) | (cz & 0xffff);

export class Network {
  readonly nodes: SimNode[] = [];
  readonly storage: SimNode[] = [];
  cables = 0;
  /** Lowest cable rating in the network; Infinity when it has no cable. */
  ratingW = Infinity;
  /** Chunk columns (chunkKey) holding any block of this network: loading or unloading one may change it. */
  readonly chunks = new Set<number>();

  // Results of the last solve.
  generationW = 0;
  demandW = 0;
  deliveredW = 0;
  storedJ = 0;
  capacityJ = 0;
  chargeW = 0;
  dischargeW = 0;
  /** Satisfaction: the fraction of its demand every consumer receives. */
  f = 1;
  /** Fraction of the available generation actually used (fuel generators burn in proportion). */
  load = 0;
  overloaded = false;

  state: NetworkState = 'ok';
  private pending: NetworkState = 'ok';
  private pendingTicks = 0;

  readonly historyG = new Array<number>(HISTORY_SECONDS).fill(0);
  readonly historyUsed = new Array<number>(HISTORY_SECONDS).fill(0);
  private sumG = 0;
  private sumUsed = 0;
  private samples = 0;

  /** `anchor` identifies the network across rebuilds: the key of its first member. */
  constructor(readonly id: number, readonly anchor: string) {}

  /** Keeps alert state and history when the same network is rebuilt after a block change. */
  inherit(old: Network): void {
    this.state = old.state;
    this.pending = old.pending;
    this.pendingTicks = old.pendingTicks;
    for (let i = 0; i < HISTORY_SECONDS; i++) {
      this.historyG[i] = old.historyG[i];
      this.historyUsed[i] = old.historyUsed[i];
    }
  }

  solve(dt: number): void {
    let G = 0;
    let D = 0;
    for (const n of this.nodes) {
      G += n.e.availW;
      D += n.e.demandW;
    }
    let outCap = 0;
    let inCap = 0;
    let stored = 0;
    let capacity = 0;
    for (const n of this.storage) {
      const e = n.e as MachineEntity;
      const cap = n.spec.capacityJ ?? 0;
      const rate = n.spec.rateW ?? 0;
      const eff = n.spec.params?.chargeEfficiency ?? BATTERY_EFFICIENCY;
      const usable = n.loaded && e.on;
      n.maxOut = usable ? Math.min(rate, e.storedJ / dt) : 0;
      n.maxIn = usable ? Math.max(0, Math.min(rate, (cap - e.storedJ) / (eff * dt))) : 0;
      outCap += n.maxOut;
      inCap += n.maxIn;
      stored += e.storedJ;
      capacity += cap;
    }
    const rating = this.ratingW;
    const dis = Math.min(Math.max(D - G, 0), outCap);
    const supply = Math.min(G + dis, rating);
    const f = D > 0 ? Math.min(1, supply / D) : 1;
    const used = f * D;
    const fromGen = Math.min(G, used);
    const fromBat = used - fromGen;
    const chg = dis > 0 ? 0 : Math.max(0, Math.min(Math.min(G, rating) - used, inCap));
    for (const n of this.storage) {
      const e = n.e as MachineEntity;
      const cap = n.spec.capacityJ ?? 0;
      const eff = n.spec.params?.chargeEfficiency ?? BATTERY_EFFICIENCY;
      const out = outCap > 0 ? (fromBat * n.maxOut) / outCap : 0;
      const into = inCap > 0 ? (chg * n.maxIn) / inCap : 0;
      const next = e.storedJ + (eff * into - out) * dt;
      stored += next - e.storedJ;
      e.storedJ = next < 0 ? 0 : next > cap ? cap : next;
      e.outW = out;
      e.demandW = 0;
      e.availW = 0;
      e.f = into;
    }
    this.generationW = G;
    this.demandW = D;
    this.deliveredW = used;
    this.storedJ = stored;
    this.capacityJ = capacity;
    this.chargeW = chg;
    this.dischargeW = fromBat;
    this.f = f;
    this.load = G > 0 ? (fromGen + chg) / G : 0;
    this.overloaded = G + dis > rating && D > supply;
    this.sumG += G;
    this.sumUsed += used;
    this.samples++;
  }

  /** Announces overload / brown-out / recovery, on changes only. */
  alert(bus: GameBus): void {
    const now: NetworkState = this.overloaded ? 'overload' : this.demandW > 0 && this.f < BROWNOUT_BELOW ? 'brownout' : 'ok';
    if (now !== this.pending) {
      this.pending = now;
      this.pendingTicks = 0;
    }
    if (now === this.state || ++this.pendingTicks < ALERT_HOLD_TICKS) return;
    const was = this.state;
    this.state = now;
    const at = this.nodes[0].e;
    const pct = Math.floor(this.f * 100);
    if (now === 'overload') {
      bus.emit('power:alert', { kind: 'overload', message: `Cables overloaded - machines get ${pct}% power`, x: at.x, y: at.y, z: at.z });
      bus.emit('sfx', { name: 'spark', x: at.x, y: at.y, z: at.z });
    } else if (now === 'brownout') {
      bus.emit('power:alert', { kind: 'brownout', message: `Brown-out - machines get ${pct}% power`, x: at.x, y: at.y, z: at.z });
    } else if (was !== 'ok') {
      bus.emit('power:alert', { kind: 'recovered', message: 'Power restored', x: at.x, y: at.y, z: at.z });
    }
  }

  /** Pushes one sample (the mean of the last second) into the rolling history. */
  sample(): void {
    if (this.samples === 0) return;
    this.historyG.shift();
    this.historyG.push(this.sumG / this.samples);
    this.historyUsed.shift();
    this.historyUsed.push(this.sumUsed / this.samples);
    this.sumG = 0;
    this.sumUsed = 0;
    this.samples = 0;
  }
}

/** True when a consumer on this network gets enough power to run at all. */
export const powered = (net: Network | null): boolean => net !== null && net.f >= BROWNOUT_STALL && net.deliveredW > 0;

/**
 * Flood-fills every network from the power devices in `nodes` and writes `node.net`; `cables` is refilled with
 * the network of every cable position. Networks that keep their first member inherit alert state and history
 * from `previous`.
 */
export function buildNetworks(
  world: IWorld,
  nodes: readonly SimNode[],
  byKey: ReadonlyMap<string, SimNode>,
  previous: readonly Network[],
  cables: Map<string, Network>,
): Network[] {
  const old = new Map<string, Network>();
  for (const net of previous) old.set(net.anchor, net);
  const seen = new Set<string>();
  const out: Network[] = [];
  const stack: number[] = [];
  const cablesSeen: string[] = [];
  cables.clear();
  for (const n of nodes) n.net = null;
  for (const start of nodes) {
    if (start.net !== null || seen.has(start.key)) continue;
    if (world.getBlock(start.e.x, start.e.y, start.e.z).power === null) continue;
    const net = new Network(out.length + 1, start.key);
    stack.push(start.e.x, start.e.y, start.e.z);
    seen.add(start.key);
    cablesSeen.length = 0;
    while (stack.length > 0) {
      const z = stack.pop() as number;
      const y = stack.pop() as number;
      const x = stack.pop() as number;
      const def = world.getBlock(x, y, z);
      net.chunks.add(chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)));
      if (def.power === 'cable') {
        net.cables++;
        if (def.cableRatingW < net.ratingW) net.ratingW = def.cableRatingW;
        cablesSeen.push(posKey(x, y, z));
      } else {
        const node = byKey.get(posKey(x, y, z));
        if (node) {
          node.net = net;
          net.nodes.push(node);
          if (node.spec.role === 'storage') net.storage.push(node);
        }
      }
      for (const [dx, dy, dz] of FACE_DIRS) {
        const k = posKey(x + dx, y + dy, z + dz);
        if (seen.has(k) || world.getBlock(x + dx, y + dy, z + dz).power === null) continue;
        seen.add(k);
        stack.push(x + dx, y + dy, z + dz);
      }
    }
    if (net.nodes.length === 0) continue;
    for (const k of cablesSeen) cables.set(k, net);
    const before = old.get(net.anchor);
    if (before) net.inherit(before);
    out.push(net);
  }
  return out;
}
