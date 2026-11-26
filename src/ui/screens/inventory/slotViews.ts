/** How stored stacks look in the UI: the slot view (tool wear as a fraction) and the tooltip card. DOM-free. */
import { enchantDef, enchantLines, isEnchanted } from '../../../core/enchant';
import { itemOrNull, rarityOf } from '../../../core/registry';
import { dishEffect, dishLabel } from '../../../game/cookingQuality';
import { BOUNTY_CHANCE, MAGNET_RADIUS, TRAIL_S, VEIN_SIZE } from '../../../game/enchantEffects';
import { maxDurabilityOf } from '../../../game/inventory';
import { qualityEffect, qualityLabel } from '../../../game/toolQuality';
import type { TooltipCard } from '../../kit/feedback';
import { formatDuration, formatTemp, titleFromKey } from '../../kit/format';
import type { SlotView } from '../../kit/slot';
import { foodRows } from '../food';

/** The tooltip card of a stack: name, description, and what matters about it (wear, food, fuel, tool tier). */
type ViewStack = { item: string; count: number; durability?: number; enchants?: Record<string, number>; quality?: 1 | 2 };

/** The stack's display name with its quality in front: "Fine Iron Pickaxe", "Tasty Bread"; plain stacks keep the item name. */
export function stackName(stack: Pick<ViewStack, 'item' | 'quality'>): string {
  const base = itemOrNull(stack.item)?.name ?? titleFromKey(stack.item);
  const prefix = qualityLabel(stack) || dishLabel(stack);
  return prefix ? `${prefix} ${base}` : base;
}

/** What one enchant does at one level, in one short line ("6 more blocks of the vein"). Unknown keys give ''. */
export function enchantEffectLine(key: string, level: number): string {
  const at = (table: readonly number[]): number => table[Math.max(0, Math.min(level, table.length - 1))] ?? 0;
  switch (key) {
    case 'veinseeker':
      return `Breaks ${at(VEIN_SIZE)} more blocks of an ore vein`;
    case 'magnet':
      return `Drops fly to you from ${at(MAGNET_RADIUS)} blocks`;
    case 'ember':
      return 'Smelts what it breaks: ore to ingot, log to charcoal';
    case 'featherfall':
      return level >= 2 ? 'No fall damage; hold Jump to glide' : 'No fall damage while carried';
    case 'lightstep':
      return `A trail of light that lasts ${at(TRAIL_S)} s`;
    case 'bounty':
      return `${Math.round(at(BOUNTY_CHANCE) * 100)}% chance of an extra drop`;
    default: {
      const d = enchantDef(key)?.description ?? '';
      return d.split(/(?<=\.)\s/)[0] ?? '';
    }
  }
}

export function itemCard(stack: ViewStack): TooltipCard {
  const def = itemOrNull(stack.item);
  const rows: [string, string][] = [];
  if (stack.count > 1) rows.push(['Count', String(stack.count)]);
  if (def?.tool) {
    rows.push(['Tool', `${titleFromKey(def.tool.kind)}, tier ${def.tool.tier}`]);
    if (stack.durability !== undefined) rows.push(['Uses left', `${stack.durability} / ${maxDurabilityOf(stack.item, stack.quality) ?? def.tool.durability}`]);
  }
  const quality = qualityLabel(stack) ? qualityEffect(stack.quality) : dishEffect(dishLabel(stack) ? stack.quality : 0);
  if (quality) rows.push(['Quality', quality]);
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
  const lines = enchantLines(stack).map((l) => ({
    text: l.text,
    colour: l.colour,
    aspect: l.aspect,
    title: enchantDef(l.key)?.description,
    effect: enchantEffectLine(l.key, l.level),
  }));
  const rarity = rarityOf(stack.item);
  return { title: stackName(stack), body: def?.desc || undefined, rows, ...(lines.length > 0 ? { lines } : {}), ...(rarity !== 'common' ? { rarity } : {}) };
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
    name: itemOrNull(stack.item) ? stackName(stack) : undefined,
    ...(isEnchanted(stack) ? { enchanted: true } : {}),
    ...(rarityOf(stack.item) !== 'common' ? { rarity: rarityOf(stack.item) } : {}),
  };
}
