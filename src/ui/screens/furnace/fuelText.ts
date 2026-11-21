/** DOM-free fuel advice of the furnace screen: a hotter fuel stuck behind a cooler one, and how to reach a heat. */
import { DRAFT_FLAME_BONUS_C } from '../../../core/constants';
import { fuelOf, itemOrNull, ITEMS } from '../../../core/registry';
import type { Slot } from '../../../core/types';

const nameOf = (key: string): string => itemOrNull(key)?.name ?? key;
const flameOf = (item: string | null): number => (item ? fuelOf(item)?.flameTempC ?? 0 : 0);

/**
 * The firebox burns its slots in order. When a hotter fuel waits behind cooler ones (coke for steel behind a stack
 * of charcoal), say so: "Coke waits behind 14 Charcoal - take the charcoal out to burn hotter". Null otherwise.
 */
export function fuelQueueHint(burning: string | null, fuel: readonly Slot[]): string | null {
  let hottest = -1;
  fuel.forEach((s, i) => {
    if (s && (hottest < 0 || flameOf(s.item) > flameOf(fuel[hottest]?.item ?? null))) hottest = i;
  });
  const best = hottest >= 0 ? fuel[hottest] : null;
  if (!best) return null;
  const hot = flameOf(best.item);
  let ahead = 0;
  let cooler: string | null = null;
  for (let i = 0; i < hottest; i++) {
    const s = fuel[i];
    if (s && flameOf(s.item) < hot) {
      ahead += s.count;
      cooler ??= s.item;
    }
  }
  if (cooler === null) {
    // Nothing cooler queued ahead: only the item burning now is in the way, and it is gone soon.
    return null;
  }
  if (burning !== null && flameOf(burning) >= hot) return null;
  const name = nameOf(cooler);
  return `${nameOf(best.item)} waits behind ${ahead} ${name} - take the ${name.toLowerCase()} out to burn hotter`;
}

/** Fuels worth naming in advice: the real fuels and plain logs (one wood stands for all of them). */
const ADVICE_FUELS = ITEMS.filter((i) => i.fuel && !i.fuel.fuelReturns && (i.category === 'fuel' || i.key === 'oak_log'))
  .map((i) => ({ name: i.key === 'oak_log' ? 'logs' : i.name.toLowerCase(), flameC: i.fuel?.flameTempC ?? 0 }))
  .sort((a, b) => a.flameC - b.flameC);

/**
 * How to get a fire to `needC`: "coke, or coal with the bellows" (the coolest fuel that gets there on its own, and the
 * coolest that gets there with a full draft), plus electric heat where this furnace has it.
 */
export function heatRoute(needC: number, electric: boolean): string {
  const plain = ADVICE_FUELS.find((f) => f.flameC >= needC);
  const pumped = ADVICE_FUELS.find((f) => f.flameC < needC && f.flameC + DRAFT_FLAME_BONUS_C >= needC);
  const ways = [plain?.name, pumped ? `${pumped.name} with the bellows` : undefined, electric ? 'electric heat' : undefined].filter(
    (w): w is string => w !== undefined,
  );
  if (ways.length === 0) return 'a hotter furnace';
  return ways.join(', or ');
}
