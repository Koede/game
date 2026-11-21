/**
 * The player's brewing actions and the words for brewing blocks (BREWING_PLAN 4, 11): the single `brewUse` table,
 * setting a container on a furnace top, and the sentence a target shows. Every refusal says what to do next.
 */
import { BOILING_KEEPS_S, BOIL_SECONDS, BREW_SECONDS, KETTLE_BOIL_C } from '../core/constants';
import { CONE_ITEM, CONTAINER_BLOCKS } from '../core/brewing';
import { blockId, containerBoilingTo, containerEmptiedTo, itemOrNull } from '../core/registry';
import { makeVoxel } from '../core/types';
import type { Brewing, BoilBucket, BrewCup, Kettle } from './brewing';

/** What the player module applies after a successful brew action (see docs/api/brewing.md). */
export type BrewResult =
  | { ok: true; consume: boolean; give?: string; giveDurability?: number }
  | { ok: false; reason: string };

export interface BrewView {
  kind: 'boil_bucket' | 'brew_cup' | 'kettle';
  stage: 'heating' | 'boiling' | 'cup' | 'cone' | 'loaded' | 'brewing' | 'done' | 'empty' | 'filled';
  text: string;
  progress: number;
  secondsLeft: number;
  drink: string | null;
  tempC: number | null;
}

/** Litres a bucket takes from or gives to a kettle, and what the kettle holds at most. */
export const KETTLE_BUCKET_L = 1000;
export const KETTLE_CAPACITY_L = 4000;

const refuse = (reason: string): BrewResult => ({ ok: false, reason });
const name = (key: string | null): string => (key ? itemOrNull(key)?.name ?? key : '');

export function brewUse(b: Brewing, x: number, y: number, z: number, held: string | null): BrewResult {
  const e = b.entityAt(x, y, z);
  if (!e) return refuse('There is nothing to use here');
  if (e.kind === 'brew_cup') return useCup(b, e as BrewCup, held);
  if (e.kind === 'boil_bucket') return takeBucket(b, e as BoilBucket);
  return useKettle(e as Kettle, held);
}

function useCup(b: Brewing, e: BrewCup, held: string | null): BrewResult {
  const heldItem = held ? itemOrNull(held) : null;
  switch (e.stage) {
    case 'cup':
      if (held !== CONE_ITEM) return refuse('Set a drip cone on the cup');
      b.setCup(e, 'cone');
      return { ok: true, consume: true };
    case 'cone':
      if (!held || !heldItem?.brews) return refuse('Load the cone with tea leaves or ground coffee');
      e.ingredient = held;
      e.drink = heldItem.brews;
      b.setCup(e, 'loaded');
      return { ok: true, consume: true };
    case 'loaded': {
      const container = held ? containerBoilingTo(held) : null;
      if (container) {
        e.brewS = 0;
        b.setCup(e, 'brewing');
        b.bus.emit('sfx', { name: 'pour', x: e.x, y: e.y, z: e.z });
        b.bus.emit('brew:started', { x: e.x, y: e.y, z: e.z, drink: e.drink ?? '' });
        return { ok: true, consume: true, give: container.container?.emptyTo };
      }
      if (heldItem?.container) return refuse('The water must be boiling - heat the bucket on the furnace');
      return refuse('Pour boiling water over it');
    }
    case 'brewing':
      return refuse('Still dripping');
    case 'done': {
      const drink = e.drink;
      if (!drink) return refuse('The cup is empty');
      e.drink = null;
      e.steamS = 0;
      b.setCup(e, 'cone');
      return { ok: true, consume: false, give: drink };
    }
  }
}

function takeBucket(b: Brewing, e: BoilBucket): BrewResult {
  const container = itemOrNull(e.container)?.container;
  const { boiling, container: key } = e;
  b.removeBlock(e.x, e.y, e.z);
  if (boiling && container) return { ok: true, consume: false, give: container.boilsTo, giveDurability: BOILING_KEEPS_S };
  return { ok: true, consume: false, give: key };
}

function useKettle(e: Kettle, held: string | null): BrewResult {
  const heldItem = held ? itemOrNull(held) : null;
  if (!held || !heldItem) return refuse(e.waterL > 0 ? 'Use an empty bucket to take boiling water' : 'The kettle is empty - pour water in');
  const full = heldItem.container;
  if (full) {
    if (e.waterL + KETTLE_BUCKET_L > KETTLE_CAPACITY_L) return refuse('The kettle is full');
    e.waterL += KETTLE_BUCKET_L;
    return { ok: true, consume: true, give: full.emptyTo };
  }
  const container = containerEmptiedTo(held)?.container;
  if (!container) return refuse('Use a bucket on the kettle');
  if (!e.boiling) return refuse('The kettle is not boiling yet');
  if (e.waterL < KETTLE_BUCKET_L) return refuse('There is not enough water in the kettle');
  e.waterL -= KETTLE_BUCKET_L;
  return { ok: true, consume: true, give: container.boilsTo, giveDurability: BOILING_KEEPS_S };
}

/** Sets a water container on the furnace (or hearth roof) below the empty cell x,y,z. */
export function placeContainer(b: Brewing, x: number, y: number, z: number, held: string | null): BrewResult {
  const blocks = held ? CONTAINER_BLOCKS[held] : undefined;
  if (!held || !blocks || !itemOrNull(held)?.container) return refuse('Only a bucket of water can be heated here');
  if (!isFurnaceTop(b, x, y, z)) return refuse('Set the bucket on top of a furnace');
  if (!b.isAir(x, y, z)) return refuse('There is no room on top');
  b.pendingContainer = held;
  b.world.setVoxel(x, y, z, makeVoxel(blockId(blocks.cold)), 'player');
  b.pendingContainer = null;
  return { ok: true, consume: true };
}

export const isFurnaceTop = (b: Brewing, x: number, y: number, z: number): boolean => b.host.furnaceBelow(x, y - 1, z) !== null;

export function brewView(b: Brewing, x: number, y: number, z: number): BrewView | null {
  const e = b.entityAt(x, y, z);
  if (!e) return null;
  const view = (stage: BrewView['stage'], text: string, extra: Partial<BrewView> = {}): BrewView => ({
    kind: e.kind as BrewView['kind'], stage, text, progress: 0, secondsLeft: 0, drink: null, tempC: null, ...extra,
  });
  if (e.kind === 'boil_bucket') {
    const k = e as BoilBucket;
    const t = b.host.furnaceBelow(x, y - 1, z)?.tempC ?? null;
    if (k.boiling) return view('boiling', 'Boiling water - take it', { tempC: t });
    const label = name(k.container);
    if (t === null || t < 100) return view('heating', `${label} - needs a furnace at 100 C or more`, { tempC: t, progress: k.heatS / BOIL_SECONDS });
    const rate = Math.min(2, Math.max(0.5, (t - 100) / 200 + 0.5));
    const left = Math.max(1, Math.ceil((BOIL_SECONDS - k.heatS) / rate));
    return view('heating', `${label} - ${left} s to the boil`, { tempC: t, progress: k.heatS / BOIL_SECONDS, secondsLeft: left });
  }
  if (e.kind === 'brew_cup') {
    const c = e as BrewCup;
    switch (c.stage) {
      case 'cup': return view('cup', 'Clay Cup - set a drip cone on it');
      case 'cone': return view('cone', 'Cup with drip cone - add tea or ground coffee');
      case 'loaded': return view('loaded', `Loaded with ${name(c.ingredient)} - pour boiling water over it`, { drink: c.drink });
      case 'brewing': {
        const left = Math.max(1, Math.ceil(BREW_SECONDS - c.brewS));
        return view('brewing', `Brewing ${left} s`, { drink: c.drink, progress: Math.min(1, c.brewS / BREW_SECONDS), secondsLeft: left });
      }
      case 'done': return view('done', `${name(c.drink)} - take it`, { drink: c.drink });
    }
  }
  const k = e as Kettle;
  if (k.boiling) return view('boiling', `Kettle boiling - ${Math.round(k.waterL)} L`);
  if (k.waterL <= 0) return view('empty', 'Kettle - empty, pour water in');
  return view('filled', `Kettle - ${Math.round(k.waterL)} L, heat it to ${KETTLE_BOIL_C} C`);
}
