/**
 * Casting at the furnace (docs/api/casting.md, docs/EMBER_PLAN.md section 2). A smelt of a cast metal (copper, tin,
 * bronze) does not put an ingot in the output slot: the metal sits MOLTEN in the crucible for MOLTEN_WINDOW_S
 * (`crucibleMelt` + `crucibleMoltenS`). Pouring it into a fired mould makes the mould's shape; left alone it cools
 * into blooms in `crucibleOut`, which must be smelted again. An alloy pot set in a crucible slot takes copper
 * and tin ingots and melts them into molten bronze at 800 C. Other metals (iron and up) smelt to ingots as before.
 */
import { FLAG_FIRST_POUR, MOLTEN_WINDOW_S, MOULD_POURS } from '../core/constants';
import { CAST_METALS, castMetalOfIngot, castOf, itemOrNull, mouldOf, recipe } from '../core/registry';
import type { CastMetalSpec, RecipeDef, Slot } from '../core/types';
import { OK, refuse, stackMax, type ActionResult, type FurnaceEntity, type SimContext } from './entities';

/** The alloy pot: item and block key, set in a crucible slot. */
export const ALLOY_POT = 'alloy_pot';
/** Copper and tin ingots a pot holds at most; bronze needs three of copper to one of tin and makes four ingots. */
export const POT_COPPER_MAX = 6;
export const POT_TIN_MAX = 2;
const BRONZE = 'bronze_ingot';
const ALLOY_RECIPE = 'bronze_ingot_alloy';
const ALLOY_COPPER = 3;
const ALLOY_TIN = 1;
const ALLOY_FALLBACK_C = 800;
const ALLOY_FALLBACK_S = 8;
const COPPER = 'copper_ingot';
const TIN = 'tin_ingot';

export type PourResult = { ok: true; count: number } | { ok: false; reason: string };

const name = (key: string): string => itemOrNull(key)?.name ?? key;

/** The cast metal an ingot key is, or null (iron and up). */
export const metalOfIngot = (ingot: string): CastMetalSpec | null => castMetalOfIngot(ingot);

/** What a crucible gets out of a finished smelt: cast metals come out molten, everything else as the recipe says. */
export const outputItem = (r: RecipeDef): string => castMetalOfIngot(r.output.item)?.bloom ?? r.output.item;

/** Seconds the molten metal in a crucible has left (0 when none). */
export const moltenLeft = (e: FurnaceEntity, i: number): number => (e.crucibleMelt[i] ? e.crucibleMoltenS[i] : 0);

/** Whether a finished smelt of `r` fits: the molten pool and the cooled blooms together stay inside one stack. */
export function castRoom(e: FurnaceEntity, i: number, r: RecipeDef): boolean {
  const metal = castMetalOfIngot(r.output.item);
  const out = e.crucibleOut[i];
  const melt = e.crucibleMelt[i];
  if (!metal) return !melt && (!out || (out.item === r.output.item && out.count + r.output.count <= stackMax(out.item)));
  if (melt && melt.item !== metal.ingot) return false;
  if (out && out.item !== metal.bloom) return false;
  return (out?.count ?? 0) + (melt?.count ?? 0) + r.output.count <= stackMax(metal.bloom);
}

/** Adds molten metal to a crucible's pool and restarts its window. */
export function addMelt(e: FurnaceEntity, i: number, ingot: string, units: number): void {
  const melt = e.crucibleMelt[i];
  if (melt) melt.count += units;
  else e.crucibleMelt[i] = { item: ingot, count: units };
  e.crucibleMoltenS[i] = MOLTEN_WINDOW_S;
}

/** A finished smelt of a cast metal: the metal goes into the pool. Returns false when the output is not a cast metal. */
export function pourOutOfSmelt(e: FurnaceEntity, i: number, r: RecipeDef): boolean {
  if (!castMetalOfIngot(r.output.item)) return false;
  addMelt(e, i, r.output.item, r.output.count);
  return true;
}

/** Counts the windows down; metal that was not poured in time cools into blooms. */
export function coolMolten(e: FurnaceEntity, ctx: SimContext, dt: number): void {
  for (let i = 0; i < e.crucibleMelt.length; i++) {
    const melt = e.crucibleMelt[i];
    if (!melt) continue;
    e.crucibleMoltenS[i] -= dt;
    if (e.crucibleMoltenS[i] > 0) continue;
    const bloom = castMetalOfIngot(melt.item)?.bloom;
    e.crucibleMelt[i] = null;
    e.crucibleMoltenS[i] = 0;
    if (!bloom) continue;
    const out = e.crucibleOut[i];
    if (out) out.count = Math.min(stackMax(bloom), out.count + melt.count);
    else e.crucibleOut[i] = { item: bloom, count: Math.min(stackMax(bloom), melt.count) };
    ctx.touch(e);
    ctx.bus.emit('sfx', { name: 'fire_out', x: e.x, y: e.y, z: e.z, pitch: 1.4 });
    ctx.bus.emit('toast', { text: `${name(melt.item)} went cold in the crucible: a bloom, smelt it again`, kind: 'warn' });
  }
}

/** The metal a bloom item is made of, or null. */
export const metalOfBloom = (key: string): CastMetalSpec | null => CAST_METALS.find((m) => m.bloom === key) ?? null;

const alloyRecipe = (): RecipeDef | null => recipe(ALLOY_RECIPE);
export const alloyMinC = (): number => alloyRecipe()?.minTempC ?? ALLOY_FALLBACK_C;
export const alloyTimeS = (): number => alloyRecipe()?.timeS ?? ALLOY_FALLBACK_S;

export const hasPot = (e: FurnaceEntity, i: number): boolean => e.crucibleIn[i]?.item === ALLOY_POT;

/** Why the pot in crucible `i` cannot take a batch of bronze right now (its pool or output is in the way), or null. */
export function potBlock(e: FurnaceEntity, i: number): string | null {
  const melt = e.crucibleMelt[i];
  if (melt && melt.item !== BRONZE) return `The pot still holds molten ${name(melt.item)}`;
  const bloom = metalOfIngot(BRONZE)?.bloom ?? '';
  const out = e.crucibleOut[i];
  if (out && out.item !== bloom) return `Take the ${name(out.item)} out of the crucible first`;
  const batch = alloyRecipe()?.output.count ?? 4;
  if ((out?.count ?? 0) + (melt?.count ?? 0) + batch > stackMax(bloom)) return 'The crucible is full of bronze';
  return null;
}

/** Pours cold ingots of copper or tin from the pack into the alloy pot set in crucible `slot`. */
function loadPot(ctx: SimContext, e: FurnaceEntity, slot: number, ingot: string): ActionResult {
  if (!hasPot(e, slot)) return refuse('Set an alloy pot in this crucible first');
  const k = ingot === COPPER ? 0 : 1;
  const mix = e.crucibleMix[slot];
  const room = (k === 0 ? POT_COPPER_MAX : POT_TIN_MAX) - mix[k];
  if (room <= 0) return refuse(k === 0 ? 'The pot has all the copper it takes - it needs tin' : 'The pot has all the tin it takes - it needs copper');
  const n = Math.min(room, ctx.player.inventory.count(ingot));
  if (n < 1) return refuse(`You have no ${name(ingot)}`);
  ctx.player.inventory.remove(ingot, n);
  mix[k] += n;
  ctx.touch(e);
  ctx.bus.emit('sfx', { name: 'pour', x: e.x, y: e.y, z: e.z });
  return OK;
}

/** An alloy pot melts a full batch (3 copper, 1 tin) into molten bronze while the furnace is hot enough. */
export function runPot(e: FurnaceEntity, i: number, ctx: SimContext, dt: number): void {
  const mix = e.crucibleMix[i];
  const idle = mix[0] < ALLOY_COPPER || mix[1] < ALLOY_TIN || potBlock(e, i) !== null;
  if (idle) {
    e.crucibleProgress[i] = 0;
    return;
  }
  if (!e.ignited && e.tempC < alloyMinC()) return;
  e.crucibleProgress[i] += dt;
  if (e.crucibleProgress[i] < alloyTimeS()) return;
  e.crucibleProgress[i] = 0;
  mix[0] -= ALLOY_COPPER;
  mix[1] -= ALLOY_TIN;
  const batch = alloyRecipe()?.output.count ?? 4;
  addMelt(e, i, BRONZE, batch);
  ctx.touch(e);
  ctx.bus.emit('sfx', { name: 'smelt_done', x: e.x, y: e.y, z: e.z });
  ctx.bus.emit('toast', { text: `${batch} bronze ingots molten in the pot - pour them into a mould`, kind: 'good', item: BRONZE });
}

/** First stack of `key` in the pack with the fewest pours left (worn moulds go first). */
function wornestMould(slots: readonly ({ item: string; durability?: number } | null)[], key: string): number {
  let best = -1;
  let left = Infinity;
  slots.forEach((s, i) => {
    if (!s || s.item !== key) return;
    const d = s.durability ?? MOULD_POURS;
    if (d < left) {
      left = d;
      best = i;
    }
  });
  return best;
}

/**
 * Pours the molten metal of crucible `slot`. `heldKey` is a fired mould in the pack (every pour the metal covers, up
 * to the pours the mould has left and the room in the pack), or an ingot of copper or tin to pour from the pack into
 * the alloy pot set in this crucible.
 */
export function pourCrucible(ctx: SimContext, e: FurnaceEntity, slot: number, heldKey: string | null, working: number): ActionResult {
  if (!Number.isInteger(slot) || slot < 0 || slot >= Math.min(working, e.crucibleIn.length)) return refuse('There is no such crucible');
  if (heldKey === COPPER || heldKey === TIN) return loadPot(ctx, e, slot, heldKey);
  const melt = e.crucibleMelt[slot];
  if (!melt || e.crucibleMoltenS[slot] <= 0) return refuse(e.crucibleOut[slot] ? 'It has gone cold - smelt the bloom again' : 'Nothing molten there');
  const pos = { x: e.x, y: e.y, z: e.z };
  const mould = heldKey ? mouldOf(heldKey) : null;
  if (!heldKey || !mould) return refuse('Hold a fired mould to pour into');
  const metal = metalOfIngot(melt.item);
  const cast = castOf(heldKey, melt.item);
  if (!metal || !cast) return refuse(`The ${name(heldKey)} does not take ${name(melt.item)}`);
  if (melt.count < cast.units) return refuse(`Needs ${cast.units} molten ${name(melt.item)} - there is ${melt.count}`);
  const inv = ctx.player.inventory;
  const at = wornestMould(inv.slots, heldKey);
  if (at < 0) return refuse(`You have no ${name(heldKey)}`);
  const stack = inv.slots[at];
  if (!stack) return refuse(`You have no ${name(heldKey)}`);
  const poursLeft = stack.durability ?? MOULD_POURS;
  const n = Math.min(Math.floor(melt.count / cast.units), poursLeft, inv.space(cast.item));
  if (n < 1) return refuse('Your pack is full');
  inv.add(cast.item, n);
  melt.count -= n * cast.units;
  if (melt.count <= 0) {
    e.crucibleMelt[slot] = null;
    e.crucibleMoltenS[slot] = 0;
  }
  if (poursLeft - n <= 0) {
    inv.removeAt(at, 1);
    ctx.bus.emit('tool:broke', { item: heldKey });
  } else {
    stack.durability = poursLeft - n;
    inv.notifyChanged();
  }
  ctx.touch(e);
  ctx.bus.emit('cast:poured', { ...pos, mould: heldKey, metal: metal.key, item: cast.item, count: n, at: 'furnace' });
  ctx.bus.emit('item:made', { item: cast.item, count: n, station: 'furnace', recipeId: `cast:${heldKey}` });
  ctx.bus.emit('sfx', { name: 'pour', ...pos });
  ctx.flagOnce(FLAG_FIRST_POUR);
  return OK;
}

/** Moulds in the pack that take the metal of this crucible's pool, with their pours left and what one pour makes. */
export interface PourOption {
  mould: string;
  name: string;
  /** What the pour makes, and how many ingots of molten metal it takes and has available. */
  makes: string;
  units: number;
  casts: number;
  poursLeft: number;
}

export function pourOptions(melt: Slot, moltenS: number, pack: readonly ({ item: string; durability?: number } | null)[]): PourOption[] {
  if (!melt || moltenS <= 0) return [];
  const seen = new Set<string>();
  const out: PourOption[] = [];
  for (const s of pack) {
    if (!s || seen.has(s.item) || !mouldOf(s.item)) continue;
    seen.add(s.item);
    const cast = castOf(s.item, melt.item);
    if (!cast) continue;
    const at = wornestMould(pack, s.item);
    out.push({ mould: s.item, name: name(s.item), makes: cast.item, units: cast.units, casts: Math.floor(melt.count / cast.units), poursLeft: pack[at]?.durability ?? MOULD_POURS });
  }
  return out;
}
