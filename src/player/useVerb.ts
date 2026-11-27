/**
 * The caption on the touch Use button: what a press does right now, so one button is not a guessing game. DOM-free and
 * cheap (a few property reads), so the game can ask every frame. It is a hint, not the rule: interaction.ts decides what
 * a Use really does, and this only names the most likely outcome in one short word that fits the button.
 */
import type { BlockDef, ItemDef } from '../core/types';
import { blockOfItem } from '../core/registry';
import { buildsOnto, screenFor } from './blockRules';

export type UseVerb = 'Use' | 'Open' | 'Eat' | 'Place' | 'Talk';

export interface UseAim {
  /** The block under the crosshair, or null (sky, or an animal is in front). */
  block: BlockDef | null;
  /** A person is under the crosshair. */
  person: boolean;
  /** An animal is under the crosshair. */
  animal: boolean;
  /** The held item, or null for empty hands. */
  held: ItemDef | null;
  /** The touch Place toggle is armed: the next Use places the held block. */
  placeArmed: boolean;
}

/** The one word the Use button shows for this aim. */
export function useVerb(a: UseAim): UseVerb {
  const placeable = a.held ? blockOfItem(a.held.key) !== null : false;
  if (a.placeArmed && placeable) return 'Place';
  if (a.person) return 'Talk';
  if (a.animal) return 'Use';
  const b = a.block;
  if (b && b.liquid === null && (b.shape === 'door' || screenFor(b, 0, 0, 0) !== null)) {
    // A building block held against a machine goes on the face aimed at (or opens the screen on its front): say nothing specific.
    return placeable && a.held && buildsOnto(blockOfItem(a.held.key)!) ? 'Use' : 'Open';
  }
  if (a.held?.food) return 'Eat';
  if (placeable && b && b.liquid === null) return 'Place';
  return 'Use';
}
