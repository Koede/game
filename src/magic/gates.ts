/**
 * Recipes that research unlocks (docs/OVERHAUL_PLAN.md B.8). A recipe id not listed here is never gated. Derived from
 * the entries so there is one source of truth; `craftGateReason` is what crafting asks.
 */
import { RESEARCH } from './entries';
import { unlockedRecipes, type ResearchState } from './research';

export const RESEARCH_GATES: ReadonlyMap<string, string> = new Map(
  RESEARCH.flatMap((e) => (e.unlocks.recipes ?? []).map((r) => [r, e.key] as [string, string])),
);

export function craftGateReason(s: ResearchState, recipeId: string): string | null {
  const entry = RESEARCH_GATES.get(recipeId);
  if (!entry) return null;
  if (unlockedRecipes(s).has(recipeId)) return null;
  const title = RESEARCH.find((e) => e.key === entry)?.title ?? entry;
  return `Research "${title}" in your notebook first`;
}
