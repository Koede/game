/**
 * The rules around a felled tree (docs/plans/tree-felling.md): how much an axe blow counts, which way the tree goes,
 * the wait rule for a player under it, what a blow of it does, how much wood it gives and how a fallen log is cut
 * into pieces. Pure; the physics is treeBody.ts and the world side is fallingTrees.ts.
 */

/** Trees with fewer logs than this keep breaking instantly (the chainsaw rule, game/felling.ts). */
export const TREE_MIN_TRUNK = 3;
/** The player under the tree in its first seconds makes it wait (the clock does not advance). */
export const WAIT_S = 0.4;
/** Half-width of the strike zone around the fall line, blocks. */
export const STRIKE_RADIUS = 1.1;
/** Extra log items per canopy level on landing (branch wood). */
export const CANOPY_LOG_BONUS = 1;
/** Blocks of trunk per piece when a fallen log is cut (the last piece takes the remainder). */
export const PIECE_BLOCKS = 3;

/** Axe blows a tree of this trunk height takes (each blow removes `axePower` of it). */
export const treeHealth = (trunk: number): number => 4 + Math.max(0, trunk);

/** How much health one axe blow takes, from the tool's tier (a stone axe, tier 1, hits for 2). */
export const axePower = (tier: number): number => Math.max(1, Math.floor(tier)) + 1;

/**
 * The horizontal fall direction: from the player through the trunk at the final blow (any angle). When they stand on
 * the trunk's column, the facing direction (yaw, 0 = north = -z) decides.
 */
export function fallDirection(playerX: number, playerZ: number, trunkX: number, trunkZ: number, yaw: number): { dx: number; dz: number } {
  const ux = trunkX - playerX;
  const uz = trunkZ - playerZ;
  const len = Math.hypot(ux, uz);
  if (len > 0.05) return { dx: ux / len, dz: uz / len };
  return { dx: -Math.sin(yaw), dz: -Math.cos(yaw) };
}

/** True when (px, pz) is in the strike zone: within STRIKE_RADIUS of the fall line from the pivot out to `reach`. */
export function inFallZone(px: number, pz: number, pivotX: number, pivotZ: number, dx: number, dz: number, reach: number): boolean {
  const rx = px - pivotX;
  const rz = pz - pivotZ;
  const along = Math.max(0, Math.min(reach, rx * dx + rz * dz));
  const cx = rx - dx * along;
  const cz = rz - dz * along;
  return Math.hypot(cx, cz) <= STRIKE_RADIUS;
}

/**
 * The wait rule: the fall clock advances by `dt` unless it is in its first WAIT_S and someone stands in the zone, in
 * which case the tree waits for them to leave. Returns the new clock.
 */
export function advanceWait(clock: number, dt: number, inZone: boolean): number {
  if (clock < WAIT_S && inZone) return clock;
  return clock + dt;
}

/**
 * Damage one tree blow does to a creature or the player: scales with the trunk (a big tree hurts more) and with the
 * speed of the hit point (a fast tree hurts more). At least 1.
 */
export function impactDamage(trunk: number, speed: number): number {
  const base = Math.max(1, trunk) * 0.5;
  const factor = 0.5 + Math.max(0, speed) / 8;
  return Math.max(1, Math.min(12, Math.round(base * factor)));
}

/** Logs a felled tree gives: its trunk length plus CANOPY_LOG_BONUS per canopy level (the branch wood). */
export function woodYield(trunk: number, canopyLevels: number): number {
  return Math.max(0, trunk) + Math.max(0, canopyLevels) * CANOPY_LOG_BONUS;
}

/** Piece count of a fallen log of `len` trunk blocks: one per PIECE_BLOCKS, the remainder being the last piece. */
export function pieceCount(len: number): number {
  return len <= 0 ? 0 : Math.ceil(len / PIECE_BLOCKS);
}

/** One cut off the tip of a fallen log: the blocks it takes and what is left. */
export function cutPiece(len: number): { take: number; remaining: number } {
  const take = Math.min(PIECE_BLOCKS, Math.max(0, len));
  return { take, remaining: len - take };
}

/** The sizes of every piece a log of `len` blocks is cut into, tip first (sums to len). */
export function pieceSizes(len: number): number[] {
  const out: number[] = [];
  let left = Math.max(0, len);
  while (left > 0) {
    const { take, remaining } = cutPiece(left);
    out.push(take);
    left = remaining;
  }
  return out;
}

/** Canopy levels of a tree: the distinct heights of its leaves. */
export function canopyLevelsOf(leafYs: readonly number[]): number {
  return new Set(leafYs).size;
}
