/**
 * Veyra's advice (docs/api/npcs.md): where the player stands on the glass distillery's ladder, judged by what they carry. The ladder is
 * the process cards of src/content/recipesDistill.ts in order: syrup, wash, low wines, spirit, tincture, clear tincture, then essence.
 * Pure over a `has` test, so it needs no game.
 */
export const DISTILL_LADDER: readonly { item: string; next: string }[] = [
  { item: 'clear_tincture_beaker', next: 'Your tincture is clear. Now the finest work: an essence run in a vacuum cap, then an elixir in the reaction vessel with the clear tincture and a syrup. Look at the elixir cards in the recipe book.' },
  { item: 'tincture_beaker', next: 'You hold a tincture. Filter it: a filter bed, a pinch of charcoal and the colour comes out of it, leaving the clear tincture the elixirs need.' },
  { item: 'spirit_beaker', next: 'You have spirit. Macerate it with tea leaves in a reaction vessel at about sixty degrees for a tincture. Or rectify it in a column for fuel.' },
  { item: 'low_wines_beaker', next: 'Low wines in hand. Run them once more, at ninety-two degrees, in a boiling flask on a still base for spirit. Keep the heart of the run, not the head.' },
  { item: 'wash_beaker', next: 'You carry wash. Sixteen of them, boiled at ninety-seven degrees with a condenser and a receiver, give you a beaker of low wines. A long evening, but a clean one.' },
  { item: 'syrup_beaker', next: 'Syrup! Mix it with a pail of water in a reaction vessel with an airlock cap, hold it near twenty degrees, and let it ferment into wash.' },
  { item: 'glass_beaker', next: 'You have beakers. Boil four pine sap in a boiling flask on a still base at about one-thirty, with a coil and a receiver, for syrup. That is the first rung.' },
];

/** What Veyra tells a player who carries these things (`has` says whether the pack holds an item). */
export function alchemyAdvice(has: (item: string) => boolean): string {
  for (const r of DISTILL_LADDER) if (has(r.item)) return r.next;
  return 'You carry no glass yet. Forge glass beakers and a few vials first; everything I do begins with clean, empty glass. Then ask me again.';
}
