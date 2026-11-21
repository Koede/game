/**
 * Brewing (BREWING_PLAN 4, 11): the bucket boiling on a furnace top, the cup setup and the kettle pot. Their entities
 * are plain JSON in the world but never machine nodes: they join no network, no machine list and no machine view, like
 * crops. The block id is the look; the entity holds the timers. Player actions are in brewActions.ts.
 */
import {
  AMBIENT_TEMP_C, BOIL_DRY_SECONDS, BOIL_SECONDS, BOIL_TEMP_C, BREW_SECONDS, BREW_STEAM_S, FLAG_BOILED_WATER, FLAG_BREWED, KETTLE_BOIL_C,
} from '../core/constants';
import type { GameBus } from '../core/context';
import {
  BOIL_BUCKET_MACHINE, BREW_CUP_MACHINE, CONTAINER_BLOCKS, CUP_BLOCK, KETTLE_MACHINE, cupStageOfBlock, type CupStage,
} from '../core/brewing';
import { blockId, blockOf, itemOrNull } from '../core/registry';
import { posKey, type FurnaceEntity } from './entities';
import { voxelId, withActive, withId, type BlockDef, type BlockEntity, type IWorld } from '../core/types';

export interface BoilBucket extends BlockEntity {
  kind: 'boil_bucket';
  /** Seconds of full heating towards the boil. */
  heatS: number;
  boiling: boolean;
  /** Seconds spent boiling (the bucket boils dry at BOIL_DRY_SECONDS). */
  dryS: number;
  /** Item key of the container that was set down (water_pail): its `emptyTo` goes back when the bucket is lost. */
  container: string;
}

export interface BrewCup extends BlockEntity {
  kind: 'brew_cup';
  stage: CupStage;
  /** Item key of the ingredient in the cone (stage loaded), else null. */
  ingredient: string | null;
  /** Item key of the drink the cup holds or is making, else null. */
  drink: string | null;
  brewS: number;
  /** Seconds the finished cup still steams. */
  steamS: number;
}

export interface Kettle extends BlockEntity {
  kind: 'kettle';
  waterL: number;
  boiling: boolean;
}

export type BrewEntity = BoilBucket | BrewCup | Kettle;
export const isBrewKind = (kind: string): boolean => kind === BOIL_BUCKET_MACHINE || kind === BREW_CUP_MACHINE || kind === KETTLE_MACHINE;

/** What the simulation gives brewing: the furnace below a cell, flags, and where returned items go. */
export interface BrewHost {
  furnaceBelow(x: number, y: number, z: number): FurnaceEntity | null;
  flagOnce(flag: string): void;
  /** Hands an item to the player (a crate takes it when the pack is full). */
  returnItem(x: number, y: number, z: number, item: string, durability?: number): void;
}

/** Heat the boil draws from the furnace (watts): half while it keeps boiling, the full amount while heating. */
const HEAT_W = 600;
const BOILING_W = 300;
const DRIP_EVERY_S = 0.5;
const KETTLE_HYSTERESIS_C = 10;

const finite = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export class Brewing {
  private readonly byKey = new Map<string, BrewEntity>();
  private readonly list: BrewEntity[] = [];
  /** The container being set down by placeContainer(), read when its block change arrives. */
  pendingContainer: string | null = null;

  constructor(readonly world: IWorld, readonly bus: GameBus, readonly host: BrewHost) {}

  get count(): number {
    return this.list.length;
  }

  clear(): void {
    this.byKey.clear();
    this.list.length = 0;
  }

  entityAt(x: number, y: number, z: number): BrewEntity | undefined {
    return this.byKey.get(posKey(x, y, z));
  }

  /** Whether a block belongs to a brewing machine. */
  static handles(def: BlockDef): boolean {
    return def.machine !== null && isBrewKind(def.machine);
  }

  private add(e: BrewEntity): void {
    this.byKey.set(posKey(e.x, e.y, e.z), e);
    this.list.push(e);
  }

  /** Follows an entity stored in the world (after loading): fields are repaired, the block is checked on the tick. */
  track(stored: BlockEntity): void {
    const e = stored as BrewEntity;
    if (e.kind === BOIL_BUCKET_MACHINE) {
      const b = e as BoilBucket;
      b.heatS = Math.max(0, finite(b.heatS, 0));
      b.dryS = Math.max(0, finite(b.dryS, 0));
      b.boiling = b.boiling === true;
      if (typeof b.container !== 'string' || !itemOrNull(b.container)) b.container = Object.keys(CONTAINER_BLOCKS)[0];
    } else if (e.kind === BREW_CUP_MACHINE) {
      const c = e as BrewCup;
      if (c.stage !== 'cup' && c.stage !== 'cone' && c.stage !== 'loaded' && c.stage !== 'brewing' && c.stage !== 'done') c.stage = 'cup';
      c.ingredient = typeof c.ingredient === 'string' && itemOrNull(c.ingredient) ? c.ingredient : null;
      c.drink = typeof c.drink === 'string' && itemOrNull(c.drink) ? c.drink : null;
      c.brewS = Math.max(0, finite(c.brewS, 0));
      c.steamS = Math.max(0, finite(c.steamS, 0));
    } else {
      const k = e as Kettle;
      k.waterL = Math.max(0, finite(k.waterL, 0));
      k.boiling = k.boiling === true;
    }
    const key = posKey(e.x, e.y, e.z);
    const old = this.byKey.get(key);
    if (old) this.list.splice(this.list.indexOf(old), 1);
    this.add(e);
  }

  /** A brewing block now stands at x,y,z (placed, loaded, or one of our own swaps): keep, adopt or create its entity. */
  place(x: number, y: number, z: number, def: BlockDef): void {
    const key = posKey(x, y, z);
    let e = this.byKey.get(key);
    if (e && e.kind !== def.machine) {
      this.remove(x, y, z);
      e = undefined;
    }
    if (!e) {
      const stored = this.world.getEntity(x, y, z);
      if (stored && stored.kind === def.machine) this.track(stored);
      else this.create(x, y, z, def);
      e = this.byKey.get(key);
    }
    if (e?.kind === BREW_CUP_MACHINE) {
      const stage = cupStageOfBlock(def.key);
      if (stage) (e as BrewCup).stage = stage;
    } else if (e?.kind === BOIL_BUCKET_MACHINE) {
      const b = e as BoilBucket;
      const boiling = Object.values(CONTAINER_BLOCKS).some((c) => c.boiling === def.key);
      b.boiling = boiling;
    }
  }

  private create(x: number, y: number, z: number, def: BlockDef): void {
    let e: BrewEntity;
    if (def.machine === BOIL_BUCKET_MACHINE) {
      const entry = Object.entries(CONTAINER_BLOCKS).find(([, b]) => b.cold === def.key || b.boiling === def.key);
      e = { kind: 'boil_bucket', x, y, z, heatS: 0, boiling: false, dryS: 0, container: this.pendingContainer ?? entry?.[0] ?? Object.keys(CONTAINER_BLOCKS)[0] };
      this.pendingContainer = null;
    } else if (def.machine === BREW_CUP_MACHINE) {
      e = { kind: 'brew_cup', x, y, z, stage: cupStageOfBlock(def.key) ?? 'cup', ingredient: null, drink: null, brewS: 0, steamS: 0 };
    } else e = { kind: 'kettle', x, y, z, waterL: 0, boiling: false };
    this.world.setEntity(e);
    this.add(e);
  }

  /** The brewing block at x,y,z is gone. A cup gives back what is inside (its parts are the block's own drops). */
  remove(x: number, y: number, z: number): void {
    const key = posKey(x, y, z);
    const e = this.byKey.get(key);
    if (!e) return;
    this.byKey.delete(key);
    this.list.splice(this.list.indexOf(e), 1);
    if (this.world.getEntity(x, y, z) === e) this.world.removeEntity(x, y, z);
    if (e.kind === BREW_CUP_MACHINE) {
      const c = e as BrewCup;
      const back = c.stage === 'loaded' ? c.ingredient : c.stage === 'done' ? c.drink : null;
      if (back) this.host.returnItem(x, y, z, back);
    }
  }

  // ---- ticking ---------------------------------------------------------------------------------------------------

  /** Runs every brewing entity. Call before the furnaces are advanced: the heat they draw lands in `extractW`. */
  tick(dt: number): void {
    const list = this.list;
    // Backwards, so an entity removing itself (swap with the last) never skips one.
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (!this.world.isLoaded(e.x, e.z)) continue;
      const def = blockOf(this.world.getVoxel(e.x, e.y, e.z));
      if (def.machine !== e.kind) {
        this.remove(e.x, e.y, e.z);
        continue;
      }
      if (e.kind === BOIL_BUCKET_MACHINE) this.boil(e as BoilBucket, dt);
      else if (e.kind === BREW_CUP_MACHINE) this.brew(e as BrewCup, dt);
      else this.kettle(e as Kettle, dt);
    }
  }

  private swap(e: BlockEntity, key: string): void {
    const v = this.world.getVoxel(e.x, e.y, e.z);
    this.world.setVoxel(e.x, e.y, e.z, withId(v, blockId(key)), 'sim');
  }

  private boil(e: BoilBucket, dt: number): void {
    const furnace = this.host.furnaceBelow(e.x, e.y - 1, e.z);
    const blocks = CONTAINER_BLOCKS[e.container];
    if (!furnace && !this.world.getBlock(e.x, e.y - 1, e.z).solid) {
      // The furnace (or the roof it stood on) is gone: the bucket falls back into the player's hands.
      this.lose(e, false);
      return;
    }
    const t = furnace ? furnace.tempC : AMBIENT_TEMP_C;
    const spec = itemOrNull(e.container)?.container;
    const boilS = BOIL_SECONDS * (spec?.boilScale ?? 1);
    if (!e.boiling) {
      if (t >= BOIL_TEMP_C) {
        e.heatS += dt * Math.min(2, Math.max(0.5, (t - 100) / 200 + 0.5));
        if (furnace) furnace.extractW += HEAT_W;
      } else e.heatS = Math.max(0, e.heatS - dt);
      if (e.heatS >= boilS) {
        e.boiling = true;
        e.dryS = 0;
        this.swap(e, blocks.boiling);
        this.bus.emit('water:boiling', { x: e.x, y: e.y, z: e.z });
        this.bus.emit('sfx', { name: 'boil_bubble', x: e.x, y: e.y, z: e.z });
        this.host.flagOnce(FLAG_BOILED_WATER);
      }
      return;
    }
    if (t < BOIL_TEMP_C - 20) {
      e.boiling = false;
      e.heatS = boilS * 0.5;
      this.swap(e, blocks.cold);
      return;
    }
    // Cooked things (sap to resin) wait to be taken; only water boils dry.
    if (spec && spec.holds !== 'water') return;
    e.dryS += dt;
    if (furnace) furnace.extractW += BOILING_W;
    if (e.dryS >= BOIL_DRY_SECONDS) this.lose(e, true);
  }

  /** The bucket leaves its place: the block goes and the empty container returns to the player. */
  private lose(e: BoilBucket, dry: boolean): void {
    const empty = itemOrNull(e.container)?.container?.emptyTo;
    const { x, y, z } = e;
    this.world.setVoxel(x, y, z, 0, 'sim');
    if (empty) this.host.returnItem(x, y, z, empty);
    if (dry) this.bus.emit('toast', { text: 'The bucket boiled dry', kind: 'warn' });
  }

  private brew(e: BrewCup, dt: number): void {
    if (e.stage === 'done') {
      if (e.steamS > 0) e.steamS = Math.max(0, e.steamS - dt);
      return;
    }
    if (e.stage !== 'brewing') return;
    const before = e.brewS;
    e.brewS += dt;
    if (Math.floor(e.brewS / DRIP_EVERY_S) > Math.floor(before / DRIP_EVERY_S)) this.bus.emit('sfx', { name: 'drip', x: e.x, y: e.y, z: e.z });
    if (e.brewS < BREW_SECONDS) return;
    e.stage = 'done';
    e.steamS = BREW_STEAM_S;
    e.ingredient = null;
    this.swap(e, CUP_BLOCK.done);
    this.bus.emit('brew:done', { x: e.x, y: e.y, z: e.z, drink: e.drink ?? '' });
    this.bus.emit('sfx', { name: 'smelt_done', x: e.x, y: e.y, z: e.z, pitch: 1.4 });
    this.host.flagOnce(FLAG_BREWED);
  }

  private kettle(e: Kettle, dt: number): void {
    void dt;
    const furnace = this.host.furnaceBelow(e.x, e.y - 1, e.z);
    const t = furnace ? furnace.tempC : AMBIENT_TEMP_C;
    const boiling = e.waterL > 0 && t >= KETTLE_BOIL_C - (e.boiling ? KETTLE_HYSTERESIS_C : 0);
    if (boiling && furnace) furnace.extractW += BOILING_W;
    if (boiling === e.boiling) return;
    e.boiling = boiling;
    const v = this.world.getVoxel(e.x, e.y, e.z);
    this.world.setVoxel(e.x, e.y, e.z, withActive(v, boiling), 'sim');
    if (boiling) this.bus.emit('water:boiling', { x: e.x, y: e.y, z: e.z });
  }

  /** Moves a cup to another stage: the entity first, then its block. */
  setCup(e: BrewCup, stage: CupStage): void {
    e.stage = stage;
    this.swap(e, CUP_BLOCK[stage]);
  }

  /** Takes the block at x,y,z away (its entity follows through the block change). */
  removeBlock(x: number, y: number, z: number): void {
    this.world.setVoxel(x, y, z, 0, 'player');
  }

  /** Whether the cell is empty air (a container can be set there). */
  isAir(x: number, y: number, z: number): boolean {
    return voxelId(this.world.getVoxel(x, y, z)) === 0;
  }
}
