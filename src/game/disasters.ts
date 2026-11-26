/**
 * Disasters with counterplay (docs/api/disasters.md): boiler overpressure, chimney fires and storms on exposed wiring.
 * Each one has a condition that prevents it and is telegraphed (toast, positioned sound, a 'disaster:warn' event) well
 * before it lands. Numbers: src/content/disasters.ts, by difficulty (peaceful none, normal mild, hard harsh).
 *
 * DOM-free and sim-free: GameState hands it probes of what exists (furnaces, boilers, cables) and the ways to act
 * (put a furnace out, wreck a boiler, blow a cable). That keeps the steam loop and heat zones free to change their
 * internals: only the probes in state.ts know them. State is small (pressure per boiler, soot per furnace, the strike
 * timer) and optional in the save, so older saves load with a calm world.
 */
import type { Difficulty, GameBus } from '../core/context';
import { itemOrNull } from '../core/registry';
import { AIR, WORLD_HEIGHT, type IWorld, type WeatherState } from '../core/types';
import { clamp } from '../core/math';
import {
  CHIMNEY_MAX_STACK, DISASTER_RADIUS, DISASTER_TUNING, FLAMMABLE_BLOCKS, FLUE_CLEAR_BLOCKS, FLUE_FACTOR, ROD_BLOCKS,
  ROD_MIN_HEIGHT, ROD_RANGE, SAFETY_VALVE_BLOCK, VALVE_REACH, WARN_ALARM, WARN_WATCH, type DisasterTuning,
} from '../content/disasters';
import type { PlayerState } from './playerState';
import { LIGHTNING_FROM, openSkyAbove } from './weather';

export type DisasterKind = 'boiler' | 'chimney' | 'storm';
/** 'watch' = a heads-up, 'warning' = act now, 'imminent' = seconds left, 'struck' = it happened, 'averted' = the counterplay held. */
export type DisasterLevel = 'watch' | 'warning' | 'imminent' | 'struck' | 'averted';

/** A furnace as the disasters see it. */
export interface FlueProbe {
  x: number;
  y: number;
  z: number;
  lit: boolean;
  tempC: number;
  /** The fuel item burning, or null. */
  burnItem: string | null;
  loaded: boolean;
  /** The fire goes out (the firebox keeps its fuel). */
  extinguish(): void;
}

/** A boiler as the disasters see it. */
export interface BoilerProbe {
  x: number;
  y: number;
  z: number;
  loaded: boolean;
  /** Steam room fill 0..1: the steam loop may swap this for a real pressure ratio without touching the rest. */
  fill: number;
  /** Temperature of the fire under it. */
  tempC: number;
  /** Vents litres of steam; returns what was vented. */
  vent(litres: number): number;
}

export interface DisastersHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  difficulty(): Difficulty;
  weather(): WeatherState;
  /** Uniform random in [0, 1). */
  rng(): number;
  furnaces(): Iterable<FlueProbe>;
  boilers(): Iterable<BoilerProbe>;
  /** Calls `fn` with every cable block's position. */
  cables(fn: (x: number, y: number, z: number) => void): void;
  /** Whether a safety valve guards the boiler at x,y,z. Default: a `safety_valve` block within reach (the steam loop's block). */
  valveNear?(x: number, y: number, z: number): boolean;
  /** A boiler is wrecked: `radius` 0 takes the boiler block alone, more blows a sphere (and hurts by distance). */
  burst(x: number, y: number, z: number, radius: number): void;
}

export interface DisastersSnapshot {
  v: 1;
  /** Boiler pressure 0..1 by "x,y,z". */
  pressure: Record<string, number>;
  /** Chimney soot 0..1 by "x,y,z". */
  soot: Record<string, number>;
  /** Seconds to the next strike at the wiring. */
  strikeInS: number;
}

/** One live hazard for the HUD, debug and tests. */
export interface DisasterAlert {
  kind: DisasterKind;
  x: number;
  y: number;
  z: number;
  /** 0..1: pressure, soot, or the strike's countdown elapsed. */
  level: number;
}

const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(v)) return out;
  for (const [k, n] of Object.entries(v)) if (/^-?\d+,-?\d+,-?\d+$/.test(k) && typeof n === 'number' && Number.isFinite(n)) out[k] = clamp(n, 0, 1);
  return out;
}

/** Structural check of a saved snapshot; a damaged one is simply not loaded (the world starts calm). */
export function isDisastersSnapshot(v: unknown): v is DisastersSnapshot {
  return isRecord(v) && v.v === 1 && isRecord(v.pressure) && isRecord(v.soot) && typeof v.strikeInS === 'number' && Number.isFinite(v.strikeInS);
}

// ---- pure rules ------------------------------------------------------------------------------------------------

const isBlockKey = (world: IWorld, x: number, y: number, z: number, keys: readonly string[]): boolean => keys.includes(world.getBlock(x, y, z).key);

/** How the smoke leaves a furnace at x,y,z: 'chimney' (a Brick Chimney stack on it), 'open' (clear air above), 'blocked' (a ceiling in the way). */
export function flueOf(world: IWorld, x: number, y: number, z: number): 'chimney' | 'open' | 'blocked' {
  let yy = y + 1;
  let stack = 0;
  while (yy < WORLD_HEIGHT && world.getBlock(x, yy, z).key === 'brick_chimney') {
    stack++;
    yy++;
  }
  let clear = 0;
  while (clear < FLUE_CLEAR_BLOCKS && yy + clear < WORLD_HEIGHT && !world.getBlock(x, yy + clear, z).solid) clear++;
  if (clear < FLUE_CLEAR_BLOCKS && !(yy + clear >= WORLD_HEIGHT)) {
    // A boiler standing on the furnace takes the smoke out through its own stack: no ceiling to worry about.
    return world.getBlock(x, y + 1, z).key === 'boiler' ? 'open' : 'blocked';
  }
  return stack >= 1 ? 'chimney' : 'open';
}

/** How much smoke a fuel lays down: wood and sticks a lot, coal and charcoal very little (1 at 450 C flame, 0.1 from 1000 C up). */
export function fuelSmoke(item: string | null): number {
  const flame = item ? itemOrNull(item)?.fuel?.flameTempC : undefined;
  if (flame === undefined) return 0.5;
  return clamp((1000 - flame) / 500, 0.1, 1.2);
}

/** The furnace a Brick Chimney at x,y,z stands on (down through its stack), or null. */
export function furnaceBelowChimney(world: IWorld, x: number, y: number, z: number): { x: number; y: number; z: number } | null {
  if (world.getBlock(x, y, z).key !== 'brick_chimney') return null;
  let yy = y - 1;
  for (let i = 0; i < CHIMNEY_MAX_STACK && yy >= 0; i++, yy--) {
    const def = world.getBlock(x, yy, z);
    if (def.key === 'brick_chimney') continue;
    return def.key.startsWith('furnace') ? { x, y: yy, z } : null;
  }
  return null;
}

/** Whether a cable at x,y,z is out in the open (no roof of any kind above it). */
export const cableExposed = (world: IWorld, x: number, y: number, z: number): boolean => openSkyAbove(world, x, y + 1, z);

/** A lightning rod within ROD_RANGE: a mast of metal plate blocks at least ROD_MIN_HEIGHT tall whose top stands above the cable, with open sky above it. */
export function rodCovers(world: IWorld, x: number, y: number, z: number): boolean {
  for (let dz = -ROD_RANGE; dz <= ROD_RANGE; dz++) {
    for (let dx = -ROD_RANGE; dx <= ROD_RANGE; dx++) {
      if (dx * dx + dz * dz > ROD_RANGE * ROD_RANGE) continue;
      const px = x + dx;
      const pz = z + dz;
      for (let yy = y; yy < Math.min(WORLD_HEIGHT, y + 24); yy++) {
        if (!isBlockKey(world, px, yy, pz, ROD_BLOCKS)) continue;
        let top = yy;
        while (top + 1 < WORLD_HEIGHT && isBlockKey(world, px, top + 1, pz, ROD_BLOCKS)) top++;
        if (top - yy + 1 >= ROD_MIN_HEIGHT && top > y && openSkyAbove(world, px, top + 1, pz)) return true;
        yy = top;
      }
    }
  }
  return false;
}

/** A safety valve beside a boiler (VALVE_REACH blocks, any direction). */
export function valveNear(world: IWorld, x: number, y: number, z: number): boolean {
  for (let dy = -VALVE_REACH; dy <= VALVE_REACH; dy++) {
    for (let dz = -VALVE_REACH; dz <= VALVE_REACH; dz++) {
      for (let dx = -VALVE_REACH; dx <= VALVE_REACH; dx++) {
        if ((dx || dy || dz) && world.getBlock(x + dx, y + dy, z + dz).key === SAFETY_VALVE_BLOCK) return true;
      }
    }
  }
  return false;
}

// ---- the system ------------------------------------------------------------------------------------------------

interface Pending {
  x: number;
  y: number;
  z: number;
  leftS: number;
  beepS: number;
}

export class Disasters {
  private readonly pressure = new Map<string, number>();
  private readonly soot = new Map<string, number>();
  /** The last warning level told per hazard, so a toast is not repeated every tick. */
  private readonly told = new Map<string, number>();
  private strikeInS = -1;
  private pending: Pending | null = null;
  private stormTold = false;
  private alarmBeepS = 0;

  constructor(private readonly host: DisastersHost) {}

  private get tuning(): DisasterTuning {
    return DISASTER_TUNING[this.host.difficulty()];
  }

  /** Live hazards: boilers building pressure, furnaces sooting up, a strike on its way. */
  alerts(): DisasterAlert[] {
    const out: DisasterAlert[] = [];
    const add = (kind: DisasterKind, k: string, level: number, min: number): void => {
      if (level < min) return;
      const [x, y, z] = k.split(',').map(Number);
      out.push({ kind, x, y, z, level });
    };
    for (const [k, p] of this.pressure) add('boiler', k, p, 0.01);
    for (const [k, s] of this.soot) add('chimney', k, s, WARN_WATCH);
    if (this.pending) out.push({ kind: 'storm', x: this.pending.x, y: this.pending.y, z: this.pending.z, level: 1 - this.pending.leftS / this.tuning.storm.warnS });
    return out;
  }

  pressureAt(x: number, y: number, z: number): number {
    return this.pressure.get(key(x, y, z)) ?? 0;
  }

  sootAt(x: number, y: number, z: number): number {
    return this.soot.get(key(x, y, z)) ?? 0;
  }

  tick(dt: number): void {
    const t = this.tuning;
    if (!t.on) {
      if (this.pressure.size || this.soot.size || this.pending) {
        this.pressure.clear();
        this.soot.clear();
        this.told.clear();
        this.pending = null;
      }
      return;
    }
    this.tickBoilers(dt, t);
    this.tickFurnaces(dt, t);
    this.tickStorm(dt, t);
  }

  // ---- boilers -------------------------------------------------------------------------------------------------

  private tickBoilers(dt: number, t: DisasterTuning): void {
    const b = t.boiler;
    const { world, player } = this.host;
    const seen = new Set<string>();
    let loudest = 0;
    for (const boiler of this.host.boilers()) {
      if (!boiler.loaded) continue;
      const k = key(boiler.x, boiler.y, boiler.z);
      seen.add(k);
      let p = this.pressure.get(k) ?? 0;
      const valve = this.host.valveNear ? this.host.valveNear(boiler.x, boiler.y, boiler.z) : valveNear(world, boiler.x, boiler.y, boiler.z);
      const hot = boiler.tempC >= 200;
      if (boiler.fill >= b.riseFill && hot) p += dt / b.riseS;
      else p -= dt / b.fallS;
      if (valve && p >= b.ventAt) {
        // The counterplay: the valve lifts and bleeds the steam room, so the pressure holds below the red.
        boiler.vent(b.ventLPerS * dt);
        p = Math.min(p, b.ventAt);
        if ((this.told.get(`${k}:vent`) ?? 0) <= 0) {
          this.emitWarn('boiler', 'averted', boiler.x, boiler.y, boiler.z, 'The safety valve lifts and vents steam.', 'steam_hiss');
          this.told.set(`${k}:vent`, 6);
        }
      }
      p = clamp(p, 0, 1);
      this.told.set(`${k}:vent`, (this.told.get(`${k}:vent`) ?? 0) - dt);
      if (p <= 0) this.pressure.delete(k);
      else this.pressure.set(k, p);
      const dist = Math.hypot(boiler.x + 0.5 - player.position.x, boiler.z + 0.5 - player.position.z);
      if (p >= 1) {
        this.burstBoiler(boiler, t, dist);
        this.pressure.delete(k);
        continue;
      }
      if (p >= WARN_ALARM && dist < DISASTER_RADIUS) loudest = Math.max(loudest, p);
      this.warnLevel(k, p, boiler.x, boiler.y, boiler.z, 'boiler', {
        watch: 'The boiler is groaning: steam is piling up. Use it, cool the fire or fit a safety valve.',
        warning: 'BOILER IN THE RED! It will burst: vent the steam or put the fire out now.',
      });
    }
    for (const k of [...this.pressure.keys()]) if (!seen.has(k)) this.pressure.delete(k);
    this.alarmBeepS -= dt;
    if (loudest > 0 && this.alarmBeepS <= 0) {
      this.alarmBeepS = 1.5 - loudest * 0.8;
      this.host.bus.emit('sfx', { name: 'steam_hiss', x: player.position.x, y: player.position.y, z: player.position.z, volume: 0.6 + loudest * 0.4, pitch: 0.8 + loudest * 0.5 });
    }
  }

  private burstBoiler(boiler: BoilerProbe, t: DisasterTuning, dist: number): void {
    const { player } = this.host;
    this.emitWarn('boiler', 'struck', boiler.x, boiler.y, boiler.z, 'The boiler burst!', null);
    if (t.boiler.blastRadius > 0) this.host.burst(boiler.x, boiler.y, boiler.z, t.boiler.blastRadius);
    else {
      this.host.burst(boiler.x, boiler.y, boiler.z, 0);
      if (dist < t.boiler.hurtDist && !player.dead) player.damage(t.boiler.hurtDamage, 'explosion');
    }
  }

  // ---- chimney fires -------------------------------------------------------------------------------------------

  private tickFurnaces(dt: number, t: DisasterTuning): void {
    const c = t.chimney;
    const { world } = this.host;
    const seen = new Set<string>();
    for (const f of this.host.furnaces()) {
      if (!f.loaded) continue;
      const k = key(f.x, f.y, f.z);
      seen.add(k);
      let s = this.soot.get(k) ?? 0;
      if (f.lit) {
        if (f.tempC >= c.burnOffC) s -= c.burnOffPerS * dt;
        else s += c.sootPerS * fuelSmoke(f.burnItem) * FLUE_FACTOR[flueOf(world, f.x, f.y, f.z)] * dt;
      }
      s = clamp(s, 0, 1);
      if (s <= 0) this.soot.delete(k);
      else this.soot.set(k, s);
      if (s >= 1 && f.lit && f.tempC >= c.fireMinC) {
        this.chimneyFire(f, t);
        this.soot.set(k, c.afterFire);
        this.told.delete(k);
        continue;
      }
      this.warnLevel(k, s, f.x, f.y, f.z, 'chimney', {
        watch: 'Smoke is darkening over the furnace: the flue is sooting up. Sweep the chimney with a stick, or burn hotter.',
        warning: 'FLAMES IN THE FLUE! Sweep the chimney with a stick or let the fire die before it catches.',
      });
    }
    for (const k of [...this.soot.keys()]) if (!seen.has(k)) this.soot.delete(k);
  }

  private chimneyFire(f: FlueProbe, t: DisasterTuning): void {
    const { world, player } = this.host;
    const c = t.chimney;
    f.extinguish();
    this.emitWarn('chimney', 'struck', f.x, f.y, f.z, c.spreadBlocks > 0 ? 'Chimney fire! The flames are eating the woodwork.' : 'Chimney fire! The furnace has guttered out; sweep the flue before relighting.', 'explosion');
    let eaten = 0;
    for (let dy = 2; dy >= -1 && eaten < c.spreadBlocks; dy--) {
      for (let dz = -2; dz <= 2 && eaten < c.spreadBlocks; dz++) {
        for (let dx = -2; dx <= 2 && eaten < c.spreadBlocks; dx++) {
          if (!isBlockKey(world, f.x + dx, f.y + dy, f.z + dz, FLAMMABLE_BLOCKS)) continue;
          if (world.setVoxel(f.x + dx, f.y + dy, f.z + dz, AIR, 'sim')) eaten++;
        }
      }
    }
    const d = Math.hypot(f.x + 0.5 - player.position.x, f.y + 0.5 - player.position.y, f.z + 0.5 - player.position.z);
    if (c.hurt > 0 && d < 3 && !player.dead) player.damage(c.hurt, 'burn');
  }

  /** A stick pushed up a Brick Chimney: the soot comes down. Returns whether a furnace was cleaned. */
  sweep(x: number, y: number, z: number): boolean {
    const f = furnaceBelowChimney(this.host.world, x, y, z);
    if (!f) return false;
    const k = key(f.x, f.y, f.z);
    const had = this.soot.get(k) ?? 0;
    this.soot.delete(k);
    this.told.delete(k);
    this.host.bus.emit('toast', { text: had > 0.05 ? 'You sweep the flue clean.' : 'The flue is already clean.', kind: 'good' });
    return true;
  }

  // ---- storms on wiring ----------------------------------------------------------------------------------------

  private tickStorm(dt: number, t: DisasterTuning): void {
    const w = this.host.weather();
    const storming = w.kind === 'storm' && w.intensity >= LIGHTNING_FROM;
    if (!storming) {
      this.pending = null;
      this.stormTold = false;
      this.strikeInS = -1;
      return;
    }
    const s = t.storm;
    if (this.pending) return this.tickPending(dt, t);
    if (this.strikeInS < 0) this.strikeInS = s.minS + this.host.rng() * (s.maxS - s.minS);
    this.strikeInS -= dt;
    if (this.strikeInS > 0) return;
    const target = this.pickCable();
    if (!target) {
      this.strikeInS = 20; // nothing exposed: look again soon, the player may string a wire
      return;
    }
    this.pending = { ...target, leftS: s.warnS, beepS: 0 };
    const rod = rodCovers(this.host.world, target.x, target.y, target.z);
    if (!this.stormTold || !rod) {
      this.stormTold = true;
      this.emitWarn('storm', 'imminent', target.x, target.y, target.z,
        rod ? 'The air crackles: lightning is hunting your wires. The rod should take it.' : 'STATIC ON YOUR WIRING! Lightning is about to strike: cover the cable or raise a metal rod above it.', 'arc_zap');
    }
  }

  private tickPending(dt: number, t: DisasterTuning): void {
    const p = this.pending;
    if (!p) return;
    p.leftS -= dt;
    p.beepS -= dt;
    if (p.beepS <= 0 && p.leftS > 0) {
      p.beepS = 1;
      this.host.bus.emit('sfx', { name: 'arc_zap', x: p.x, y: p.y, z: p.z, volume: 0.5 + 0.5 * (1 - p.leftS / t.storm.warnS) });
    }
    if (p.leftS > 0) return;
    this.pending = null;
    this.strikeInS = t.storm.minS + this.host.rng() * (t.storm.maxS - t.storm.minS);
    this.resolveStrike(p, t);
  }

  private pickCable(): { x: number; y: number; z: number } | null {
    const { world, player } = this.host;
    const exposed: Array<[number, number, number]> = [];
    const px = player.position.x;
    const pz = player.position.z;
    this.host.cables((x, y, z) => {
      if (Math.hypot(x - px, z - pz) > DISASTER_RADIUS) return;
      if (cableExposed(world, x, y, z)) exposed.push([x, y, z]);
    });
    if (exposed.length === 0) return null;
    const [x, y, z] = exposed[Math.floor(this.host.rng() * exposed.length) % exposed.length];
    return { x, y, z };
  }

  private resolveStrike(p: Pending, t: DisasterTuning): void {
    const { world, bus, player } = this.host;
    const flash = (): void => {
      const dx = p.x + 0.5 - player.position.x;
      const dz = p.z + 0.5 - player.position.z;
      bus.emit('weather:lightning', { distance: Math.max(1, Math.hypot(dx, dz)), bearing: Math.atan2(-dx, -dz) });
      bus.emit('sfx', { name: 'thunder', volume: 1 });
    };
    if (world.getBlock(p.x, p.y, p.z).power !== 'cable') {
      this.emitWarn('storm', 'averted', p.x, p.y, p.z, 'The strike found no wire.', null);
      return;
    }
    if (!cableExposed(world, p.x, p.y, p.z)) {
      flash();
      this.emitWarn('storm', 'averted', p.x, p.y, p.z, 'Lightning struck above the covered wiring and did no harm.', null);
      return;
    }
    if (rodCovers(world, p.x, p.y, p.z)) {
      flash();
      this.emitWarn('storm', 'averted', p.x, p.y, p.z, 'Your lightning rod took the strike.', null);
      return;
    }
    flash();
    let blown = 0;
    const queue: Array<[number, number, number]> = [[p.x, p.y, p.z]];
    const seen = new Set<string>([key(p.x, p.y, p.z)]);
    for (let i = 0; i < queue.length && blown < t.storm.cablesBlown; i++) {
      const [x, y, z] = queue[i];
      if (world.setVoxel(x, y, z, AIR, 'sim')) blown++;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
        const nk = key(x + dx, y + dy, z + dz);
        if (seen.has(nk) || world.getBlock(x + dx, y + dy, z + dz).power !== 'cable') continue;
        seen.add(nk);
        queue.push([x + dx, y + dy, z + dz]);
      }
    }
    bus.emit('sfx', { name: 'arc_zap', x: p.x, y: p.y, z: p.z, volume: 1 });
    this.emitWarn('storm', 'struck', p.x, p.y, p.z, blown > 1 ? `Lightning struck your exposed wiring and burned out ${blown} cables!` : 'Lightning struck your exposed wiring and burned out a cable!', null);
    const d = Math.hypot(p.x + 0.5 - player.position.x, p.y + 0.5 - player.position.y, p.z + 0.5 - player.position.z);
    if (t.storm.hurt > 0 && d < 3 && !player.dead) player.damage(t.storm.hurt, 'burn');
  }

  // ---- telegraphs ----------------------------------------------------------------------------------------------

  /** Tells the player once per level crossed (watch, then warning); falling back below a level re-arms it. */
  private warnLevel(k: string, v: number, x: number, y: number, z: number, kind: DisasterKind, text: { watch: string; warning: string }): void {
    const level = v >= WARN_ALARM ? 2 : v >= WARN_WATCH ? 1 : 0;
    const was = this.told.get(k) ?? 0;
    if (level > was) {
      this.told.set(k, level);
      this.emitWarn(kind, level === 2 ? 'warning' : 'watch', x, y, z, level === 2 ? text.warning : text.watch, level === 2 && kind === 'boiler' ? 'steam_hiss' : null);
    } else if (level < was && v < WARN_WATCH * 0.7) this.told.set(k, level);
  }

  private emitWarn(kind: DisasterKind, level: DisasterLevel, x: number, y: number, z: number, text: string, sfx: 'steam_hiss' | 'arc_zap' | 'explosion' | null): void {
    const { bus } = this.host;
    bus.emit('toast', { text, kind: level === 'averted' ? 'good' : level === 'struck' ? 'bad' : 'warn' });
    bus.emit('disaster:warn', { kind, level, x, y, z });
    if (sfx) bus.emit('sfx', { name: sfx, x, y, z });
  }

  // ---- save ----------------------------------------------------------------------------------------------------

  toJSON(): DisastersSnapshot {
    const round = (m: Map<string, number>): Record<string, number> => Object.fromEntries([...m].map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
    return { v: 1, pressure: round(this.pressure), soot: round(this.soot), strikeInS: Math.round(this.strikeInS) };
  }

  load(s: DisastersSnapshot): void {
    this.pressure.clear();
    this.soot.clear();
    this.told.clear();
    for (const [k, v] of Object.entries(readRecord(s.pressure))) if (v > 0) this.pressure.set(k, v);
    for (const [k, v] of Object.entries(readRecord(s.soot))) if (v > 0) this.soot.set(k, v);
    this.strikeInS = clamp(s.strikeInS, -1, 3600);
    this.pending = null;
  }
}

/** Convenience for tests and docs: the key a block must have to be a rod, valve or chimney. */
export const DISASTER_BLOCKS = { rod: ROD_BLOCKS, valve: SAFETY_VALVE_BLOCK, chimney: 'brick_chimney' } as const;
