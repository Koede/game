/**
 * Survival rules (spec 3.4): warmth, the Well-Warmed buff, breath, contact damage, radiation, regeneration and
 * where the player comes back after dying. Hunger (spec 12.1) lives in ./hunger and is ticked from here. Falls are measured by the player physics, which reports them
 * through `applyFall`.
 *
 * Heat and radiation sources are collected at most twice per second (block entities with a warm voxel plus a
 * small scan around the player); every tick only measures distances to that short cached list.
 */
import {
  COLD_DAMAGE_INTERVAL_S,
  FURNACE_BUFF_C,
  FURNACE_HOT_C,
  MAX_AIR_S,
  MAX_HEALTH,
  MAX_WARMTH,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SAFE_FALL,
  WARMTH_DRAIN_FROST_DAY,
  WARMTH_DRAIN_FROST_NIGHT,
  WARMTH_DRAIN_NIGHT,
  WARMTH_DRAIN_WATER,
  WARMTH_DRAIN_WET,
  WARMTH_GAIN_DAY,
  WARMTH_GAIN_HEAT,
  WELL_WARMED_AFTER_S,
  WELL_WARMED_DURATION_S,
} from '../core/constants';
import type { DamageCause } from '../core/gameEvents';
import { clamp, type Vec3 } from '../core/math';
import { bestArmour } from '../core/hostile';
import { blockOf, voxelWarmth } from '../core/registry';
import { heldWarms } from './heldWarmth';
import { peakDrain } from './peaks';
import { AIR, WORLD_HEIGHT, type BiomeKey, type IWorld, type WeatherState } from '../core/types';
import { isWet } from '../core/weather';
import type { GameClock } from './clock';
import { ColdWatch, FIRST_DAY_WARMTH_FLOOR, type ColdCause } from './cold';
import { coolCarried } from './drink';
import { Hunger } from './hunger';
import { magnetCollector } from './magnet';
import type { BlockPos, PlayerState } from './playerState';
import { openSkyAbove } from './weather';

export type WarmthTrend = 'warming' | 'cooling' | 'steady';
export type BiomeLookup = (x: number, z: number) => BiomeKey;

export interface SurvivalSnapshot {
  nearFurnaceS: number;
  coldS: number;
  drownAcc: number;
  contactAcc: number;
  radiationS: number;
  regenS: number;
  /** Starvation timer (spec 12.1). Missing in saves made before hunger existed. */
  starveS?: number;
}

/** Seconds between rescans of heat and radiation sources. */
export const SCAN_INTERVAL_S = 0.5;
/** Radiating blocks further than this many blocks away add nothing to the dose. */
export const RADIATION_RANGE = 4;
/** Doses above this hurt. */
export const RADIATION_SAFE_DOSE = 1;
export const RADIATION_DAMAGE_INTERVAL_S = 2;
export const SHIELD_SUIT_FACTOR = 0.1;
export const WELL_WARMED_DRAIN_FACTOR = 0.5;
export const REGEN_INTERVAL_S = 4;
export const REGEN_QUIET_S = 8;
export const REGEN_MIN_WARMTH = 50;
/** Breath regained per second with the head above water (a full breath in three seconds). */
export const AIR_REFILL_PER_S = MAX_AIR_S / 3;

/** Non-entity warm blocks (torch 2, lava 4) are looked for this far around the player; one extra block of
 *  margin covers the distance walked between two scans. */
const LOCAL_SCAN = 5;

interface HeatSource {
  x: number;
  y: number;
  z: number;
  radius: number;
  /** A furnace hot enough to grant Well-Warmed. */
  buff: boolean;
}

interface RadiationSource {
  x: number;
  y: number;
  z: number;
  strength: number;
}

/**
 * Damage of landing after falling `distance` blocks: 1 per whole block beyond SAFE_FALL. `allowance` is extra safe
 * height (the Spring drink's boosted jumps, see `springFallAllowance`).
 */
export const fallDamage = (distance: number, allowance = 0): number => Math.max(0, Math.floor(distance - SAFE_FALL - allowance));

const passable = (world: IWorld, x: number, y: number, z: number): boolean => {
  const def = world.getBlock(x, y, z);
  return !def.solid && def.liquid === null && def.contactDamage === 0;
};

/**
 * A place to stand next to a block (feet position): a free two-high cell on solid ground beside it, else the
 * top of the block itself.
 */
export function findStandingSpot(world: IWorld, pos: BlockPos): Vec3 {
  for (const dy of [0, 1, -1]) {
    for (let ring = 1; ring <= 2; ring++) {
      for (let dz = -ring; dz <= ring; dz++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const x = pos.x + dx;
          const y = pos.y + dy;
          const z = pos.z + dz;
          if (world.getBlock(x, y - 1, z).solid && passable(world, x, y, z) && passable(world, x, y + 1, z)) {
            return { x: x + 0.5, y, z: z + 0.5 };
          }
        }
      }
    }
  }
  return { x: pos.x + 0.5, y: pos.y + 1, z: pos.z + 0.5 };
}

export class Survival {
  /** The hunger rules (spec 12.1), ticked with everything else. */
  readonly hunger: Hunger;
  private readonly heat: HeatSource[] = [];
  private readonly radiation: RadiationSource[] = [];
  private scanIn = 0;
  private frost = false;
  /** Warmth drain multiplier of the best coat carried (ItemSpec.armour; 1 without one). */
  private coatMult = 1;
  private suit = false;
  private nearFurnaceS = 0;
  private coldS = 0;
  private drownAcc = 0;
  private contactAcc = 0;
  private radiationS = 0;
  private regenS = 0;
  private rate = 0;
  private heated = false;
  private dose = 0;
  /** Open sky above the player's head, as of the last scan. */
  private exposed = false;
  private soaked = false;
  private cause: ColdCause | null = null;
  private readonly coldWatch: ColdWatch;
  /**
   * The world's weather (src/game/weather.ts), read every tick: rain or snow on a player under open sky drains
   * WARMTH_DRAIN_WET more warmth per second (spec 15). Null = no weather.
   */
  weather: WeatherState | null = null;
  /** Extra warmth lost per second in the open from a hard winter (src/game/winter.ts); null = none. */
  winterDrain: ((exposed: boolean) => number) | null = null;

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
    private readonly clock: GameClock,
    private readonly biomeAt: BiomeLookup,
  ) {
    this.hunger = new Hunger(player);
    this.coldWatch = new ColdWatch(player.bus);
  }

  /** Whether warmth is currently going up, down or nowhere (HUD arrow). */
  get trend(): WarmthTrend {
    if (this.rate > 0) return this.player.warmth >= MAX_WARMTH ? 'steady' : 'warming';
    return this.rate < 0 ? 'cooling' : 'steady';
  }

  /** Warmth change per second as of the last tick. */
  get warmthRate(): number {
    return this.rate;
  }

  /** The player is inside the warm radius of a furnace, torch, lava or heater. */
  get inHeat(): boolean {
    return this.heated;
  }

  /** Radiation dose at the player after the shield suit, as of the last tick. Above RADIATION_SAFE_DOSE it hurts. */
  get radiationDose(): number {
    return this.dose;
  }

  /** Rain or snow is soaking the player (wet weather and no roof overhead) as of the last tick. */
  get wet(): boolean {
    return this.soaked;
  }

  /** The biggest drain on warmth as of the last tick (null while warmth is not being drained). */
  get coldCause(): ColdCause | null {
    return this.cause;
  }

  /** Seconds of Well-Warmed left (0 = not active). */
  get buffTimeLeftS(): number {
    return this.player.buffs.wellWarmedS;
  }

  /** 0..1: how far the player is towards earning Well-Warmed by standing near a hot furnace. */
  get warmUpProgress(): number {
    return clamp(this.nearFurnaceS / WELL_WARMED_AFTER_S, 0, 1);
  }

  tick(dt: number): void {
    const player = this.player;
    if (dt > 0) {
      const pulls = player.collectors.tick(dt);
      const magnet = magnetCollector(player.assist.magnet);
      player.ground.tick(dt, this.world, player, magnet ? [...pulls, magnet] : pulls);
    }
    if (player.dead || dt <= 0) return;
    this.scanIn -= dt;
    if (this.scanIn <= 0) {
      this.scanIn = SCAN_INTERVAL_S;
      this.scan();
    }
    player.addQuietTime(dt);
    this.hunger.tick(dt);
    coolCarried(this.player, dt);
    player.combat.tick(dt);
    if (player.dead) return;

    const px = player.position.x;
    const py = player.position.y + PLAYER_HEIGHT / 2;
    const pz = player.position.z;
    let heated = false;
    let nearBuff = false;
    for (const s of this.heat) {
      const dx = s.x - px;
      const dy = s.y - py;
      const dz = s.z - pz;
      if (dx * dx + dy * dy + dz * dz > s.radius * s.radius) continue;
      heated = true;
      if (s.buff) nearBuff = true;
    }
    // A torch or a boiling vessel in the hand warms like a small fire (heldWarmth.ts).
    if (heldWarms(player.heldStack())) heated = true;
    this.heated = heated;

    this.tickBuff(dt, nearBuff);
    this.tickWarmth(dt, heated);
    this.tickAir(dt);
    this.tickContact(dt);
    this.tickRadiation(dt, px, py, pz);
    this.tickRegen(dt);
  }

  /** Applies the damage of landing after a fall of `distance` blocks (landing in water is free). Returns the damage dealt. */
  applyFall(distance: number): number {
    const amount = this.player.inWater ? 0 : fallDamage(distance);
    if (amount > 0) this.player.damage(amount, 'fall');
    return amount;
  }

  /** True when the player's home furnace still stands and is hot. */
  homeIsHot(): boolean {
    const home = this.player.home;
    const entity = home ? this.world.getEntity(home.x, home.y, home.z) : undefined;
    return entity !== undefined && entity.kind === 'furnace' && typeof entity.tempC === 'number' && entity.tempC >= FURNACE_HOT_C;
  }

  /**
   * Brings a dead player back beside the home furnace (at the world spawn when there is none any more),
   * keeping the inventory: full health when the furnace is hot, half otherwise.
   */
  respawn(): void {
    const player = this.player;
    const home = player.home;
    const furnace = home ? this.world.getEntity(home.x, home.y, home.z) : undefined;
    const at = home && furnace?.kind === 'furnace' ? findStandingSpot(this.world, home) : player.spawn;
    this.nearFurnaceS = this.coldS = this.drownAcc = this.contactAcc = this.radiationS = this.regenS = 0;
    this.scanIn = 0;
    this.hunger.reset();
    this.coldWatch.reset();
    player.respawn(this.homeIsHot(), at);
  }

  toJSON(): SurvivalSnapshot {
    return {
      nearFurnaceS: this.nearFurnaceS,
      coldS: this.coldS,
      drownAcc: this.drownAcc,
      contactAcc: this.contactAcc,
      radiationS: this.radiationS,
      regenS: this.regenS,
      starveS: this.hunger.toJSON().starveS,
    };
  }

  load(s: SurvivalSnapshot): void {
    this.nearFurnaceS = s.nearFurnaceS;
    this.coldS = s.coldS;
    this.drownAcc = s.drownAcc;
    this.contactAcc = s.contactAcc;
    this.radiationS = s.radiationS;
    this.regenS = s.regenS;
    this.hunger.load({ starveS: s.starveS });
    this.scanIn = 0;
  }

  private scan(): void {
    const { world, player } = this;
    const heat = this.heat;
    const radiation = this.radiation;
    heat.length = 0;
    radiation.length = 0;
    for (const e of world.entities()) {
      const radius = voxelWarmth(world.getVoxel(e.x, e.y, e.z));
      if (radius <= 0) continue;
      const buff = e.kind === 'furnace' && typeof e.tempC === 'number' && e.tempC >= FURNACE_BUFF_C;
      heat.push({ x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5, radius, buff });
    }
    const cx = Math.floor(player.position.x);
    const cy = Math.floor(player.position.y + PLAYER_HEIGHT / 2);
    const cz = Math.floor(player.position.z);
    const y0 = Math.max(0, cy - LOCAL_SCAN);
    const y1 = Math.min(WORLD_HEIGHT - 1, cy + LOCAL_SCAN);
    for (let y = y0; y <= y1; y++) {
      for (let z = cz - LOCAL_SCAN; z <= cz + LOCAL_SCAN; z++) {
        for (let x = cx - LOCAL_SCAN; x <= cx + LOCAL_SCAN; x++) {
          const v = world.getVoxel(x, y, z);
          if (v === AIR) continue;
          const def = blockOf(v);
          if (def.radiation > 0) radiation.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5, strength: def.radiation });
          // Machines were already collected through their block entities.
          if (def.machine !== null) continue;
          const radius = voxelWarmth(v);
          if (radius > 0) heat.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5, radius, buff: false });
        }
      }
    }
    this.frost = this.biomeAt(cx, cz) === 'frostfell';
    this.exposed = openSkyAbove(world, player.position.x, player.position.y + PLAYER_HEIGHT, player.position.z);
    this.coatMult = bestArmour(player.inventory.slots).warmthDrainMult;
    this.suit = player.inventory.has('shield_suit');
  }

  private tickBuff(dt: number, nearBuff: boolean): void {
    const { player } = this;
    const buffs = player.buffs;
    if (buffs.wellWarmedS > 0) buffs.wellWarmedS = Math.max(0, buffs.wellWarmedS - dt);
    if (!nearBuff) {
      this.nearFurnaceS = 0;
      return;
    }
    this.nearFurnaceS = Math.min(WELL_WARMED_AFTER_S, this.nearFurnaceS + dt);
    if (this.nearFurnaceS < WELL_WARMED_AFTER_S) return;
    const fresh = buffs.wellWarmedS <= 0;
    // Staying by the fire keeps the buff topped up without announcing it again.
    buffs.wellWarmedS = WELL_WARMED_DURATION_S;
    if (!fresh) return;
    player.bus.emit('buff:gained', { buff: 'well_warmed', durationS: WELL_WARMED_DURATION_S });
    player.bus.emit('flag', { flag: 'well_warmed' });
    player.bus.emit('toast', { text: 'Well-Warmed: you mine faster and the cold bites half as hard', kind: 'good' });
  }

  private tickWarmth(dt: number, heated: boolean): void {
    const { player } = this;
    const w = this.weather;
    this.soaked = w !== null && this.exposed && isWet(w.precipitation, w.intensity);
    let rate: number;
    let cause: ColdCause | null = null;
    if (heated) rate = WARMTH_GAIN_HEAT;
    else {
      const night = this.clock.isNight;
      // Each drain on its own; the biggest names the cause (ties go to the one the player can act on first).
      const water = player.inWater ? WARMTH_DRAIN_WATER : 0;
      const wet = this.soaked ? WARMTH_DRAIN_WET : 0;
      const frost = this.frost ? (night ? WARMTH_DRAIN_FROST_NIGHT : WARMTH_DRAIN_FROST_DAY) : 0;
      const dark = night ? WARMTH_DRAIN_NIGHT : 0;
      const peak = peakDrain(player.position.y);
      const winter = this.winterDrain ? this.winterDrain(this.exposed) : 0;
      let drain = water + wet + frost + dark + peak + winter;
      if (drain > 0) {
        const top = Math.max(water, wet, frost, dark, peak, winter);
        cause = water === top ? 'water' : wet === top ? (w?.precipitation === 'snow' ? 'snow' : 'rain') : frost === top || peak === top || winter === top ? 'frost' : 'night';
      }
      drain *= this.coatMult;
      if (player.wellWarmed) drain *= WELL_WARMED_DRAIN_FACTOR;
      drain *= player.buffs.warmthDrainMult;
      rate = drain > 0 ? -drain : WARMTH_GAIN_DAY;
    }
    this.cause = cause;
    let next = clamp(player.warmth + rate * dt, 0, MAX_WARMTH);
    if (rate < 0 && this.clock.day === 1 && !player.inWater) {
      // The first day's safety margin: weather and night stop at the floor (cold water does not).
      const floor = Math.min(player.warmth, FIRST_DAY_WARMTH_FLOOR);
      if (next < floor) {
        next = floor;
        rate = 0;
      }
    }
    this.rate = rate;
    player.warmth = next;
    this.coldWatch.update(next, cause);
    if (player.warmth > 0) {
      this.coldS = 0;
      return;
    }
    this.coldS += dt;
    if (this.coldS >= COLD_DAMAGE_INTERVAL_S) {
      this.coldS -= COLD_DAMAGE_INTERVAL_S;
      player.coldCause = cause ?? 'night';
      player.damage(1, 'cold');
    }
  }

  private tickAir(dt: number): void {
    const { player } = this;
    if (!player.headInWater) {
      player.air = Math.min(MAX_AIR_S, player.air + AIR_REFILL_PER_S * dt);
      this.drownAcc = 0;
      return;
    }
    if (player.air > 0) {
      player.air = Math.max(0, player.air - dt);
      return;
    }
    this.drownAcc += dt;
    if (this.drownAcc >= 1) {
      this.drownAcc -= 1;
      player.damage(1, 'drown');
    }
  }

  /** Damage from blocks the player's body is inside (lava). Dealt in whole points as it accumulates. */
  private tickContact(dt: number): void {
    const { world, player } = this;
    const p = player.position;
    const half = PLAYER_WIDTH / 2;
    const x1 = Math.floor(p.x + half);
    const y1 = Math.floor(p.y + PLAYER_HEIGHT - 0.01);
    const z1 = Math.floor(p.z + half);
    let dps = 0;
    let cause: DamageCause = 'burn';
    for (let y = Math.floor(p.y); y <= y1; y++) {
      for (let z = Math.floor(p.z - half); z <= z1; z++) {
        for (let x = Math.floor(p.x - half); x <= x1; x++) {
          const v = world.getVoxel(x, y, z);
          if (v === AIR) continue;
          const def = blockOf(v);
          if (def.contactDamage <= dps) continue;
          dps = def.contactDamage;
          cause = def.liquid === 'lava' ? 'lava' : def.key === 'foul_air' ? 'gas' : 'burn';
        }
      }
    }
    if (dps <= 0) return;
    this.contactAcc += dps * dt;
    // The epsilon absorbs float drift so 4 damage/s lands on exactly every fifth 20 Hz tick.
    const whole = Math.floor(this.contactAcc + 1e-9);
    if (whole >= 1) {
      this.contactAcc = Math.max(0, this.contactAcc - whole);
      player.damage(whole, cause);
    }
  }

  private tickRadiation(dt: number, px: number, py: number, pz: number): void {
    const { player } = this;
    let dose = player.extraRadiation;
    player.extraRadiation = 0;
    for (const s of this.radiation) {
      const d = Math.hypot(s.x - px, s.y - py, s.z - pz);
      if (d < RADIATION_RANGE) dose += s.strength * (1 - d / RADIATION_RANGE);
    }
    if (this.suit) dose *= SHIELD_SUIT_FACTOR;
    this.dose = dose;
    if (dose <= RADIATION_SAFE_DOSE) {
      this.radiationS = 0;
      return;
    }
    this.radiationS += dt;
    if (this.radiationS >= RADIATION_DAMAGE_INTERVAL_S) {
      this.radiationS -= RADIATION_DAMAGE_INTERVAL_S;
      player.damage(1, 'radiation');
    }
  }

  private tickRegen(dt: number): void {
    const { player, hunger } = this;
    const quiet = player.sinceDamageS >= REGEN_QUIET_S;
    if (player.dead || player.health >= MAX_HEALTH || player.warmth <= REGEN_MIN_WARMTH || !quiet || !hunger.canRegenerate()) {
      this.regenS = 0;
      return;
    }
    this.regenS += dt;
    const interval = hunger.regenInterval(REGEN_INTERVAL_S);
    if (this.regenS >= interval) {
      this.regenS -= interval;
      player.heal(1);
      hunger.payForRegen();
    }
  }
}
