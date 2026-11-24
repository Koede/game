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
import { AIR, type BlockDef, type IWorld, type ItemAmount, type Slot } from '../core/types';
import { exertMining } from './hunger';
import { rollDrops } from './mining';
import type { PlayerState } from './playerState';
import { trunkAbove } from './felling';
import {
  toWorld,
  pointOf,
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
  TREE_MIN_TRUNK,
  advanceWait,
  axePower,
  canopyLevelsOf,
  fallDirection,
  inFallZone,
  treeHealth,
  woodYield,
} from './treeFell';

/** Seconds of creak and shaking before a felled tree starts to go. */
export const WARN_S = 0.9;
/** Most canopy segments a tree's rod carries (the crown is modelled by a few heavy segments). */
const MAX_CANOPY_SEGS = 6;
/** Most leaves gathered into one falling crown. */
const MAX_LEAVES = 600;
const LEAF_REACH = 7;
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

export interface FallingTreesOptions {
  rng?: () => number;
  /** Turn trunk and crown into drops on landing (phase 1); phase 2 keeps the log as an entity instead. */
  dropsOnLanding?: boolean;
}

export class FallingTrees {
  private nextId = 1;
  private readonly active: FallingTree[] = [];
  /** Axe health of standing trees, by base cell key. */
  private readonly health = new Map<string, number>();
  private readonly rng: () => number;

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
    private readonly bus: GameBus,
    options: FallingTreesOptions = {},
  ) {
    this.rng = options.rng ?? Math.random;
  }

  /** The trees on their way down, for drawing. */
  trees(): readonly FallingTree[] {
    return this.active;
  }

  /**
   * An axe blow on a log (interaction.ts, before the normal break). Returns true when the blow is taken by the tree
   * (the log stays until the tree falls), false when the log should break the normal way (no axe, or a tree too small).
   */
  chop(hit: { x: number; y: number; z: number; block: BlockDef }): boolean {
    const held = this.player.heldStack();
    const tool = heldAxe(held);
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
    this.bus.emit('sfx', { name: 'dig_wood', x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
    if (left > 0) {
      this.health.set(k, left);
      return true;
    }
    this.health.delete(k);
    this.start(key, base, tool.tier, trunkLen);
    return true;
  }

  /** Starts a warning for the tree at `base` (its trunk is still standing until the warning ends). */
  private start(logKey: string, base: { x: number; y: number; z: number }, axeTier: number, trunkLen: number): void {
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
    };
    this.active.push(tree);
    this.bus.emit('sfx', { name: 'tree_fall', x: base.x + 0.5, y: base.y + 0.5, z: base.z + 0.5, volume: 0.5 });
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
      tree.acc += next - tree.clock;
      tree.clock = next;
      while (tree.acc >= STEP_S && tree.phase === 'falling') {
        tree.acc -= STEP_S;
        tree.body = stepBody(tree.body, tree.segs, tree.inertia, tree.pivot, this.terrain());
        if (tree.body.rest) this.land(i, tree);
      }
    }
  }

  /** The warning is over: the trunk and crown leave the world and become the falling body. */
  private release(tree: FallingTree): void {
    tree.phase = 'falling';
    this.world.setVoxel(tree.base.x, tree.base.y, tree.base.z, AIR, 'player');
    for (const c of tree.trunk) this.world.setVoxel(c.x, c.y, c.z, AIR, 'player');
    for (const c of tree.leaves) this.world.setVoxel(c.x, c.y, c.z, AIR, 'player');
    this.bus.emit('sfx', { name: 'tree_fall', x: tree.base.x + 0.5, y: tree.base.y + 0.5, z: tree.base.z + 0.5 });
  }

  /** The tree came to rest: its wood and leaves drop where it lies (phase 1; phase 2 keeps the log). */
  private land(index: number, tree: FallingTree): void {
    tree.phase = 'landed';
    this.active.splice(index, 1);
    const logDef = blockByKey(tree.logKey);
    const leafDef = blockByKey(leafKeyOf(tree.logKey));
    const log = treeLogYield(logDef, tree, this.rng);
    const leaves: ItemAmount[] = [];
    for (let i = 0; i < tree.leaves.length; i++) mergeInto(leaves, rollDrops(leafDef, this.rng));
    const tip = tipPoint(tree);
    this.player.dropAll([...log, ...leaves], tip);
    this.bus.emit('flag', { flag: FLAG_FELLED_TREE });
  }

  private terrain(): Terrain {
    return { solidAt: (x, y, z) => this.world.getBlock(x, y, z).solid === true };
  }
}

/** The held axe (not a chainsaw), or null. */
export function heldAxe(held: Slot): { tier: number } | null {
  const tool = held ? itemOrNull(held.item)?.tool ?? null : null;
  if (!tool || tool.kind !== 'axe' || tool.fell) return null;
  return { tier: tool.tier };
}

/** Drops of a felled tree: each trunk log its normal drops, plus the branch logs of the canopy (woodYield). */
export function treeLogYield(logDef: BlockDef, tree: FallingTree, rng: () => number): ItemAmount[] {
  const total = woodYield(tree.trunk.length, tree.canopyLevels);
  const out: ItemAmount[] = [];
  for (let i = 0; i < total; i++) mergeInto(out, rollDrops(logDef, rng));
  return out;
}

/** Adds `drops` into `into`, summing the same items. */
export function mergeInto(into: ItemAmount[], drops: ItemAmount[]): void {
  for (const d of drops) {
    const known = into.find((x) => x.item === d.item);
    if (known) known.count += d.count;
    else into.push({ item: d.item, count: d.count });
  }
}

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
