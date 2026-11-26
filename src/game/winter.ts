/**
 * Winter prep (docs/api/winter.md): the rivers freeze over in winter and thaw in spring (every world), and on a
 * hard-winter world - chosen at creation, stored in the save, absent (= off) in older saves - the cold bites harder,
 * exposed crops freeze (a glass roof makes a greenhouse), and a first-winter goal track asks for a fuel stockpile, a
 * greenhouse and a survived winter. DOM-free; GameState ticks it with the shared clock.
 */
import type { GameBus } from '../core/context';
import { blockId, fuelOf } from '../core/registry';
import { AIR, WORLD_HEIGHT, voxelId, type IWorld, type Slot } from '../core/types';
import { isCrop } from '../sim/cropRules';
import { DAYS_PER_SEASON, dayOfSeason, seasonOf } from '../sim/seasons';
import { temperatureAt } from '../sim/temperature';
import type { PlayerState } from './playerState';

/** Burn-seconds of fuel (carried plus stored in crates) the first winter asks you to have put by: about sixty logs. */
export const FUEL_TARGET_S = 3000;
/** Crates this close to the player count towards the stockpile. */
export const STOCK_RADIUS = 40;
/** Warmth drain per second for each degree below zero, on a hard-winter world. */
export const WINTER_DRAIN_PER_C = 0.04;
/** Days of the first winter over which the cold builds from WINTER_RAMP_START to full strength. */
export const WINTER_RAMP_DAYS = 3;
export const WINTER_RAMP_START = 0.4;
/** The river freezes from this day of winter on (so the first winter day is still open water). */
export const FREEZE_FROM_DAY = 2;
/** Columns looked at per tick around the player when freezing or thawing, and the radius of that ring of columns. */
export const FREEZE_BUDGET = 24;
export const FREEZE_RADIUS = 40;
const SIDE = FREEZE_RADIUS * 2 + 1;

export interface WinterGoal {
  id: 'stockpile' | 'greenhouse' | 'thaw';
  title: string;
  text: string;
  done: boolean;
}

export interface WinterSnapshot {
  v: 1;
  hard: boolean;
  done: string[];
  told: string[];
}

export interface WinterHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  day(): number;
  isNight(): boolean;
  snowing(x: number, y: number, z: number): boolean;
}

const ICE = blockId('ice');
const WATER = blockId('water');

const stackFuelS = (s: Slot): number => (s ? (fuelOf(s.item)?.burnS ?? 0) * s.count : 0);

export class Winter {
  /** A hard-winter world. Set at creation; a save without this module is not one. */
  hard = false;
  private done = new Set<string>();
  private told = new Set<string>();
  private cursor = 0;
  private scanS = 0;

  constructor(private readonly host: WinterHost) {}

  get season() {
    return seasonOf(this.host.day());
  }

  /** 1-based winter number the clock is in or about to enter (1 = the first winter, days 19-24 with 6-day seasons). */
  private get firstWinter(): boolean {
    return this.host.day() <= DAYS_PER_SEASON * 4;
  }

  /** Burn-seconds of fuel in the pack and in crates near the player. */
  fuelStockS(): number {
    const { player, world } = this.host;
    let total = 0;
    for (const s of player.inventory.slots) total += stackFuelS(s);
    const p = player.position;
    for (const e of world.entities()) {
      if (e.kind !== 'crate') continue;
      if (Math.abs(e.x - p.x) > STOCK_RADIUS || Math.abs(e.z - p.z) > STOCK_RADIUS) continue;
      const slots = (e as { slots?: Slot[] }).slots;
      if (slots) for (const s of slots) total += stackFuelS(s);
    }
    return total;
  }

  /** Whether any planted crop stands under a glass roof with the sky's light reaching it. */
  hasGreenhouse(): boolean {
    const { world } = this.host;
    for (const e of world.entities()) {
      if (!isCrop(e) || !world.isLoaded(e.x, e.z)) continue;
      let glass = false;
      let blocked = false;
      for (let y = e.y + 1; y < WORLD_HEIGHT; y++) {
        const def = world.getBlock(e.x, y, e.z);
        if (def.id === AIR) continue;
        if (def.opaque || def.liquid !== null) { blocked = true; break; }
        if (def.solid) glass = true;
      }
      if (glass && !blocked) return true;
    }
    return false;
  }

  goals(): WinterGoal[] {
    const d = (id: string): boolean => this.done.has(id);
    return [
      { id: 'stockpile', title: 'Stockpile fuel', done: d('stockpile'), text: `Have ${FUEL_TARGET_S} seconds of burning put by, in your pack or in crates near home: about sixty logs. Winter nights are long.` },
      { id: 'greenhouse', title: 'Raise a greenhouse', done: d('greenhouse'), text: 'Exposed crops freeze in winter. Plant on farmland and roof it with glass, so the light gets in and the snow stays out.' },
      { id: 'thaw', title: 'Live to the thaw', done: d('thaw'), text: 'Come through the first winter alive. The rivers freeze and the cold gets harder every night out in the open.' },
    ];
  }

  /** The goal to show a player now (the first undone), or null off a hard-winter world or once all are done. */
  current(): WinterGoal | null {
    return this.hard ? (this.goals().find((g) => !g.done) ?? null) : null;
  }

  /** The goal that takes the HUD plate: the first undone one, but only through the first autumn and winter. */
  activeGoal(): WinterGoal | null {
    const season = seasonOf(this.host.day());
    return this.firstWinter && (season === 'autumn' || season === 'winter') ? this.current() : null;
  }

  /** Extra warmth lost per second out in the cold of a hard winter (0 elsewhere); from the temperature API. */
  coldDrain(exposed: boolean): number {
    if (!this.hard) return 0;
    const { host } = this;
    const p = host.player.position;
    const day = host.day();
    const t = temperatureAt({ x: p.x, y: p.y, z: p.z, day, night: host.isNight(), snowing: host.snowing(p.x, p.y, p.z), exposed });
    if (t >= 0) return 0;
    let ramp = 1;
    if (this.firstWinter && seasonOf(day) === 'winter') ramp = Math.min(1, WINTER_RAMP_START + ((dayOfSeason(day) - 1) / WINTER_RAMP_DAYS) * (1 - WINTER_RAMP_START));
    return -t * WINTER_DRAIN_PER_C * ramp;
  }

  tick(dt: number): void {
    const { host } = this;
    this.freezeStep();
    if (!this.hard) return;
    this.scanS -= dt;
    if (this.scanS > 0) return;
    this.scanS = 2;
    const day = host.day();
    const season = seasonOf(day);
    const say = (key: string, text: string, kind: 'info' | 'warn' | 'good' = 'info'): void => {
      if (this.told.has(key)) return;
      this.told.add(key);
      host.bus.emit('toast', { text, kind });
    };
    if (!this.done.has('stockpile') && this.fuelStockS() >= FUEL_TARGET_S) {
      this.done.add('stockpile');
      host.bus.emit('toast', { text: 'Winter goal done: the fuel is put by.', kind: 'good' });
    }
    if (!this.done.has('greenhouse') && this.hasGreenhouse()) {
      this.done.add('greenhouse');
      host.bus.emit('toast', { text: 'Winter goal done: a crop stands under glass.', kind: 'good' });
    }
    if (!this.firstWinter && !this.done.has('thaw')) {
      this.done.add('thaw');
      say('thawed', 'The first winter is over. The rivers will run again.', 'good');
      return;
    }
    if (!this.firstWinter) return;
    if (season === 'autumn') say('autumn', 'Winter is coming, and it is a hard one. Put fuel by and roof a crop with glass.', 'warn');
    else if (season === 'winter') say('winter', 'Winter. Out in the open the cold bites hard and the rivers freeze: keep a fire close and live off the larder.', 'warn');
  }

  /** Freezes the open water of rivers and lakes from the second day of winter and thaws what this froze in spring. */
  private freezeStep(): void {
    const { host } = this;
    const day = host.day();
    const winter = seasonOf(day) === 'winter';
    const freezing = winter && dayOfSeason(day) >= FREEZE_FROM_DAY;
    const thawing = !winter;
    if (!freezing && !thawing) return;
    const { world, player } = host;
    const ox = Math.floor(player.position.x) - FREEZE_RADIUS;
    const oz = Math.floor(player.position.z) - FREEZE_RADIUS;
    for (let n = 0; n < FREEZE_BUDGET; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % (SIDE * SIDE);
      const x = ox + (i % SIDE);
      const z = oz + Math.floor(i / SIDE);
      if (!world.isLoaded(x, z)) continue;
      const y = world.surfaceY(x, z);
      if (y < 1) continue;
      const id = voxelId(world.getVoxel(x, y, z));
      const below = voxelId(world.getVoxel(x, y - 1, z));
      if (freezing && id === WATER && below !== AIR) world.setVoxel(x, y, z, ICE, 'sim');
      else if (thawing && id === ICE && below === WATER && world.wasEdited?.(x, y, z)) world.setVoxel(x, y, z, WATER, 'sim');
    }
  }

  toJSON(): WinterSnapshot {
    return { v: 1, hard: this.hard, done: [...this.done], told: [...this.told] };
  }

  load(raw: unknown): void {
    const r = raw as Partial<WinterSnapshot> | null;
    if (typeof r !== 'object' || r === null) return;
    this.hard = r.hard === true;
    this.done = new Set(Array.isArray(r.done) ? r.done.filter((v): v is string => typeof v === 'string') : []);
    this.told = new Set(Array.isArray(r.told) ? r.told.filter((v): v is string => typeof v === 'string') : []);
  }
}
