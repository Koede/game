/** How stored stacks look in the UI: the slot view (tool wear as a fraction) and the tooltip card. DOM-free. */
import { enchantDef, enchantLines, isEnchanted } from '../../../core/enchant';
import { itemOrNull, rarityOf } from '../../../core/registry';
import { fullDurability } from '../../../game/inventory';
import type { TooltipCard } from '../../kit/feedback';
import { formatDuration, formatTemp, titleFromKey } from '../../kit/format';
import type { SlotView } from '../../kit/slot';
import { foodRows } from '../food';

/** The tooltip card of a stack: name, description, and what matters about it (wear, food, fuel, tool tier). */
type ViewStack = { item: string; count: number; durability?: number; enchants?: Record<string, number> };

export function itemCard(stack: ViewStack): TooltipCard {
  const def = itemOrNull(stack.item);
  const rows: [string, string][] = [];
  if (stack.count > 1) rows.push(['Count', String(stack.count)]);
  if (def?.tool) {
    rows.push(['Tool', `${titleFromKey(def.tool.kind)}, tier ${def.tool.tier}`]);
    if (stack.durability !== undefined) rows.push(['Uses left', `${stack.durability} / ${def.tool.durability}`]);
  }
  if (def?.wear !== undefined && stack.durability !== undefined) {
    rows.push(stack.item === 'scribing_tools' ? ['Ink left', `${stack.durability} / ${def.wear}`] : ['Suction left', `${Math.round(stack.durability)} s / ${def.wear} s`]);
  }
  rows.push(...foodRows(stack.item));
  if (def?.fuel) {
    rows.push(['Burns for', formatDuration(def.fuel.burnS)]);
    rows.push(['Flame', formatTemp(def.fuel.flameTempC)]);
    const back = def.fuel.fuelReturns ? itemOrNull(def.fuel.fuelReturns) : null;
    if (back) rows.push(['Leaves', back.name]);
  }
  const lines = enchantLines(stack).map((l) => ({ text: l.text, colour: l.colour, aspect: l.aspect, title: enchantDef(l.key)?.description }));
  const rarity = rarityOf(stack.item);
  return { title: def?.name ?? titleFromKey(stack.item), body: def?.desc || undefined, rows, ...(lines.length > 0 ? { lines } : {}), ...(rarity !== 'common' ? { rarity } : {}) };
}

/** The DOM side: drives ItemSlots from inventories and turns their taps into SlotInteraction calls. */

/** How a stored stack is shown in a slot (tool wear as a 0..1 fraction). */
export function slotView(stack: ViewStack | null | undefined): SlotView | null {
  if (!stack) return null;
  const full = stack.durability !== undefined ? fullDurability(stack.item) : undefined;
  return {
    item: stack.item,
    count: stack.count,
    durability: full && stack.durability !== undefined ? stack.durability / full : undefined,
    name: itemOrNull(stack.item)?.name,
    ...(isEnchanted(stack) ? { enchanted: true } : {}),
    ...(rarityOf(stack.item) !== 'common' ? { rarity: rarityOf(stack.item) } : {}),
  };
}
