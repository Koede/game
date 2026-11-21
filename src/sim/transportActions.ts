/**
 * What the player does to pipes and fluid blocks (spec 16.2, 16.3): the wrench (cycle a pipe end push -> pull -> off;
 * part or join two pipes), the pipe screen's settings, and buckets on tanks and fluid endpoints. Each returns ok or a
 * short reason the UI can show.
 */
import { LITRES_PER_BUCKET } from '../core/constants';
import { FLUIDS, bucketFilledWith, fluid as fluidSpec, fluidInBucket } from '../core/registry';
import { OPPOSITE_FACE, type Face, type FluidKey } from '../core/types';
import { OK, refuse, type ActionResult } from './entities';
import { takes } from './fluidNet';
import type { Port } from './pipeNet';
import { applyChange, cellKey, invalidChange, portId, stepKey, type PortChange, type PortMode } from './pipeState';
import type { Transport } from './transport';

export type WrenchResult =
  | { ok: true; did: 'port'; mode: PortMode }
  | { ok: true; did: 'joint'; joined: boolean }
  | { ok: false; reason: string };

/** What a bucket did: the item now in the player's hand, or why nothing happened (`endpoint`: the block takes fluids). */
export type BucketResult =
  | { ok: true; held: string; fluid: FluidKey; litres: number }
  | { ok: false; reason: string; endpoint: boolean };

const NEXT: Record<PortMode, PortMode> = { push: 'pull', pull: 'off', off: 'push' };
const DIRS = 6;

/** The port of the pipe at x, y, z towards `dir` (after a rebuild), or a reason why there is none. */
function findPort(t: Transport, x: number, y: number, z: number, dir: number): Port | string {
  if (!t.blockAt(x, y, z).pipe) return 'That is not a pipe';
  if (!Number.isInteger(dir) || dir < 0 || dir >= DIRS) return 'Pick a side of the pipe';
  const net = t.netAt(x, y, z);
  const id = portId(cellKey(x, y, z), dir);
  const port = net ? net.ports.find((p) => p.id === id) ?? net.extraPorts.find((p) => p.id === id) : undefined;
  return port ?? 'Nothing to connect to on that side';
}

/** Makes a port's settings part of the saved world (its pipe gets an entity holding them). */
function keep(t: Transport, port: Port): void {
  if (port.saved) return;
  const e = t.ensureEntity(port.key);
  if (!e.ports) e.ports = [null, null, null, null, null, null];
  e.ports[port.dir] = port.cfg;
  port.saved = true;
}

/** Wrench on a pipe arm touching a block: push -> pull -> off -> push. */
export function wrenchPort(t: Transport, x: number, y: number, z: number, dir: number): WrenchResult {
  const port = findPort(t, x, y, z, dir);
  if (typeof port === 'string') return refuse(port) as WrenchResult;
  keep(t, port);
  const mode = NEXT[port.cfg.mode];
  port.cfg.mode = mode;
  port.cool = 0;
  port.state = 'idle';
  const name = port.block.name;
  const text = mode === 'pull' ? `Pulling from ${name}` : mode === 'push' ? `Pushing into ${name}` : `Closed to ${name}`;
  t.bus.emit('toast', { text, kind: 'info' });
  t.bus.emit('sfx', { name: 'pipe_clunk', x, y, z });
  return { ok: true, did: 'port', mode };
}

/** Wrench on the centre of a pipe: parts it from the neighbouring pipe that way, or joins them again. */
export function wrenchJoint(t: Transport, x: number, y: number, z: number, dir: number): WrenchResult {
  const def = t.blockAt(x, y, z);
  if (!def.pipe) return refuse('That is not a pipe') as WrenchResult;
  if (!Number.isInteger(dir) || dir < 0 || dir >= DIRS) return refuse('Pick a side of the pipe') as WrenchResult;
  const a = cellKey(x, y, z);
  const b = stepKey(a, dir);
  const dx = [1, -1, 0, 0, 0, 0][dir];
  const dy = [0, 0, 1, -1, 0, 0][dir];
  const dz = [0, 0, 0, 0, 1, -1][dir];
  const other = t.blockAt(x + dx, y + dy, z + dz);
  if (b < 0 || !other.pipe || other.pipe.family !== def.pipe.family) return refuse('No pipe to join on that side') as WrenchResult;
  const back = OPPOSITE_FACE[dir];
  const ea = t.entityAt(a);
  const eb = t.entityAt(b);
  const parted = ((ea?.cut ?? 0) & (1 << dir)) !== 0 || ((eb?.cut ?? 0) & (1 << back)) !== 0;
  if (parted) {
    if (ea?.cut) ea.cut &= ~(1 << dir);
    if (eb?.cut) eb.cut &= ~(1 << back);
    for (const e of [ea, eb]) {
      if (!e || e.cut) continue;
      delete e.cut;
      t.tidy(e);
    }
  } else {
    const na = t.ensureEntity(a);
    const nb = t.ensureEntity(b);
    na.cut = (na.cut ?? 0) | (1 << dir);
    nb.cut = (nb.cut ?? 0) | (1 << back);
  }
  t.changed(a);
  let text = parted ? 'Pipes joined' : 'Pipes parted';
  if (parted) {
    const why = t.netAt(x, y, z)?.joints.find((j) => j.key === a && j.dir === dir)?.reason;
    if (why === 'mismatch') text = 'The pipes hold different fluids - they stay apart';
    else if (why === 'hot') text = 'Too hot for this pipe - they stay apart';
  }
  t.bus.emit('toast', { text, kind: 'info' });
  t.bus.emit('sfx', { name: 'pipe_clunk', x, y, z });
  return { ok: true, did: 'joint', joined: parted };
}

/** The wrench as the player uses it: on an arm towards a block it switches that end, towards a pipe it parts/joins. */
export function wrench(t: Transport, x: number, y: number, z: number, dir: number): WrenchResult {
  const port = findPort(t, x, y, z, dir);
  if (typeof port !== 'string') return wrenchPort(t, x, y, z, dir);
  if (port !== 'Nothing to connect to on that side') return refuse(port) as WrenchResult;
  return wrenchJoint(t, x, y, z, dir);
}

/** The pipe screen changes a port's settings (mode, distribution, filter, filter mode, priority). */
export function setPort(t: Transport, x: number, y: number, z: number, dir: number, change: PortChange): ActionResult {
  const port = findPort(t, x, y, z, dir);
  if (typeof port === 'string') return refuse(port);
  const family = t.blockAt(x, y, z).pipe!.family;
  const bad = invalidChange(family, change);
  if (bad) return refuse(bad);
  keep(t, port);
  const mode = port.cfg.mode;
  applyChange(port.cfg, change);
  if (port.cfg.mode !== mode) {
    port.cool = 0;
    port.state = 'idle';
  }
  return OK;
}

const isEmptyBucket = (key: string): boolean => FLUIDS.some((f) => f.bucket?.empty === key);

/**
 * A bucket used on a block (spec 16.2): a full bucket pours 1000 L into a tank or a fluid endpoint that takes it and
 * becomes its empty bucket; an empty one takes 1000 L of a fluid it can carry. The player module swaps the held item
 * for `held`. Nothing is changed when it refuses.
 */
export function bucketUse(t: Transport, x: number, y: number, z: number, face: Face, held: string): BucketResult {
  const full = fluidInBucket(held);
  if (!full && !isEmptyBucket(held)) return { ok: false, reason: 'That is not a bucket', endpoint: false };
  const ep = t.fluidEndpointAt(x, y, z, face);
  const block = t.blockAt(x, y, z);
  if (!ep) {
    const hatch = block.key === 'fluid_hatch';
    return { ok: false, reason: hatch ? 'The hearth is not formed' : 'Use it on a tank or a machine that takes fluids', endpoint: hatch };
  }
  const sound = (key: FluidKey): void => t.bus.emit('sfx', { name: key === 'lava' ? 'scoop_lava' : 'splash', x, y, z });
  if (full) {
    const room = ep.room(full.key);
    if (room < LITRES_PER_BUCKET) {
      const other = ep.offer();
      const reason = !takes(ep, full.key) ? `The ${block.name} does not take ${full.name.toLowerCase()}`
        : other && other.fluid !== full.key ? `The ${block.name} holds ${fluidSpec(other.fluid).name.toLowerCase()}`
          : room > 0 ? 'Not enough room for a bucketful' : `The ${block.name} is full`;
      return { ok: false, reason, endpoint: true };
    }
    ep.fill(full.key, LITRES_PER_BUCKET);
    sound(full.key);
    return { ok: true, held: full.bucket!.empty, fluid: full.key, litres: LITRES_PER_BUCKET };
  }
  const offer = ep.offer();
  if (!offer || offer.litres <= 0) return { ok: false, reason: `The ${block.name} holds nothing to scoop`, endpoint: true };
  const into = bucketFilledWith(held, offer.fluid);
  const spec = fluidSpec(offer.fluid);
  if (!into) {
    const reason = !spec.bucket ? `A bucket cannot carry ${spec.name.toLowerCase()}`
      : offer.fluid === 'lava' ? 'Lava needs a bronze bucket' : 'A bronze bucket is kept for lava';
    return { ok: false, reason, endpoint: true };
  }
  if (offer.litres < LITRES_PER_BUCKET) {
    return { ok: false, reason: `A bucket takes ${LITRES_PER_BUCKET} L - it holds ${Math.floor(offer.litres)} L`, endpoint: true };
  }
  ep.drain(offer.fluid, LITRES_PER_BUCKET);
  sound(offer.fluid);
  return { ok: true, held: into, fluid: offer.fluid, litres: LITRES_PER_BUCKET };
}
