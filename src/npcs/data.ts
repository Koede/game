/**
 * The people and props of the starting tavern (docs/api/npcs.md): five adults, a quest board and a wall clock. Positions are
 * tavern-local block coordinates (see tavern.ts). Phrase banks live in ./scripts.
 */
import { ARTIFICER } from './scripts/artificer';
import { BARKEEP } from './scripts/barkeep';
import { HERMIT } from './scripts/hermit';
import { ORC } from './scripts/orc';
import type { PhraseBank } from './scripts/types';
import { WITCH } from './scripts/witch';

export type NpcSprite = 'witch' | 'barkeep' | 'orc' | 'artificer' | 'hermit' | 'board' | 'clock';
export type NpcRole = 'witch' | 'barkeep' | 'orc' | 'artificer' | 'hermit' | 'board' | 'clock';

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  role: NpcRole;
  sprite: NpcSprite;
  /** 'prop' things are boards and clocks: no body, no companion. */
  kind: 'person' | 'prop';
  /** Tavern-local feet (people) or bottom-centre (props), blocks; may be fractional. */
  at: readonly [number, number, number];
  /** Sprite size multiplier (the orc is big). */
  scale: number;
  /** Given once, the first time they are spoken to. */
  gift: readonly { item: string; count: number }[];
  giftLine: string;
  bank: PhraseBank | null;
}

export const NPCS: readonly NpcDef[] = [
  {
    id: 'mara', name: 'Mara', title: 'Hedge witch', role: 'witch', sprite: 'witch', kind: 'person', at: [10, 1, 3], scale: 1,
    gift: [{ item: 'field_notebook', count: 1 }],
    giftLine: 'Take this notebook. Look hard at everything, then write it down: every thing you note teaches you a little more of how the world is made. Ask me about magic any time.',
    bank: WITCH,
  },
  {
    id: 'rosa', name: 'Rosa', title: 'Barkeep', role: 'barkeep', sprite: 'barkeep', kind: 'person', at: [6, 1, 6], scale: 1,
    gift: [{ item: 'hearth_stew', count: 1 }],
    giftLine: 'On the house. Eat it by the fire; a cold artificer is a short-lived one. Ask me about food and brewing.',
    bank: BARKEEP,
  },
  {
    id: 'gruk', name: 'Gruk', title: 'Orc smith', role: 'orc', sprite: 'orc', kind: 'person', at: [2, 1, 3], scale: 1.35,
    gift: [{ item: 'wooden_pickaxe', count: 1 }, { item: 'wooden_axe', count: 1 }],
    giftLine: 'Wooden tools. Weak, but they bite. Do not break them on anything good. And if you need an arm for a fight, coin talks.',
    bank: ORC,
  },
  {
    id: 'orrin', name: 'Orrin', title: 'Artificer', role: 'artificer', sprite: 'artificer', kind: 'person', at: [10, 1, 6], scale: 1,
    gift: [{ item: 'wrench', count: 1 }],
    giftLine: 'A wrench! Every artificer needs one. Ask me what to build next and I will point at the next rung of the ladder.',
    bank: ARTIFICER,
  },
  {
    id: 'bram', name: 'Old Bram', title: 'Hermit', role: 'hermit', sprite: 'hermit', kind: 'person', at: [7, 1, 11], scale: 1,
    gift: [],
    giftLine: '',
    bank: HERMIT,
  },
  {
    id: 'board', name: 'Quest board', title: 'Bounties', role: 'board', sprite: 'board', kind: 'prop', at: [3.5, 1.2, 1.15], scale: 1,
    gift: [], giftLine: '', bank: null,
  },
  {
    id: 'clock', name: 'Wall clock', title: 'Clock', role: 'clock', sprite: 'clock', kind: 'prop', at: [6.5, 3.1, 1.15], scale: 1,
    gift: [], giftLine: '', bank: null,
  },
];

export const npcById = (id: string): NpcDef | undefined => NPCS.find((n) => n.id === id);
