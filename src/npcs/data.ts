/**
 * The three people of the starting tavern (docs/api/npcs.md). All adults, drawn as pixel sprites; they talk when used, give one
 * welcome gift each, and nudge the player along the first goals. Positions are tavern-local (see tavern.ts).
 */
export type NpcSprite = 'witch' | 'barkeep' | 'orc';

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  sprite: NpcSprite;
  /** Tavern-local block coordinates of the feet (x east, z south, y up from the floor). */
  at: readonly [number, number, number];
  /** Given once, the first time they are spoken to. */
  gift: readonly { item: string; count: number }[];
  giftLine: string;
  /** Said by the current goal id (the first sentence that matches), else the rotating `lines`. */
  byGoal: Readonly<Record<string, string>>;
  lines: readonly string[];
}

export const NPCS: readonly NpcDef[] = [
  {
    id: 'mara', name: 'Mara', title: 'Hedge witch', sprite: 'witch', at: [10, 1, 3],
    gift: [{ item: 'field_notebook', count: 1 }],
    giftLine: 'Take this notebook. Look hard at everything, then write it down: every thing you note teaches you a little more of how the world is made.',
    byGoal: {
      gather_logs: 'Start with wood, artificer. Everything you will ever build begins as something you chopped.',
      find_flint: 'Flint hides in gravel. Dig the gravel by hand if you must, and keep the wooden tools as your first, brittle friends.',
      place_furnace: 'A furnace is a heart you build yourself. Feed it, and it will keep you.',
      light_furnace: 'Hear that? Fire wants air. Pump it and it answers.',
    },
    lines: [
      'Essentia is the sweat of the world. Learn its names and you can ask it for things.',
      'Every great artificer began with a notebook and bad hands. You will be fine.',
      'Machines are only spells that learned to be patient.',
      'I read the old ruins like letters. Whoever built the Old Works was an artificer too.',
      'Bring me anything strange you find. I will tell you what it is afraid of.',
    ],
  },
  {
    id: 'rosa', name: 'Rosa', title: 'Barkeep', sprite: 'barkeep', at: [6, 1, 6],
    gift: [{ item: 'hearth_stew', count: 1 }],
    giftLine: 'On the house. Eat it by the fire; a cold artificer is a short-lived one.',
    byGoal: {
      get_warm: 'Stand near a hot furnace a while. Warmth sticks to you, and the night bites less.',
      cook_food: 'Cook your meat at the furnace. Raw is for the desperate.',
      eat_food: 'Eat when you are hungry, not when you are starving. Hear me?',
      first_brew: 'Tea needs a kettle, a cup and patience. My favourite recipe.',
    },
    lines: [
      'The nights are long and the mites are hungry. Come home to a fire.',
      'Everyone passes through here sooner or later. Gossip is my trade.',
      'The old workshop folk drank here once. They paid in bronze and bad poetry.',
      'Bring me spices, sugar, milk, and I will make you the best thing you ever tasted.',
      'A full mug and a warm seat. That is all anyone needs to restart a day.',
    ],
  },
  {
    id: 'gruk', name: 'Gruk', title: 'Orc smith', sprite: 'orc', at: [2, 1, 3],
    gift: [{ item: 'wooden_pickaxe', count: 1 }, { item: 'wooden_axe', count: 1 }],
    giftLine: 'Wooden tools. Weak, but they bite. Do not break them on anything good.',
    byGoal: {
      make_pickaxe: 'Flint, sticks, cord. Bind the head tight. A loose head is a broken hand.',
      collect_rubble: 'Rubble is stone that gave up. Pile it up; you will want a furnace.',
      make_bronze: 'Copper and tin together. Three to one. Bronze changes everything.',
      bronze_pickaxe: 'Bronze bites iron ore. Then we talk about real tools.',
    },
    lines: [
      'Orcs forge. Men build. Elves complain. You, I think, will do all three.',
      'Metal remembers every blow. Be patient with it.',
      'The automatons wake at night. Hit them with something heavy.',
      'I came for the ale. I stayed for the anvil.',
      'Strong arms are good. A strong furnace is better.',
    ],
  },
];

export const npcById = (id: string): NpcDef | undefined => NPCS.find((n) => n.id === id);
