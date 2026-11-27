/**
 * Overheard gossip (docs/api/npcs.md): at set times of day two regulars who stand near each other trade a few lines as speech
 * bubbles over their heads. Nothing blocks and nothing is asked of the player; the lines tell a little of the tavern's own story
 * (and, now and then, hint at what the town is up to). Pure scheduling lives here; the manager owns the bubbles' clock.
 */
import { phaseOfTime, type Phase } from './dialogue';

/** Times of day (0 = dawn) a conversation may begin, once each per day. */
export const GOSSIP_SLOTS: readonly number[] = [0.04, 0.3, 0.52, 0.68, 0.84];
/** How long after its slot a conversation can still start (waiting for the pair to be close). */
export const SLOT_GRACE = 0.05;
/** Two people must stand within this many blocks of each other to talk. */
export const GOSSIP_RANGE = 7.5;
/** The player must be within this many blocks of both. */
export const HEAR_RANGE = 16;
export const BUBBLE_S = 4.2;
export const BUBBLE_GAP_S = 0.8;

export interface Exchange {
  id: string;
  a: string;
  b: string;
  /** Phases it suits (empty = any). */
  when: readonly Phase[];
  /** Who says what, in order (speaker is `a` or `b`). */
  lines: readonly (readonly ['a' | 'b', string])[];
}

export const EXCHANGES: readonly Exchange[] = [
  { id: 'stew', a: 'rosa', b: 'gruk', when: ['morning', 'day'], lines: [['a', 'Gruk, the stew pot is a third empty and I did not touch it.'], ['b', 'Gruk tasted it. For quality.'], ['a', 'Three times. For quality.'], ['b', 'It was a very big quality.']] },
  { id: 'tea-leaves', a: 'mara', b: 'rosa', when: ['morning', 'day', 'evening'], lines: [['a', 'The leaves say someone new will want a bed tonight.'], ['b', 'The leaves say that every night.'], ['a', 'And every night I am right about someone.']] },
  { id: 'latch', a: 'orrin', b: 'gruk', when: ['day', 'evening'], lines: [['a', 'If I move the hinge two fingers left, the door swings itself shut.'], ['b', 'Door already shuts. Gruk shuts it.'], ['a', 'Yes, but think how much less Gruk would have to do.'], ['b', 'Gruk likes shutting.']] },
  { id: 'owl', a: 'bram', b: 'rosa', when: ['evening', 'night'], lines: [['a', 'The owl was on the roof again. Looking at your bar, Rosa.'], ['b', 'Owls look at everything. It is a hobby.'], ['a', 'This one looked like it owed you money.']] },
  { id: 'chimney', a: 'orrin', b: 'mara', when: ['morning', 'day'], lines: [['a', 'Have you noticed the chimney draws better on days you hum?'], ['b', 'I do not hum.'], ['a', 'I have a chart.']] },
  { id: 'tab', a: 'rosa', b: 'bram', when: ['day', 'evening'], lines: [['a', 'Bram, your tab is longer than the bar.'], ['b', 'Is it? I thought it was my debt to the whole world, not just you.'], ['a', 'It is both. Pay the bar first.']] },
  { id: 'anvil', a: 'gruk', b: 'orrin', when: ['morning', 'day'], lines: [['a', 'Orrin makes clever things. Clever things break.'], ['b', 'Gruk makes strong things. Strong things are heavy.'], ['a', 'Heavy is good.'], ['b', 'Heavy is... fine. Heavy is fine.']] },
  { id: 'night-watch', a: 'gruk', b: 'rosa', when: ['night'], lines: [['a', 'Gruk heard the mites on the roof again.'], ['b', 'They sniff, they leave. They fear the ladle.'], ['a', 'Gruk fears the ladle.'], ['b', 'Good. Keep it that way.']] },
  { id: 'dream', a: 'rosa', b: 'bram', when: ['night', 'morning'], lines: [['a', 'I dreamed the well under the yard was singing.'], ['b', 'It does. Quietly. Only when the moss is damp.'], ['a', 'You could have told me.'], ['b', 'You could have listened sooner.']] },
  { id: 'festival', a: 'rosa', b: 'orrin', when: ['day', 'evening'], lines: [['a', 'When the season turns, I want the whole hall decked out.'], ['b', 'I can rig lanterns on a pulley.'], ['a', 'No pulleys. Lanterns on strings, like decent people.'], ['b', 'Strings can be on pulleys.']] },
  { id: 'layers', a: 'veyra', b: 'mara', when: ['morning', 'day'], lines: [['a', 'Mara, your tincture has separated again. Two layers, a clear line between.'], ['b', 'It is thinking. That is what the layers are.'], ['a', 'It is oil and water. Nothing is thinking.'], ['b', 'Then why does it look so smug?']] },
  { id: 'proof', a: 'rosa', b: 'veyra', when: ['day', 'evening'], lines: [['a', 'Veyra, whatever you did to the cooking wine, undo it.'], ['b', 'I rectified it. It is excellent now.'], ['a', 'Gruk set his sleeve alight tasting it.'], ['b', 'Then it is exactly as excellent as I said.']] },
  { id: 'glassware', a: 'orrin', b: 'veyra', when: ['day', 'evening'], lines: [['a', 'Could your flasks take a little pressure? A very little.'], ['b', 'Define a very little.'], ['a', 'Whatever the last one took, minus a bit.'], ['b', 'The last one took the ceiling. Decline.']] },
  { id: 'fumes', a: 'gruk', b: 'veyra', when: ['evening', 'night'], lines: [['a', 'Green smoke over your head again. Looks like a skull.'], ['b', 'It is vapour. It has no opinions.'], ['a', 'Skull has opinions. Gruk can tell.'], ['b', 'Do not stare at it. It is a draught.']] },
];

/** The slot whose window holds `tod` (0..1), or -1. */
export function slotAt(tod: number): number {
  for (let i = GOSSIP_SLOTS.length - 1; i >= 0; i--) if (tod >= GOSSIP_SLOTS[i] && tod < GOSSIP_SLOTS[i] + SLOT_GRACE) return i;
  return -1;
}

/** Exchanges that suit the phase and whose pair stand within range (distance by person id), most-fitting first by the rng. */
export function eligible(tod: number, dist: (a: string, b: string) => number, said: ReadonlySet<string>): Exchange[] {
  const ph = phaseOfTime(tod);
  const ok = EXCHANGES.filter((e) => (e.when.length === 0 || e.when.includes(ph)) && dist(e.a, e.b) <= GOSSIP_RANGE);
  const fresh = ok.filter((e) => !said.has(e.id));
  return fresh.length > 0 ? fresh : ok;
}

/** One running conversation: who is talking and the clock inside it. */
export interface Running {
  ex: Exchange;
  /** Index of the line now on show. */
  at: number;
  /** Seconds left on this line's bubble (negative = in the gap before the next). */
  left: number;
}

/** What each speaker's bubble shows now (the speaker of the current line only). */
export function bubbleOf(r: Running | null): { id: string; text: string } | null {
  if (!r || r.left <= 0) return null;
  const [who, text] = r.ex.lines[r.at];
  return { id: who === 'a' ? r.ex.a : r.ex.b, text };
}

/** Advances a conversation; returns null when it is over. */
export function advance(r: Running, dt: number): Running | null {
  let left = r.left - dt;
  let at = r.at;
  if (left <= -BUBBLE_GAP_S) {
    at++;
    if (at >= r.ex.lines.length) return null;
    left = BUBBLE_S;
  }
  return { ex: r.ex, at, left };
}
