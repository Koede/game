/**
 * One automaton's mind at 20 Hz (spec 19.2): senses (sight within senseRange, HOSTILE_SENSE_BLIND without, forgets
 * after HOSTILE_FORGET_S), daylight wind-down and waking, the telegraphed attack cycle, steering at the player with
 * no path finding (gives up after HOSTILE_GIVE_UP_S blocked and roams), ruin guards on their leash, sentries that
 * only turn, and safe zones it never enters. Sets velocity and facing; the layer runs the physics.
 */
import {
  HOSTILE_FORGET_S,
  HOSTILE_GIVE_UP_S,
  HOSTILE_HOVER_MIN,
  HOSTILE_SENSE_BLIND,
  HOSTILE_WIND_DOWN_S,
  PLAYER_EYE,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  RUIN_GUARD_LEASH,
} from '../core/constants';
import type { HostileSpec } from '../core/types';
import { bodyHeight, halfWidth, yawTowards } from './brain';
import { dashContact, inAttackPosition, muzzleHeight, release, startWindup, windupSound } from './attacks';
import type { HostileCtx } from './hostileCtx';
import { brakeWalker, flyTo, hoverStill, turnTo, walkTo, type StrideResult } from './hostileMove';
import { lineClear, skyOpenAt } from './sight';
import type { Mob } from './types';

/** Senses run this often per automaton (staggered by id). */
export const SENSE_EVERY_S = 0.25;
/** Daylight does not wind down an automaton for this long after the player hit it. */
export const PROVOKED_S = 30;
/** Turn rates (radians per second): chasing, aiming through a melee wind-up, idling. */
const TURN = 6;
const WINDUP_TURN = 2.5;
const IDLE_TURN = 1.5;
/** Roaming: share of the walking speed, how far targets lie, how long a give-up roam lasts. */
const ROAM_SPEED = 0.5;
const ROAM_RADIUS = 6;
const GIVE_UP_ROAM_MIN_S = 3;
const GIVE_UP_ROAM_MAX_S = 6;
/** Glow eases at this rate (1/s); a wound-down automaton glows at most this little. */
const GLOW_RATE = 4;
/** Guards walk home once this far outside their leash, and stop returning this far inside it. */
const RETURN_INSIDE = RUIN_GUARD_LEASH * 0.5;

const spec = (m: Mob): HostileSpec => m.spec.hostile!;

/** Wakes an automaton (night fell, it noticed the player, or it was hit): 'hostile:woke' + sound. */
export function wake(ctx: HostileCtx, m: Mob): void {
  const h = m.hostile!;
  if (h.mode !== 'dormant' && h.windDownS === 0 && h.aware) return;
  const wasDormant = h.mode === 'dormant';
  h.windDownS = 0;
  if (wasDormant) h.mode = 'roam';
  ctx.bus.emit('hostile:woke', { id: m.id, species: m.spec.key, x: m.x, y: m.y, z: m.z });
  ctx.bus.emit('sfx', { name: 'automaton_wake', x: m.x, y: m.y + bodyHeight(m) * 0.6, z: m.z });
}

/** The player is outside where this automaton may hunt them (guards by their ruin; turrets by day too). */
function outOfBounds(ctx: HostileCtx, m: Mob): boolean {
  const h = m.hostile!;
  if (h.role === 'natural' || (h.role === 'turret' && !ctx.daylight)) return false;
  const p = ctx.player;
  return Math.hypot(p.x - h.homeX, p.z - h.homeZ) > RUIN_GUARD_LEASH + spec(m).range;
}

/** A look at the player: line of sight within senseRange, or anything within HOSTILE_SENSE_BLIND. */
function sense(ctx: HostileCtx, m: Mob): void {
  const h = m.hostile!;
  const s = spec(m);
  const p = ctx.player;
  const ey = m.y + muzzleHeight(m);
  const d = Math.hypot(p.x - m.x, p.y + PLAYER_HEIGHT / 2 - ey, p.z - m.z);
  h.sees = d <= s.senseRange && lineClear(ctx.world, m.x, ey, m.z, p.x, p.y + PLAYER_EYE, p.z, 'sight');
  h.skyOpen = skyOpenAt(ctx.world, m.x, m.y + bodyHeight(m), m.z);
  const noticed = (h.sees || d <= HOSTILE_SENSE_BLIND) && !outOfBounds(ctx, m);
  if (noticed) {
    if (!h.aware) {
      wake(ctx, m);
      h.aware = true;
    }
    h.unseenS = 0;
    h.lastX = p.x;
    h.lastY = p.y;
    h.lastZ = p.z;
    return;
  }
  h.unseenS += SENSE_EVERY_S;
  if (h.aware && h.unseenS >= HOSTILE_FORGET_S) h.aware = false;
}

/** One tick of behaviour for a living, simulated automaton. */
export function thinkHostile(ctx: HostileCtx, m: Mob, dt: number): void {
  const h = m.hostile!;
  const s = spec(m);
  h.periodS += dt;
  if (h.stunS > 0) h.stunS = Math.max(0, h.stunS - dt);
  if (h.provokedS > 0) h.provokedS = Math.max(0, h.provokedS - dt);
  h.pglow = h.glow;
  const glowTarget = h.mode === 'dormant' ? 0 : 1 - (0.85 * h.windDownS) / HOSTILE_WIND_DOWN_S;
  h.glow += (glowTarget - h.glow) * Math.min(1, GLOW_RATE * dt);

  if (h.mode === 'dormant') {
    if (ctx.night) wake(ctx, m);
    else {
      brakeWalker(m, dt);
      return;
    }
  }

  h.senseS -= dt;
  if (h.senseS <= 0) {
    h.senseS += SENSE_EVERY_S;
    sense(ctx, m);
  }

  // Daylight under open sky: stop, dim, go dormant (ruin guards and turrets keep watch).
  if (ctx.daylight && h.role === 'natural' && h.provokedS <= 0 && h.skyOpen) {
    if (h.mode === 'windup' || h.mode === 'dash') h.mode = 'chase';
    h.windDownS = Math.min(HOSTILE_WIND_DOWN_S, h.windDownS + dt);
    stop(ctx, m, dt);
    if (h.windDownS >= HOSTILE_WIND_DOWN_S) {
      h.mode = 'dormant';
      h.aware = false;
      ctx.bus.emit('hostile:dormant', { id: m.id, species: m.spec.key, x: m.x, y: m.y, z: m.z });
    }
    return;
  }
  h.windDownS = 0;

  if (h.stunS > 0) {
    stop(ctx, m, dt);
    return;
  }

  // Caught inside a safe zone (a furnace was lit, a beacon powered): walk out, never attack from inside.
  if (!s.stationary && ctx.safe(m.x, m.y + bodyHeight(m) * 0.5, m.z)) {
    retreat(ctx, m, dt);
    return;
  }
  if (h.mode === 'retreat') h.mode = 'roam';

  if (h.mode === 'windup') {
    h.windS += dt;
    stop(ctx, m, dt);
    const p = ctx.player;
    const rate = s.attack === 'melee' ? WINDUP_TURN : s.attack === 'slam' ? 0 : TURN;
    if (rate > 0) turnTo(m, yawTowards(p.x - m.x, p.z - m.z), rate, dt);
    windupSound(ctx, m, s);
    if (h.windS >= s.windupS) release(ctx, m, s);
    return;
  }
  if (h.mode === 'dash') {
    dash(ctx, m, s, dt);
    return;
  }

  if (h.role === 'guard' && guardHome(ctx, m, dt)) return;

  if (h.aware) {
    if (h.periodS >= s.cooldownS && !ctx.playerSafe && h.unseenS === 0 && inAttackPosition(ctx, m, s, h.sees)) {
      startWindup(ctx, m, s);
      stop(ctx, m, dt);
      return;
    }
    if (h.roamS > 0) {
      h.roamS = Math.max(0, h.roamS - dt);
      roam(ctx, m, dt);
      return;
    }
    h.mode = 'chase';
    chase(ctx, m, s, dt);
    return;
  }
  h.mode = 'roam';
  h.roamS = 0;
  roam(ctx, m, dt);
}

/** Stands still: walkers brake, flyers hover, everything keeps its facing. */
function stop(ctx: HostileCtx, m: Mob, dt: number): void {
  if (spec(m).flying) hoverStill(ctx.world, m, m.hostile!.hover, dt);
  else brakeWalker(m, dt);
}

/** Steps towards a point the way this automaton moves (stationary ones only turn). */
function go(ctx: HostileCtx, m: Mob, tx: number, tz: number, speed: number, stop: number, turn: number, dt: number): StrideResult {
  const s = spec(m);
  if (s.stationary) {
    turnTo(m, yawTowards(tx - m.x, tz - m.z), turn, dt);
    return 'arrived';
  }
  if (s.flying) return flyTo(ctx.world, ctx.safe, m, tx, tz, speed, stop, m.hostile!.hover, turn, dt);
  return walkTo(ctx.world, ctx.safe, m, tx, tz, speed, stop, turn, dt);
}

/** How close a type likes to get before it can attack (centre to centre, blocks). */
function closeEnough(m: Mob, s: HostileSpec): number {
  switch (s.attack) {
    case 'melee':
      return halfWidth(m) + PLAYER_WIDTH / 2 + s.range * 0.5;
    case 'slam':
      return s.range * 0.5;
    case 'dash':
      return s.range * 0.6;
    case 'zap':
      return s.range * 0.6;
    case 'bolt':
      return s.range;
  }
}

function chase(ctx: HostileCtx, m: Mob, s: HostileSpec, dt: number): void {
  const h = m.hostile!;
  const fresh = h.unseenS === 0;
  const tx = fresh ? ctx.player.x : h.lastX;
  const tz = fresh ? ctx.player.z : h.lastZ;
  // Where the player was last sensed is a place to search, not someone to stand off from.
  const r = go(ctx, m, tx, tz, m.spec.speed, fresh ? closeEnough(m, s) : 0.5, TURN, dt);
  if (r === 'unsafe') {
    // At the edge of a warm zone: halt and turn away for a while.
    turnAway(ctx, m, tx, tz);
    return;
  }
  if (!fresh && r === 'arrived') {
    h.aware = h.unseenS < HOSTILE_FORGET_S;
    return;
  }
  h.blockedS = r === 'blocked' ? h.blockedS + dt : Math.max(0, h.blockedS - dt * 0.5);
  if (h.blockedS >= HOSTILE_GIVE_UP_S) giveUp(ctx, m, tx, tz);
}

/** Blocked too long (no path finding): roams a few seconds before trying again. */
function giveUp(ctx: HostileCtx, m: Mob, fromX: number, fromZ: number): void {
  const h = m.hostile!;
  h.blockedS = 0;
  h.roamS = GIVE_UP_ROAM_MIN_S + ctx.rng() * (GIVE_UP_ROAM_MAX_S - GIVE_UP_ROAM_MIN_S);
  h.mode = 'roam';
  pickRoam(ctx, m, m.x * 2 - fromX, m.z * 2 - fromZ, true);
}

function turnAway(ctx: HostileCtx, m: Mob, fromX: number, fromZ: number): void {
  const h = m.hostile!;
  h.blockedS = 0;
  h.roamS = GIVE_UP_ROAM_MIN_S + ctx.rng() * 2;
  h.mode = 'roam';
  pickRoam(ctx, m, m.x * 2 - fromX, m.z * 2 - fromZ, true);
}

/** A roam target around (cx, cz), or (when `away`) in that direction from here. */
function pickRoam(ctx: HostileCtx, m: Mob, cx: number, cz: number, away: boolean): void {
  if (away) {
    const d = Math.hypot(cx - m.x, cz - m.z) || 1;
    const a = Math.atan2(cz - m.z, cx - m.x) + (ctx.rng() - 0.5) * 1.2;
    const r = Math.min(ROAM_RADIUS, 3 + d);
    m.tx = m.x + Math.cos(a) * r;
    m.tz = m.z + Math.sin(a) * r;
  } else {
    const a = ctx.rng() * Math.PI * 2;
    const r = 2 + ctx.rng() * (ROAM_RADIUS - 2);
    m.tx = cx + Math.cos(a) * r;
    m.tz = cz + Math.sin(a) * r;
  }
  m.hasTarget = true;
  m.stateS = 4 + ctx.rng() * 4;
}

/** Wandering without a target: short walks around home (guards) or where it stands, pauses between them. */
function roam(ctx: HostileCtx, m: Mob, dt: number): void {
  const h = m.hostile!;
  const s = spec(m);
  m.stateS -= dt;
  if (s.stationary) {
    // A turret looks around slowly.
    if (m.stateS <= 0) {
      m.lookYaw = m.yaw + (ctx.rng() - 0.5) * 2.5;
      m.stateS = 3 + ctx.rng() * 3;
    }
    if (!Number.isNaN(m.lookYaw)) turnTo(m, m.lookYaw, IDLE_TURN * 0.4, dt);
    return;
  }
  if (m.hasTarget) {
    const r = go(ctx, m, m.tx, m.tz, m.spec.speed * ROAM_SPEED, 0.6, IDLE_TURN * 2, dt);
    if (r !== 'moving' || m.stateS <= 0) {
      m.hasTarget = false;
      m.stateS = 1.5 + ctx.rng() * 3;
    }
    return;
  }
  stop(ctx, m, dt);
  if (m.stateS > 0) return;
  const home = h.role === 'guard';
  pickRoam(ctx, m, home ? h.homeX : m.x, home ? h.homeZ : m.z, false);
}

/** Ruin guards stay within RUIN_GUARD_LEASH of their ruin: true while walking back. */
function guardHome(ctx: HostileCtx, m: Mob, dt: number): boolean {
  const h = m.hostile!;
  const away = Math.hypot(m.x - h.homeX, m.z - h.homeZ);
  if (h.mode !== 'return' && away <= RUIN_GUARD_LEASH) return false;
  if (h.mode === 'return' && away <= RETURN_INSIDE) {
    h.mode = 'roam';
    return false;
  }
  h.mode = 'return';
  const r = go(ctx, m, h.homeX, h.homeZ, m.spec.speed, 0.5, TURN, dt);
  h.blockedS = r === 'blocked' ? h.blockedS + dt : 0;
  if (r === 'arrived' || h.blockedS >= HOSTILE_GIVE_UP_S) {
    h.blockedS = 0;
    h.mode = 'roam';
  }
  return true;
}

/** The hound's charge: straight on at dashSpeed until it has run its course, hit a wall or an edge. */
function dash(ctx: HostileCtx, m: Mob, s: HostileSpec, dt: number): void {
  const h = m.hostile!;
  dashContact(ctx, m, s);
  const speed = s.dashSpeed ?? m.spec.speed;
  h.dashLeft -= speed * dt;
  const r = walkTo(ctx.world, ctx.safe, m, m.x + h.dashX * (h.dashLeft + 2), m.z + h.dashZ * (h.dashLeft + 2), speed, 0, TURN * 3, dt);
  if (h.dashLeft <= 0 || r === 'blocked' || r === 'unsafe') {
    h.mode = 'chase';
    brakeWalker(m, dt);
  }
}

const OUT_DIRS = 8;

/** Inside a safe zone: walk towards the nearest direction that leaves it (probed 4 blocks out). */
function retreat(ctx: HostileCtx, m: Mob, dt: number): void {
  const h = m.hostile!;
  const midY = m.y + bodyHeight(m) * 0.5;
  if (h.mode !== 'retreat' || !m.hasTarget || ctx.safe(m.tx, midY, m.tz)) {
    h.mode = 'retreat';
    m.hasTarget = false;
    const base = ctx.rng() * Math.PI * 2;
    for (let reach = 4; reach <= 16 && !m.hasTarget; reach *= 2) {
      for (let i = 0; i < OUT_DIRS; i++) {
        const a = base + (i * Math.PI * 2) / OUT_DIRS;
        const x = m.x + Math.cos(a) * reach;
        const z = m.z + Math.sin(a) * reach;
        if (ctx.safe(x, midY, z)) continue;
        m.tx = x;
        m.tz = z;
        m.hasTarget = true;
        break;
      }
    }
  }
  if (!m.hasTarget) {
    stop(ctx, m, dt);
    return;
  }
  // Walking out of the zone: the halt-at-the-edge rule does not apply (it already is inside).
  const s = spec(m);
  if (s.flying) flyTo(ctx.world, () => false, m, m.tx, m.tz, m.spec.speed, 0.5, h.hover || HOSTILE_HOVER_MIN, TURN, dt);
  else walkTo(ctx.world, () => false, m, m.tx, m.tz, m.spec.speed, 0.5, TURN, dt);
}
