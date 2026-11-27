/** How stored stacks look in the UI: the slot view (tool wear as a fraction) and the tooltip card. DOM-free. */
import { enchantDef, enchantLines, isEnchanted } from '../../../core/enchant';
import { BINDINGS, HANDLES, HEADS, partsOfItem } from '../../../content/toolParts';
import { blockOrNull, fluidInBucket, itemOrNull, machineOfBlock, rarityOf } from '../../../core/registry';
import { maxDurabilityOf } from '../../../game/inventory';
import { QUALITY_NAME, repairMaterial } from '../../../game/toolQuality';
import type { TooltipCard } from '../../kit/feedback';
import { formatDuration, formatJoules, formatTemp, formatWatts, titleFromKey } from '../../kit/format';
import type { SlotView } from '../../kit/slot';
import { foodRows } from '../food';

/** The tooltip card of a stack: name, description, and what matters about it (wear, food, fuel, tool tier). */
type ViewStack = { item: string; count: number; durability?: number; quality?: 1 | 2; enchants?: Record<string, number> };

import { cardRows } from '../../../game/itemLookup';
/** What a placed machine would do, from its spec: the rows a player needs to plan power before building anything. */
export function machineRows(item: string): [string, string][] {
  const block = blockOrNull(item);
  const spec = block ? machineOfBlock(block) : null;
  // The kerosene lamp is typed a generator but never feeds a network: its outputW is a placeholder.
  if (!spec || spec.kind === 'kerosene_lamp') return [];
  const rows: [string, string][] = [];
  if (spec.role === 'storage') {
    if (spec.capacityJ) rows.push(['Stores', formatJoules(spec.capacityJ)]);
    if (spec.rateW) rows.push(['Charges and gives', `up to ${formatWatts(spec.rateW)}`]);
  } else {
    if (spec.outputW) rows.push(['Makes', `up to ${formatWatts(spec.outputW)}`]);
    if (spec.drawW) rows.push(['Draws', formatWatts(spec.drawW)]);
  }
  if (spec.fluids?.capacityL) rows.push(['Holds', `${spec.fluids.capacityL} L`]);
  else if (spec.slots && spec.role !== 'generator') rows.push(['Slots', String(spec.slots)]);
  return rows;
}

export function itemCard(stack: ViewStack): TooltipCard {
  const def = itemOrNull(stack.item);
  const rows: [string, string][] = [];
  if (stack.count > 1) rows.push(['Count', String(stack.count)]);
  if (def?.tool) {
    rows.push(['Tool', `${titleFromKey(def.tool.kind)}, tier ${def.tool.tier}`]);
    const build = partsOfItem(stack.item);
    if (build) rows.push(['Built from', `${HEADS[build.head].name} head, ${HANDLES[build.handle].name.toLowerCase()} handle, ${BINDINGS[build.binding].name.toLowerCase()} binding`]);
    if (def.tool.speed > 1) rows.push(['Mining speed', String(def.tool.speed)]);
    if (def.weapon) rows.push(['Damage', String(def.weapon.damage)]);
    if (stack.quality) rows.push(['Quality', QUALITY_NAME[stack.quality]]);
    if (stack.durability !== undefined) rows.push(['Uses left', `${stack.durability} / ${maxDurabilityOf(stack.item, stack.quality) ?? def.tool.durability}`]);
    const mend = repairMaterial(stack.item);
    if (mend) rows.push(['Repairs with', `${itemOrNull(mend)?.name ?? titleFromKey(mend)}, at an anvil`]);
  }
  if (def?.armour) {
    const a = def.armour;
    if (a.reduction > 0) rows.push(['Protection', `Blocks ${Math.round(a.reduction * 100)}% of automaton hits`]);
    if (a.warmthDrainMult !== undefined && a.warmthDrainMult < 1) rows.push(['Warmth', `Cold drains ${Math.round((1 - a.warmthDrainMult) * 100)}% slower`]);
  }
  if (def?.wear !== undefined && stack.durability !== undefined) {
    rows.push(stack.item === 'scribing_tools' ? ['Ink left', `${stack.durability} / ${def.wear}`] : ['Suction left', `${Math.round(stack.durability)} s / ${def.wear} s`]);
  }
  rows.push(...machineRows(stack.item));
  const bucket = fluidInBucket(stack.item);
  if (bucket) rows.push(['Holds', `${bucket.name}, 1000 L (one bucket)`]);
  rows.push(...foodRows(stack.item));
  if (def?.fuel) {
    rows.push(['Burns for', formatDuration(def.fuel.burnS)]);
    rows.push(['Flame', formatTemp(def.fuel.flameTempC)]);
    const back = def.fuel.fuelReturns ? itemOrNull(def.fuel.fuelReturns) : null;
    if (back) rows.push(['Leaves', back.name]);
  }
  rows.push(...cardRows(stack.item));
  const lines = enchantLines(stack).map((l) => ({ text: l.text, colour: l.colour, aspect: l.aspect, title: enchantDef(l.key)?.description }));
  const rarity = rarityOf(stack.item);
  const name = def?.name ?? titleFromKey(stack.item);
  return { title: stack.quality && def?.tool ? `${QUALITY_NAME[stack.quality]} ${name}` : name, body: def?.desc || undefined, rows, ...(lines.length > 0 ? { lines } : {}), ...(rarity !== 'common' ? { rarity } : {}) };
}

/** The DOM side: drives ItemSlots from inventories and turns their taps into SlotInteraction calls. */

/** How a stored stack is shown in a slot (tool wear as a 0..1 fraction). */
export function slotView(stack: ViewStack | null | undefined): SlotView | null {
  if (!stack) return null;
  const full = stack.durability !== undefined ? maxDurabilityOf(stack.item, stack.quality) : undefined;
  return {
    item: stack.item,
    count: stack.count,
    durability: full && stack.durability !== undefined ? stack.durability / full : undefined,
    name: itemOrNull(stack.item)?.name,
    ...(isEnchanted(stack) ? { enchanted: true } : {}),
    ...(rarityOf(stack.item) !== 'common' ? { rarity: rarityOf(stack.item) } : {}),
  };
}
