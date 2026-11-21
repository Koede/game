/**
 * DOM-free helpers of the STRUCTURE tab (spec 17.4): the ghost preview's payload, checklist and material texts, the
 * target picker's size steppers, what the hearth means for the furnace, and the tier-1 introduction.
 */
import type { GameEvents } from '../../../core/gameEvents';
import { furnaceTier, itemOrNull, recipesFor } from '../../../core/registry';
import type { FurnaceView, MaterialRow, StructureCheck, StructureView, TierChoice } from '../../../sim';

export type GhostPayloadCell = GameEvents['ghost:show']['cells'][number];
export type Axis = 0 | 1 | 2;

/** The key of a furnace's ghost preview (showing it again replaces it). */
export const ghostKey = (x: number, y: number, z: number): string => `hearth:${x},${y},${z}`;

/** The cells the renderer draws: blue where a block is missing, red where the wrong one stands. */
export function ghostCells(view: StructureView): GhostPayloadCell[] {
  const out: GhostPayloadCell[] = [];
  for (const c of view.target.cells) {
    if (c.state !== 'ok') out.push({ x: c.x, y: c.y, z: c.z, block: c.want, state: c.state });
  }
  return out;
}

const itemName = (key: string): string => itemOrNull(key)?.name ?? key;

/** "Floor 8/9", "Ceiling 9/9", "Inside empty" / "Inside: 2 blocks in the way", "Electrodes 0/1". */
export function checkText(c: StructureCheck): string {
  if (c.key === 'interior') {
    const blocked = c.need - c.have;
    return blocked <= 0 ? 'Inside empty' : `Inside: ${blocked} block${blocked === 1 ? '' : 's'} in the way`;
  }
  return `${c.label} ${c.have}/${c.need}`;
}

/** The short name on the tier picker: "Blast", "Arc", "Plasma", "Star". */
export const tierShort = (choice: Pick<TierChoice, 'name'>): string => choice.name.replace(/ ?hearth$/i, '').replace(/^Starhearth$/, 'Star');

export const AXIS_LABEL: Readonly<Record<Axis, string>> = { 0: 'Across', 1: 'Deep', 2: 'High' };

/** Inclusive bounds of one inside dimension for a tier ([across, deep, high] = the table's [x, z, y]). */
export function innerBounds(choice: Pick<TierChoice, 'minInner' | 'maxInner'>, axis: Axis): [number, number] {
  return [choice.minInner[axis], choice.maxInner[axis]];
}

/** The inside after one stepper tap, clamped to the tier's bounds. */
export function stepInner(
  inner: readonly [number, number, number], choice: Pick<TierChoice, 'minInner' | 'maxInner'>, axis: Axis, delta: number,
): [number, number, number] {
  const next: [number, number, number] = [inner[0], inner[1], inner[2]];
  const [lo, hi] = innerBounds(choice, axis);
  next[axis] = Math.max(lo, Math.min(hi, next[axis] + delta));
  return next;
}

/** "3x3x2" */
export const sizeText = (inner: readonly number[]): string => inner.join('x');

/** One line on what the tier asks for: "Brick walls, inside 1x1x1 to 3x3x3, open top allowed". */
export function tierRules(choice: TierChoice): string {
  const parts = [`${itemName(choice.wall)} walls`, `inside ${sizeText(choice.minInner)} to ${sizeText(choice.maxInner)}`];
  parts.push(choice.ceiling === 'required' ? 'a ceiling' : 'open top allowed');
  if (choice.electrodes > 0) parts.push(`${choice.electrodes} Arc Electrode${choice.electrodes === 1 ? '' : 's'} in the ceiling`);
  if (choice.ports > 0) parts.push(`${choice.ports} Power Ports in the walls`);
  return parts.join(', ');
}

/** "14/16 placed" and the have/need of what is still to place. */
export function materialTexts(row: MaterialRow): { placed: string; have: string } {
  return {
    placed: `${row.placed}/${row.need} placed`,
    have: row.missing === 0 ? 'All placed' : `Have ${row.have} / need ${row.missing}`,
  };
}

/** Tone of the status chip. */
export function statusTone(view: Pick<StructureView, 'formed' | 'controllerTier' | 'effectiveTier'>): 'good' | 'warn' | 'neutral' {
  if (view.formed) return view.effectiveTier >= view.controllerTier ? 'good' : 'warn';
  return view.controllerTier >= 2 ? 'warn' : 'neutral';
}

/** What the hearth means for the furnace right now, in one sentence. */
export function effectText(view: Pick<StructureView, 'formed' | 'tier' | 'name' | 'controllerTier' | 'effectiveTier'>): string {
  const own = furnaceTier(view.controllerTier).name;
  const runs = furnaceTier(Math.max(1, view.effectiveTier)).name;
  const needed = furnaceTier(Math.min(5, Math.max(2, view.controllerTier)));
  if (view.controllerTier <= 1) {
    return view.formed && view.name
      ? `The ${view.name} stands: the furnace can now be upgraded (header button).`
      : 'A Clay Furnace stands alone. Build a hearth around it to upgrade it.';
  }
  if (view.effectiveTier >= view.controllerTier) return `Runs at full strength as the ${own}.`;
  const hearth = needed.name.replace(/ Furnace$/, ' hearth');
  if (!view.formed) return `No ${hearth} yet - the ${own} runs like a ${runs}.`;
  return `The ${view.name ?? 'hearth'} holds it back - the ${own} runs like a ${runs} until its ${hearth} forms.`;
}

/** The Structure tab badge: "!" while the furnace needs a hearth it does not have. */
export function structureBadge(view: Pick<FurnaceView, 'tier' | 'effectiveTier'>): string | null {
  return view.tier >= 2 && view.effectiveTier < view.tier ? '!' : null;
}

/** How the first hearth's wall block is made, from the recipes: "Forge it here at 400 °C from 4 Firebrick". */
export function wallSource(wall: string): string {
  const r = recipesFor(wall).find((x) => x.station === 'furnace');
  if (!r) return '';
  const inputs = r.inputs.map((i) => `${i.count} ${itemName(i.item)}`).join(' and ');
  const out = r.output.count > 1 ? ` (makes ${r.output.count})` : '';
  return `Forge ${itemName(wall)} here at ${r.minTempC} °C from ${inputs}${out}.`;
}

/** The tier-1 introduction: what a hearth is and how to start the Blast hearth. */
export function hearthIntro(): { title: string; lines: string[] } {
  return {
    title: 'What is a hearth?',
    lines: [
      'A hearth is a hollow box of wall blocks with this furnace set into one wall. A bigger fire lives inside it: hotter, more crucibles, faster smelting.',
      'Start with the Blast hearth: brick walls around the furnace. Lay a floor under it, wall in the space behind the furnace (its front faces out, the block behind it is the inside). An open top is fine.',
      wallSource('brick'),
      'Tap "Show in world" below: blue cubes mark where each brick goes, red ones a block in the way.',
    ].filter((l) => l !== ''),
  };
}
