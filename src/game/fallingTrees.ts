/**
 * Felled trees (docs/plans/tree-felling.md): an axe wears a tree's health down at its base; at zero the tree gives a
 * warning (a creak, the leaves shake), then its trunk and canopy are taken out of the world and become one rigid body
 * (treeBody.ts) that topples about the stump under gravity and comes to rest on the ground. DOM-free. The renderer
 * draws `trees()` each frame (render/fallingTrees.ts).
 *
 * Pieces: this module owns the falling trees; the wait rule and the rules of blows are in treeFell.ts.
 */
import type { GameBus } from '../core/context';
import { FLAG_FELLED_TREE } from '../core/constants';
import { block as blockByKey, itemOrNull } from '../core/registry';
import { AIR, Face, makeVoxel, Facing, type BlockDef, type IWorld, type ItemAmount, type Slot } from '../core/types';
import type { RayHit } from '../player/raycast';
import { exertMining } from './hunger';
import { rollDrops } from './mining';
import type { PlayerState } from './playerState';
import { trunkAbove } from './felling';
import { FallenLogs, aimFallen, dropCut, mergeDrops, fallenTip, type FallenAim, type FallenEvent, PROTECT_RADIUS } from './fallenLogs';
import {
  poseOf,
  toWorld,
  worldPointOf,
  pointOf,
  ROD_RADIUS,
  BodyState,
  Pivot,
  RodInertia,
  RodSegment,
  Terrain,
  initialBody,
  rodInertia,
  rodProfile,
  stepBody,
  STEP_S,
} from './treeBody';
import {
  CANOPY_LOG_BONUS,
  TREE_MIN_TRUNK,
  advanceWait,
  axePower,
  canopyLevelsOf,
  fallDirection,
  impactDamage,
  inFallZone,
  treeHealth,
} from './treeFell';

/** Seconds of creak and shaking before a felled tree starts to go. */
export const WARN_S = 0.9;
/** Most canopy segments a tree's rod carries (the crown is modelled by a few heavy segments). */
const MAX_CANOPY_SEGS = 6;
/** Most leaves gathered into one falling crown. */
const MAX_LEAVES = 600;
const LEAF_REACH = 7;
/** Body sizes for the damage sweep, blocks: a player, an animal. */
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;
const MOB_HEIGHT = 1.0;
const MOB_RADIUS = 0.4;
/** Tip spin a blow gives: a base value plus a little per axe tier (rad/s). */
const TIP_OMEGA_BASE = 0.25;
const TIP_OMEGA_PER_POWER = 0.05;

export interface Cell {
  x: number;
  y: number;
  z: number;
  key: string;
}

/** A tree on the way down (or still standing with its warning). */
export interface FallingTree {
  id: number;
  /** Log block key of the trunk (oak_log, pine_log). */
  logKey: string;
  /** The stump cell: the bottom log of the trunk, removed when the tree falls. */
  base: { x: number; y: number; z: number };
  pivot: Pivot;
  segs: RodSegment[];
  inertia: RodInertia;
  body: BodyState;
  /** Trunk logs above the base, bottom first (cell i sits at radius i + 0.5). */
  trunk: Cell[];
  /** Canopy leaves, gathered at the warning. */
  leaves: Cell[];
  /** Distinct leaf heights. */
  canopyLevels: number;
  phase: 'warning' | 'falling' | 'landed';
  warnS: number;
  /** Wait clock: advanced by treeFell.advanceWait. */
  clock: number;
  /** Body time not yet stepped (fixed 1/60 s steps). */
  acc: number;
  /** Tip spin the last blow gave, rad/s. */
  tipOmega: number;
  /** Who the falling body has already hit: the player's key, or a creature's id. One hit each. */
  hit: Set<string | number>;
}

/** Cell position relative to the pivot, in the falling body's own frame: lat (across), a (up the trunk), s (along the fall). */
export function cellLocal(c: Cell, pivot: Pivot): { lat: number; a: number; s: number } {
  const ox = c.x + 0.5 - pivot.px;
  const oz = c.z + 0.5 - pivot.pz;
  return { lat: -ox * pivot.dz + oz * pivot.dx, a: c.y + 0.5 - pivot.py, s: ox * pivot.dx + oz * pivot.dz };
}

/** Base of a tree: the lowest log of the connected trunk under (x, y, z). */
export function treeBaseOf(world: IWorld, x: number, y: number, z: number, key: string): { x: number; y: number; z: number } {
  let by = y;
  for (let i = 0; i < 80 && world.getBlock(x, by - 1, z).key === key; i++) by--;
  return { x, y: by, z };
}

/** The leaf kind a log grows: oak_log -> oak_leaves. */
export const leafKeyOf = (logKey: string): string => logKey.replace(/_log$/, '_leaves');

/** What saves the fallen logs with the world (World.persist / World.loadExtra). */
export interface PersistHost {
  persist(key: string, save: () => unknown): () => void;
  loadExtra(key: string, fn: (raw: unknown) => void): boolean;
}

export interface FallingTreesOptions {
  rng?: () => number;
  /** The world's save hooks: the fallen logs are kept in the world save under 'fallenLogs'. */
  persist?: PersistHost;
  /** The 'Auto-buck felled trees' setting: a landed log is cut into pieces at once. */
  autoBuck?: () => boolean;
  /** Reduce motion: the fall runs twice as fast (no shaking either way). */
  reduceMotion?: () => boolean;
  /** The 'Tree damage to me' setting (on by default). */
  treeDamage?: () => boolean;
  /** Creatures a falling tree can hurt (MobManager satisfies it). */
  victims?: TreeVictims;
}

/** What a falling tree hurts: animals (MobManager.all and its hit). */
export interface TreeVictims {
  readonly all: readonly { readonly id: number; readonly x: number; readonly y: number; readonly z: number }[];
  hit(id: number, damage: number, fromX: number, fromZ: number): unknown;
}

export class FallingTrees {
  private nextId = 1;
  private readonly active: FallingTree[] = [];
  /** Axe health of standing trees, by base cell key. */
  private readonly health = new Map<string, number>();
  private readonly rng: () => number;
  private readonly autoBuck: () => boolean;
  private readonly fallen: FallenLogs;
  private readonly unpersist: (() => void) | null;
  private readonly treeDamage: () => boolean;
  private readonly reduceMotion: () => boolean;
  private readonly victims: TreeVictims | null;

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
    private readonly bus: GameBus,
    options: FallingTreesOptions = {},
  ) {
    this.rng = options.rng ?? Math.random;
    this.autoBuck = options.autoBuck ?? (() => false);
    this.treeDamage = options.treeDamage ?? (() => true);
    this.reduceMotion = options.reduceMotion ?? (() => false);
    this.victims = options.victims ?? null;
    this.fallen = new FallenLogs(world);
    if (options.persist) {
      options.persist.loadExtra('fallenLogs', (raw) => this.fallen.load(raw));
      this.unpersist = options.persist.persist('fallenLogs', () => this.fallen.toJSON());
    } else {
      this.unpersist = null;
    }
  }

  /** The trees on their way down, for drawing. */
  trees(): readonly FallingTree[] {
    return this.active;
  }

  /** The logs lying on the ground, for drawing and aiming. */
  logs(): ReturnType<FallenLogs['list']> {
    return this.fallen.list();
  }

  /** The fallen log the ray meets first (within `maxDist`), as a target for mining; null when none. */
  aimFallen(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxDist: number): FallenAim | null {
    return aimFallen(this.fallen.list(), o, d, maxDist);
  }

  dispose(): void {
    this.unpersist?.();
  }

  /**
   * The fallen log on the aim ray as a mining target: its tip cell, with a negative voxel (-1 - id) so the chop path
   * knows it is a log lying on the ground and not a block in the world. Null when no log is within `maxDist`.
   */
  aimHit(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxDist: number): RayHit | null {
    const a = aimFallen(this.fallen.list(), o, d, maxDist);
    if (!a) return null;
    return {
      x: a.x,
      y: a.y,
      z: a.z,
      face: Face.PY,
      px: a.x,
      py: a.y + 1,
      pz: a.z,
      voxel: -1 - a.log.id,
      block: blockByKey(a.log.logKey),
      distance: a.distance,
    } as RayHit;
  }

  /**
   * An axe blow on a log (interaction.ts, before the normal break). Returns true when the blow is taken by the tree
   * (the log stays until the tree falls), false when the log should break the normal way (no axe, or a tree too small).
   */
  chop(hit: { x: number; y: number; z: number; block: BlockDef; voxel: number }): boolean {
    const held = this.player.heldStack();
    const tool = heldAxe(held);
    // A negative voxel marks a fallen log (controller aim, see fallenLogs.ts): its id is -1 - voxel.
    if (hit.voxel < 0) return this.cutFallen(-1 - hit.voxel, tool, hit.x, hit.y, hit.z);
    if (!tool || this.player.dead) return false;
    const key = hit.block.key;
    if (!key.endsWith('_log')) return false;
    const base = treeBaseOf(this.world, hit.x, hit.y, hit.z, key);
    const cells = trunkAbove(this.world, base.x, base.y, base.z, 400);
    const trunkLen = cells.filter((c) => c.y > base.y).length;
    if (trunkLen < TREE_MIN_TRUNK) return false;
    const k = `${base.x},${base.y},${base.z}`;
    const left = (this.health.get(k) ?? treeHealth(trunkLen)) - axePower(tool.tier);
    this.player.wearHeld(hit.block);
    exertMining(this.player);
    this.bus.emit('sfx', { name: 'tree_chop', x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
    if (left > 0) {
      this.health.set(k, left);
      return true;
    }
    this.health.delete(k);
    this.start(key, base, tool.tier, trunkLen);
    return true;
  }

  /** One axe cut on a fallen log (its piece drops as log items); true, the blow is taken. */
  private cutFallen(id: number, tool: { tier: number } | null, x: number, y: number, z: number): boolean {
    if (!tool || this.player.dead) {
      this.bus.emit('toast', { text: 'A fallen log needs an axe to cut it up.', kind: 'info' });
      return true;
    }
    const cut = this.fallen.cut(id, this.rng);
    if (!cut) return true;
    dropCut(this.player, cut);
    this.player.wearHeld(cut.logDef);
    exertMining(this.player);
    this.bus.emit('sfx', { name: 'tree_chop', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    return true;
  }

  /** Starts a warning for the tree at `base` (its trunk is still standing until the warning ends). */
  private start(logKey: string, base: { x: number; y: number; z: number }, axeTier: number, _trunkLen: number): void {
    // The trunk is every log the flood fill finds above the base (a bent trunk included).
    const cells: Cell[] = trunkAbove(this.world, base.x, base.y, base.z, 400).filter((c) => c.y > base.y).map((c) => ({ x: c.x, y: c.y, z: c.z, key: logKey }));
    const leaves = this.gatherLeaves(logKey, cells, base);
    const levels = canopyLevelsOf(leaves.map((l) => l.y));
    const T = cells.length;
    const topY = cells.reduce((m, c) => Math.max(m, c.y), base.y);
    const leafTop = leaves.reduce((m, l) => Math.max(m, l.y), topY);
    const canopySegs = Math.min(MAX_CANOPY_SEGS, Math.max(1, leafTop - topY));
    const segs = rodProfile(T, canopySegs);
    const player = this.player.position;
    const dir = fallDirection(player.x, player.z, base.x + 0.5, base.z + 0.5, this.player.yaw);
    const tipOmega = TIP_OMEGA_BASE + TIP_OMEGA_PER_POWER * Math.max(1, axeTier);
    const tree: FallingTree = {
      id: this.nextId++,
      logKey,
      base,
      pivot: { px: base.x + 0.5, pz: base.z + 0.5, py: base.y + 1, dx: dir.dx, dz: dir.dz },
      segs,
      inertia: rodInertia(segs),
      body: initialBody(0.02, tipOmega),
      trunk: cells,
      leaves,
      canopyLevels: levels,
      phase: 'warning',
      warnS: WARN_S,
      clock: 0,
      acc: 0,
      tipOmega,
      hit: new Set<string | number>(),
    };
    this.active.push(tree);
    this.bus.emit('sfx', { name: 'tree_creak', x: base.x + 0.5, y: base.y + 0.5, z: base.z + 0.5 });
    this.bus.emit('toast', { text: 'Timber!', kind: 'warn' });
  }

  private gatherLeaves(logKey: string, trunk: Cell[], base: { x: number; y: number; z: number }): Cell[] {
    const leafKey = leafKeyOf(logKey);
    const out: Cell[] = [];
    const seen = new Set<string>();
    const queue: Cell[] = [];
    const push = (x: number, y: number, z: number) => {
      const k = `${x},${y},${z}`;
      if (seen.has(k)) return;
      seen.add(k);
      if (this.world.getBlock(x, y, z).key !== leafKey) return;
      if (Math.hypot(x - base.x, z - base.z) > LEAF_REACH) return;
      const c = { x, y, z, key: leafKey };
      queue.push(c);
      out.push(c);
    };
    for (const c of trunk) {
      for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) push(c.x + dx, c.y + dy, c.z + dz);
    }
    for (let i = 0; i < queue.length && out.length < MAX_LEAVES; i++) {
      const c = queue[i];
      for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (dx || dy || dz) push(c.x + dx, c.y + dy, c.z + dz);
      }
    }
    return out;
  }

  /** Advances every tree: warnings count down, falling trees step their body, landings give their drops. */
  tick(dt: number): void {
    for (const e of this.fallen.tick(dt, (x, z) => this.protectedAt(x, z))) this.onFallenEvent(e);
    for (let i = this.active.length - 1; i >= 0; i--) {
      const tree = this.active[i];
      if (tree.phase === 'warning') {
        tree.warnS -= dt;
        if (tree.warnS <= 0) this.release(tree);
        continue;
      }
      if (tree.phase !== 'falling') continue;
      const p = this.player.position;
      const inZone = inFallZone(p.x, p.z, tree.pivot.px, tree.pivot.pz, tree.pivot.dx, tree.pivot.dz, tree.segs.length ? tree.segs[tree.segs.length - 1].r : 0);
      const next = advanceWait(tree.clock, dt, inZone);
      // Reduce motion: the body falls twice as fast (the wait clock itself runs at the normal rate).
      tree.acc += (next - tree.clock) * (this.reduceMotion() ? 2 : 1);
      tree.clock = next;
      while (tree.acc >= STEP_S && tree.phase === 'falling') {
        tree.acc -= STEP_S;
        tree.body = stepBody(tree.body, tree.segs, tree.inertia, tree.pivot, this.terrain());
        this.sweep(tree);
        if (tree.body.rest) this.land(i, tree);
      }
    }
  }

  /**
   * The damage sweep: every point of the falling rod hurts what it passes, once per creature per tree. The damage
   * scales with the trunk and with the speed of that point. Trees never damage blocks.
   */
  private sweep(tree: FallingTree): void {
    const trunkLen = tree.trunk.length;
    const reach = tree.segs.length ? tree.segs[tree.segs.length - 1].r : 0;
    if (!this.treeDamage()) return;
    for (const seg of tree.segs) {
      const p = worldPointOf(tree.body, tree.inertia, tree.pivot, seg.r);
      if (!tree.hit.has('player') && !this.player.dead) {
        const pl = this.player.position;
        if (p.y >= pl.y - 0.1 && p.y <= pl.y + PLAYER_HEIGHT && Math.hypot(p.x - pl.x, p.z - pl.z) <= PLAYER_RADIUS + ROD_RADIUS) {
          tree.hit.add('player');
          this.player.damage(impactDamage(trunkLen, p.speed), 'felled');
        }
      }
      if (this.victims) {
        for (const m of this.victims.all) {
          if (tree.hit.has(m.id)) continue;
          if (Math.hypot(m.x - tree.pivot.px, m.z - tree.pivot.pz) > reach + 2) continue;
          if (Math.hypot(p.x - m.x, p.z - m.z) > MOB_RADIUS + ROD_RADIUS) continue;
          if (p.y < m.y - 0.1 || p.y > m.y + MOB_HEIGHT) continue;
          tree.hit.add(m.id);
          this.victims.hit(m.id, impactDamage(trunkLen, p.speed), tree.pivot.px, tree.pivot.pz);
        }
      }
    }
  }

  /** The warning is over: the trunk and crown leave the world and become the falling body. */
  private release(tree: FallingTree): void {
    tree.phase = 'falling';
    // The stump is left behind: the base log becomes a stump block (it is not in the way of the fall; see stumpAt).
    const stump = blockByKey(tree.logKey.replace(/_log$/, '_stump'));
    this.world.setVoxel(tree.base.x, tree.base.y, tree.base.z, makeVoxel(stump.id, Facing.North), 'player');
    for (const c of tree.trunk) this.world.setVoxel(c.x, c.y, c.z, AIR, 'player');
    for (const c of tree.leaves) this.world.setVoxel(c.x, c.y, c.z, AIR, 'player');
  }

  /**
   * The tree came to rest: the trunk becomes a fallen log (saved; cut up with the axe), the branch wood of the crown and
   * the leaves drop at its tip. With Auto-buck on the log is cut into pieces at once.
   */
  private land(index: number, tree: FallingTree): void {
    tree.phase = 'landed';
    this.active.splice(index, 1);
    const logDef = blockByKey(tree.logKey);
    const leafDef = blockByKey(leafKeyOf(tree.logKey));
    const pose = poseOf(tree.body, tree.inertia, tree.pivot);
    const log = this.fallen.add({
      logKey: tree.logKey,
      length: tree.trunk.length,
      original: tree.trunk.length,
      ox: pose.ox,
      oy: pose.oy,
      oz: pose.oz,
      dx: tree.pivot.dx,
      dz: tree.pivot.dz,
      theta: pose.theta,
    });
    const tip = fallenTip(log);
    const branch: ItemAmount[] = [];
    for (let i = 0; i < tree.canopyLevels * CANOPY_LOG_BONUS; i++) mergeDrops(branch, rollDrops(logDef, this.rng));
    const leaves: ItemAmount[] = [];
    for (let i = 0; i < tree.leaves.length; i++) mergeDrops(leaves, rollDrops(leafDef, this.rng));
    this.player.dropAll([...branch, ...leaves], tip);
    this.bus.emit('sfx', { name: 'tree_fall', x: tip.x, y: tip.y, z: tip.z });
    this.bus.emit('flag', { flag: FLAG_FELLED_TREE });
    if (this.autoBuck()) {
      for (let guard = 0; guard < 64; guard++) {
        const cut = this.fallen.cut(log.id, this.rng);
        if (!cut) break;
        dropCut(this.player, cut);
        if (cut.gone) break;
      }
    }
  }

  /** Nothing with a block entity within PROTECT_RADIUS (a machine, a crate) is aged. */
  private protectedAt(x: number, z: number): boolean {
    for (const e of this.world.entities()) {
      if (Math.hypot(e.x - x, e.z - z) < PROTECT_RADIUS) return true;
    }
    return false;
  }

  private onFallenEvent(e: FallenEvent): void {
    const t = fallenTip(e.log);
    if (e.kind === 'warn') this.bus.emit('toast', { text: 'A fallen log is rotting away. Cut it up or carry it off before it goes.', kind: 'warn' });
    else this.bus.emit('sfx', { name: 'dig_wood', x: t.x, y: t.y, z: t.z, volume: 0.3 });
  }

  /** The falling trees' own stumps are not an obstacle to their fall. */
  private stumpAt(x: number, y: number, z: number): boolean {
    return this.active.some((t) => t.phase === 'falling' && t.base.x === x && t.base.y === y && t.base.z === z);
  }

  private terrain(): Terrain {
    return { solidAt: (x, y, z) => !this.stumpAt(x, y, z) && this.world.getBlock(x, y, z).solid === true };
  }
}

/** The held axe (not a chainsaw), or null. */
export function heldAxe(held: Slot): { tier: number } | null {
  const tool = held ? itemOrNull(held.item)?.tool ?? null : null;
  if (!tool || tool.kind !== 'axe' || tool.fell) return null;
  return { tier: tool.tier };
}

/** Adds `drops` into `into` (the same as fallenLogs' mergeDrops). */
export const mergeInto = mergeDrops;

/** Where a landed tree's tip is, in world coordinates, for the drops. */
export function tipPoint(tree: FallingTree): { x: number; y: number; z: number } {
  const far = tree.segs.length ? tree.segs[tree.segs.length - 1].r : 0;
  const { x, y, z } = tipOf(tree.body, tree.inertia, tree.pivot, far);
  return { x, y, z };
}

function tipOf(b: BodyState, inertia: RodInertia, pivot: Pivot, r: number): { x: number; y: number; z: number } {
  const p = pointOf(b, inertia, r);
  return toWorld(pivot, p.s, p.h);
}
