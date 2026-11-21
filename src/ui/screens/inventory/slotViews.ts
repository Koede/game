/** How stored stacks look in the UI: the slot view (tool wear as a fraction) and the tooltip card. DOM-free. */
import { itemOrNull } from '../../../core/registry';
import { fullDurability } from '../../../game/inventory';
import type { TooltipCard } from '../../kit/feedback';
import { formatDuration, formatTemp, titleFromKey } from '../../kit/format';
import type { SlotView } from '../../kit/slot';
import { foodRows } from '../food';

/** The tooltip card of a stack: name, description, and what matters about it (wear, food, fuel, tool tier). */
export function itemCard(stack: { item: string; count: number; durability?: number }): TooltipCard {
  const def = itemOrNull(stack.item);
  const rows: [string, string][] = [];
  if (stack.count > 1) rows.push(['Count', String(stack.count)]);
  if (def?.tool) {
    rows.push(['Tool', `${titleFromKey(def.tool.kind)}, tier ${def.tool.tier}`]);
    if (stack.durability !== undefined) rows.push(['Uses left', `${stack.durability} / ${def.tool.durability}`]);
  }
  if (def?.wear !== undefined && stack.durability !== undefined) rows.push(['Suction left', `${Math.round(stack.durability)} s / ${def.wear} s`]);
  rows.push(...foodRows(stack.item));
  if (def?.fuel) {
    rows.push(['Burns for', formatDuration(def.fuel.burnS)]);
    rows.push(['Flame', formatTemp(def.fuel.flameTempC)]);
    const back = def.fuel.fuelReturns ? itemOrNull(def.fuel.fuelReturns) : null;
    if (back) rows.push(['Leaves', back.name]);
  }
  return { title: def?.name ?? titleFromKey(stack.item), body: def?.desc || undefined, rows };
}

/** The DOM side: drives ItemSlots from inventories and turns their taps into SlotInteraction calls. */

/** How a stored stack is shown in a slot (tool wear as a 0..1 fraction). */
export function slotView(stack: { item: string; count: number; durability?: number } | null | undefined): SlotView | null {
  if (!stack) return null;
  const full = stack.durability !== undefined ? fullDurability(stack.item) : undefined;
  return {
    item: stack.item,
    count: stack.count,
    durability: full && stack.durability !== undefined ? stack.durability / full : undefined,
    name: itemOrNull(stack.item)?.name,
  };
}
