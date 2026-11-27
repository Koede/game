/**
 * Research scrolls (docs/api/magic.md): hidden research that no board shows. Each is found one of two ways: as a scroll item
 * in the deep ruins' crates (Use it to read it), or by scanning a particular thing for the first time. A found scroll adds a
 * flag to the research state (`found:<id>` and its effect flag) and a little lore. Effects live in magic.ts. Pure data.
 */
import type { Aspects } from './aspects';

export interface ScrollSpec {
  id: string;
  /** The scroll item. */
  item: string;
  title: string;
  text: string;
  /** The flag it switches on (checked with `hasFlag`). */
  flag: string;
  /** Things whose first scan uncovers it. */
  scan: readonly string[];
  /** Lore it teaches on being found. */
  lore: Aspects;
}

export const SCROLLS: readonly ScrollSpec[] = [
  {
    id: 'ledger', item: 'scroll_ledger', title: 'The Whisper Ledger', flag: 'warp_ease', scan: ['rubble'], lore: { rift: 2, ward: 2 },
    text: 'A cracked ledger of someone who listened too long. It tells how to let the whispers drain: every two minutes a point of warp slips away on its own.',
  },
  {
    id: 'verses', item: 'scroll_verses', title: 'Dowsing Verses', flag: 'long_sight', scan: ['glass'], lore: { mind: 2, gale: 2 },
    text: 'Verses sung over a still pool. With them in mind the rod reading finds wellsprings five chunks away instead of three.',
  },
  {
    id: 'margin', item: 'scroll_margin', title: "The Alchemist's Margin", flag: 'sound_pot', scan: ['crucible'], lore: { cinder: 2, clarity: 2 },
    text: 'Notes scrawled round the rim of a pot. Tainted air no longer sours what a crucible gives: it yields as if the air were calm.',
  },
];

export const scrollById = (id: string): ScrollSpec | null => SCROLLS.find((s) => s.id === id) ?? null;
export const scrollOfItem = (item: string | null | undefined): ScrollSpec | null => SCROLLS.find((s) => s.item === item) ?? null;
export const foundFlag = (id: string): string => `found:${id}`;
