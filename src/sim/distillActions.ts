/**
 * The player's hands and eyes on the glass distillery (docs/api/distillery.md): Use with a container or an empty hand,
 * the crosshair sentence, and the chemistry port's fluid endpoint for pipes. The result shape is brewing's BrewResult,
 * so the player module applies it the same way (consume one held, give one back, toast).
 */
import { expand, nameOf, pour, total, type Mix } from '../core/chem';
import {
  CHEM, CHEM_CAPACITY_L, CHEM_CONTAINERS, ESSENCE_COUNT, STILL_DEFAULT_C, STILL_SETPOINTS, burnerTemp, drinkOfEssence, essenceDrink, filledWith,
  isBotanical, isEmptyChemContainer, isFilterMedium, nextReflux, type ChemKind,
} from '../core/distill';
import { fluidOrNull, item, itemOrNull } from '../core/registry';
import type { FluidKey } from '../core/types';
import type { ChemEntity, Distillery } from './distill';
import type { FluidEndpoint } from './endpoints';

/** One Use on a module: brewing's result plus a sentence to show when it worked. */
export type ChemResult =
  | { ok: true; consume: boolean; give?: string; toast?: string }
  | { ok: false; reason: string };

/** Modules a container pours into, and what they take. */
const POURS_INTO: ReadonlySet<ChemKind> = new Set([CHEM.flask, CHEM.vessel, CHEM.receiver, CHEM.jacket, CHEM.funnel]);
/** Modules a container takes out of. */
const TAKES_FROM: ReadonlySet<ChemKind> = new Set([CHEM.flask, CHEM.vessel, CHEM.receiver, CHEM.condenser, CHEM.funnel]);

const fluidName = (key: string | null): string => (key ? (fluidOrNull(key)?.name ?? key) : 'nothing');
const moduleName = (e: ChemEntity): string => item(e.kind).name;
const an = (word: string): string => (/^[AEIOU]/i.test(word) ? `an ${word}` : `a ${word}`);
const litresText = (l: number): string => (l >= 1000 ? `${(l / 1000).toFixed(1)} buckets` : `${Math.round(l)} L`);

/**
 * Use on the module at x, y, z with `heldKey` in hand (null: empty hand). Null when the held item has nothing to do
 * with chemistry (the tap carries on to eating, placing and the rest).
 */
export function chemUse(d: Distillery, x: number, y: number, z: number, heldKey: string | null): ChemResult | null {
  const e = d.entityAt(x, y, z);
  if (!e) return null;
  if (heldKey === null) {
    const ready = e.out?.find((s) => s.count > 0);
    if (ready && e.kind !== CHEM.base) {
      ready.count -= 1;
      e.out = e.out!.filter((s) => s.count > 0);
      return { ok: true, consume: false, give: ready.item, toast: `Took ${itemOrNull(ready.item)?.name ?? ready.item}` };
    }
    if (e.kind === CHEM.base) {
      const i = STILL_SETPOINTS.indexOf(e.setC ?? STILL_DEFAULT_C);
      e.setC = STILL_SETPOINTS[(i + 1) % STILL_SETPOINTS.length];
      return { ok: true, consume: false, toast: `Still Base set to ${e.setC} C` };
    }
    return { ok: true, consume: false, toast: chemView(d, x, y, z)?.text ?? moduleName(e) };
  }
  if (heldKey === 'wrench') {
    if (e.kind === CHEM.reflux) e.reflux = nextReflux(e.reflux ?? 0);
    d.bus.emit('ui:open', { screen: { type: 'distill_rig', x: e.x, y: e.y, z: e.z } });
    const ratio = e.kind === CHEM.reflux ? ` Reflux return ${Math.round((e.reflux ?? 0) * 100)}%.` : '';
    return { ok: true, consume: false, toast: `Rig screen.${ratio}` };
  }
  if (e.kind === CHEM.base && burnerTemp(heldKey) !== null) {
    if (e.slots?.some((s) => s.count > 0)) return { ok: false, reason: 'The Still Base is already fuelled' };
    e.slots = [{ item: heldKey, count: 1 }];
    return { ok: true, consume: true, toast: heldKey === 'charcoal' ? 'Charcoal in the burner: 250 C' : 'Fuel ethanol in the burner: 300 C' };
  }
  if (e.kind === CHEM.filter && isFilterMedium(heldKey)) {
    const have = e.slots?.find((s) => s.item === heldKey);
    if (have) have.count += 1;
    else if ((e.slots?.length ?? 0) > 0) return { ok: false, reason: 'The Filter Bed already holds a different medium' };
    else e.slots = [{ item: heldKey, count: 1 }];
    e.filtered = false;
    return { ok: true, consume: true, toast: 'Medium loaded' };
  }
  if (e.kind === CHEM.flask && essenceDrink(heldKey)) {
    const have = e.slots?.find((s) => s.item === heldKey);
    if (have && have.count >= ESSENCE_COUNT) return { ok: false, reason: 'The flask already holds four drinks' };
    if (!have && (e.slots?.length ?? 0) > 0) return { ok: false, reason: 'The flask already holds a different drink' };
    if (have) have.count += 1;
    else e.slots = [{ item: heldKey, count: 1 }];
    return { ok: true, consume: true, toast: 'Drink loaded' };
  }
  if (e.kind === CHEM.vessel && (isBotanical(heldKey) || heldKey === 'gravel' || heldKey === 'sand' || drinkOfEssence(heldKey))) {
    const have = e.slots?.find((s) => s.item === heldKey);
    if (have) have.count += 1;
    else {
      if ((e.slots?.length ?? 0) >= 4) return { ok: false, reason: 'The vessel slots are full' };
      (e.slots ??= []).push({ item: heldKey, count: 1 });
    }
    return { ok: true, consume: true, toast: 'Loaded' };
  }
  const full = CHEM_CONTAINERS[heldKey];
  if (full) {
    if (!POURS_INTO.has(e.kind)) return { ok: false, reason: `Pour into a Boiling Flask, a Reaction Vessel or a Receiver, not ${an(moduleName(e))}` };
    if (e.kind === CHEM.jacket && full.fluid !== 'water') return { ok: false, reason: 'A Cooling Jacket takes water only' };
    const room = CHEM_CAPACITY_L[e.kind] - total(e.mix);
    if (room < full.litres) return { ok: false, reason: `The ${moduleName(e)} is full` };
    pour(expand(full.fluid, full.litres), e.mix, full.litres);
    d.touched();
    return { ok: true, consume: true, give: full.empty, toast: `${fluidName(full.fluid)} poured in (${litresText(total(e.mix))})` };
  }
  // A glass vial takes the place of an empty beaker (src/content/itemsGlass.ts).
  if (heldKey === 'glass_vial') heldKey = 'glass_beaker';
  if (isEmptyChemContainer(heldKey)) {
    if (!TAKES_FROM.has(e.kind)) return { ok: false, reason: `Nothing to take from ${an(moduleName(e))}` };
    const name = nameOf(e.mix);
    if (name === null) return { ok: false, reason: `The ${moduleName(e)} is empty` };
    const into = filledWith(heldKey, name);
    const holder = itemOrNull(heldKey)?.name ?? heldKey;
    if (!into) return { ok: false, reason: `${an(holder).replace(/^a/, 'A')} cannot hold ${fluidName(name)}${name === 'water' ? '' : ' - try an Empty Canister or a Glass Beaker'}` };
    const litres = CHEM_CONTAINERS[into].litres;
    const have = total(e.mix);
    if (have + 1e-6 < litres) return { ok: false, reason: `Only ${Math.floor(have)} L of ${fluidName(name)} here - ${an(holder)} takes ${litres} L` };
    const out: Mix = {};
    pour(e.mix, out, litres);
    d.touched();
    return { ok: true, consume: true, give: into, toast: `Took ${fluidName(name)}` };
  }
  return null;
}

/** What the crosshair says about a module (brewing's view shape, kind 'chem'). */
export interface ChemView {
  kind: 'chem';
  stage: ChemEntity['state'];
  text: string;
  progress: number;
  secondsLeft: number;
  drink: null;
  tempC: number | null;
}

export function chemView(d: Distillery, x: number, y: number, z: number): ChemView | null {
  const e = d.entityAt(x, y, z);
  if (!e) return null;
  const rig = d.rigAt(x, y, z);
  const key = `${x},${y},${z}`;
  const problem = rig?.problems.find((p) => p.cells.includes(key));
  const name = moduleName(e);
  const held = total(e.mix);
  const contents = held > 0.5 ? `${litresText(held)} ${fluidName(nameOf(e.mix))}` : 'empty';
  let text: string;
  let tempC: number | null = null;
  if (problem) text = `${name} - ${problem.text}`;
  else {
    switch (e.kind) {
      case CHEM.base: {
        const still = rig?.stills.find((s) => s.base === key);
        const t = d.baseTemp(e);
        const fuel = e.slots?.find((s) => burnerTemp(s.item) !== null);
        const how = t === null ? 'no heat' : fuel && t === burnerTemp(fuel.item) ? `burning ${fuel.item === 'charcoal' ? 'charcoal' : 'fuel ethanol'}` : 'furnace';
        text = `${name} - set ${e.setC} C, ${t === null ? 'no hot furnace under it' : `${how}, holding ${Math.round(t)} C`}${still ? '' : ', no flask on it'}`;
        tempC = t;
        break;
      }
      case CHEM.reflux:
        text = `${name} - return ${Math.round((e.reflux ?? 0) * 100)}% (wrench cycles 0 / 50 / 75)`;
        break;
      case CHEM.filter: {
        const med = e.slots?.find((s) => s.count > 0);
        text = `${name} - ${contents}${med ? `, ${med.item} x${med.count}` : ', no medium'}${e.state === 'blocked' ? ', spent' : ''}`;
        break;
      }
      case CHEM.flask: {
        const word = e.state === 'working' ? 'boiling' : e.state === 'done' ? 'run done' : e.state === 'blocked' ? 'stopped' : 'not boiling';
        tempC = e.tempC ?? null;
        text = `${name} - ${contents}, ${Math.round(e.tempC ?? 20)} C, ${word}`;
        break;
      }
      case CHEM.vessel: {
        const word = e.state === 'working' ? 'fermenting' : e.state === 'done' ? 'done' : e.state === 'blocked' ? 'too sweet - add water' : rig?.sealed.has(key) ? 'waiting' : 'open (an Airlock Cap ferments it)';
        text = `${name} - ${contents}, ${word}`;
        break;
      }
      case CHEM.segment: {
        const still = rig?.stills.find((s) => s.segments.includes(key));
        const h = still ? still.segments.indexOf(key) + 1 : 0;
        text = still ? `${name} ${h} of ${still.segments.length}` : name;
        break;
      }
      case CHEM.condenser: {
        const still = rig?.stills.find((s) => s.head === key || s.draws.some((dr) => dr.condenser === key));
        const draw = still?.draws.find((dr) => dr.condenser === key);
        text = `${name} - ${still ? (draw ? `side cut at segment ${draw.h}` : 'head') : 'no vapour reaches it'}`;
        break;
      }
      default:
        text = CHEM_CAPACITY_L[e.kind] > 0 ? `${name} - ${contents}` : name;
    }
  }
  return { kind: 'chem', stage: e.state, text, progress: 0, secondsLeft: 0, drink: null, tempC };
}

/**
 * A chemistry port's fluid side: touching a flask or vessel it takes fluid in (expanded to its grade), touching a
 * receiver it gives what the receiver holds (named by its grade). Null when it touches neither.
 */
export function chemPortEndpoint(d: Distillery, x: number, y: number, z: number): FluidEndpoint | null {
  const port = d.entityAt(x, y, z);
  if (!port || port.kind !== CHEM.port) return null;
  let inlet: ChemEntity | null = null;
  let outlet: ChemEntity | null = null;
  for (const [dx, dy, dz] of [[0, -1, 0], [0, 1, 0], [0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]] as const) {
    const n = d.entityAt(x + dx, y + dy, z + dz);
    if (!n) continue;
    if (!inlet && (n.kind === CHEM.flask || n.kind === CHEM.vessel)) inlet = n;
    if (!outlet && n.kind === CHEM.receiver) outlet = n;
  }
  if (!inlet && !outlet) return null;
  return {
    entity: port,
    room: (fluid: FluidKey) => (inlet ? Math.max(0, CHEM_CAPACITY_L[inlet.kind] - total(inlet.mix)) * (fluid === 'steam' || fluid === 'lava' ? 0 : 1) : 0),
    fill(fluid: FluidKey, litres: number): number {
      if (!inlet || fluid === 'steam' || fluid === 'lava') return 0;
      const l = Math.min(litres, CHEM_CAPACITY_L[inlet.kind] - total(inlet.mix));
      if (!(l > 0)) return 0;
      pour(expand(fluid, l), inlet.mix, l);
      return l;
    },
    offer() {
      if (!outlet) return null;
      const name = nameOf(outlet.mix);
      return name ? { fluid: name as FluidKey, litres: total(outlet.mix) } : null;
    },
    drain(fluid: FluidKey, litres: number): number {
      if (!outlet || nameOf(outlet.mix) !== fluid) return 0;
      return pour(outlet.mix, {}, litres);
    },
  };
}
