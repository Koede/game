/**
 * Friendship (docs/api/npcs.md): each person has a trust value 0..TRUST_MAX. Use with a liked item in hand gives it to them
 * (one gift a day each); a gift adds GIFT_TRUST. Reaching a tier pays that person's reward once and opens warmer lines.
 */
export const TRUST_MAX = 100;
export const GIFT_TRUST = 8;
/** Trust at which each tier starts. */
export const TIERS = [20, 50, 80] as const;
export const TIER_NAMES = ['stranger', 'friendly', 'close', 'confidant'] as const;

/** Items each person likes. Giving one is the only way to raise trust. */
export const LIKES: Readonly<Record<string, readonly string[]>> = {
  mara: ['glass_vial', 'vial_clarity', 'vial_mind', 'wildberries', 'glowcap', 'scribing_tools'],
  rosa: ['bread', 'wildberries', 'hearth_stew', 'cheese', 'honey', 'honey_cake', 'glowcap'],
  gruk: ['coal', 'iron_ingot', 'bronze_ingot', 'bone', 'copper_ingot'],
  orrin: ['copper_ingot', 'glass', 'bronze_ingot', 'iron_ingot', 'tin_ingot'],
  veyra: ['glass_vial', 'glass_beaker', 'charcoal', 'sulfur', 'tincture_beaker', 'clear_tincture_beaker', 'spirit_beaker'],
  bram: ['bone', 'glowcap', 'wildberries', 'honey', 'raw_perch'],
};

export interface TierReward { item: string; count: number; line: string }
/** Paid once each, when trust first reaches tiers[0], tiers[1], tiers[2] (a missing entry pays nothing). */
export const REWARDS: Readonly<Record<string, readonly (TierReward | null)[]>> = {
  mara: [{ item: 'glass_vial', count: 3, line: 'Here, take these. I blow too many.' }, { item: 'sanity_soap', count: 2, line: 'Scrub well. The deep work leaves marks on a mind.' }, { item: 'vein_lens', count: 1, line: 'My own lens. It sees the veins in stone the way I see them in people.' }],
  rosa: [{ item: 'hearth_stew', count: 2, line: 'Eat. You look thin. Do not argue.' }, { item: 'hearth_stew', count: 4, line: 'A proper meal for a proper regular.' }, { item: 'sugar_cake', count: 3, line: 'The good cake, the one I keep for family. Do not tell the others.' }],
  gruk: [{ item: 'coal', count: 6, line: 'Fuel. For the good fire.' }, { item: 'iron_ingot', count: 4, line: 'Gruk saved this. Make something strong.' }, { item: 'iron_maul', count: 1, line: 'Clan gets a clan maul. Gruk made it himself.' }],
  orrin: [{ item: 'copper_ingot', count: 3, line: 'Spares from the bench. Make something clever.' }, { item: 'iron_ingot', count: 3, line: 'Do not tell the others I was this generous.' }, { item: 'engineer_goggles', count: 1, line: 'My second pair. They show you what a machine is thinking.' }],
  veyra: [{ item: 'glass_beaker', count: 4, line: 'Spare glass. Do not drop it; I count my beakers.' }, { item: 'charcoal', count: 6, line: 'Activated, more or less. It will clean a tincture nicely.' }, { item: 'vial_clarity', count: 3, line: 'Clarity, bottled. Use it where the work needs a clear head.' }],
  bram: [{ item: 'glowcap', count: 4, line: 'Found these. Too many for me.' }, { item: 'treasure_map', count: 1, line: 'Where the good stones are. One day I said. Today.' }, { item: 'treasure_map', count: 2, line: 'And the owl\'s tree. Both maps are yours. Dig well.' }],
};

/** Warmer lines for each tier above stranger (index 0 = friendly). */
export const FRIEND_LINES: Readonly<Record<string, readonly (readonly string[])[]>> = {
  mara: [
    ['You always notice the small things. I like that in a person.', 'Sit by the fire a while. The notebook can wait.'],
    ['I would trust you with a door I had not locked.', 'The deep aspects frighten me less when you are near.'],
    ['I have not said a true thing aloud in years. You get them all.'],
  ],
  rosa: [
    ['There is a stool by the bar with your name on it now.', 'I saved you the end of the loaf.'],
    ['You are family. I do not say that often.', 'Whatever you need from the kitchen, it is yours.'],
    ['This place was a ruin when I came. You make it feel like a home.'],
  ],
  gruk: [
    ['You hit things well. Gruk approves.', 'Your pickaxe sounds better than most.'],
    ['Gruk will stand behind you. Not many get that.', 'My cousins would like you. They like nobody.'],
    ['You are clan.'],
  ],
  orrin: [
    ['Your ideas are less bad than I feared.', 'Come and see the bench. I rarely say that.'],
    ['I have drawn a few diagrams with you in mind.', 'Between us, the Rune Desk was nearly your idea.'],
    ['Finally, someone who reads the margins.'],
  ],
  veyra: [
    ['Your glass is cleaner than it was. I am noting it, not praising it.', 'You listen to the end of an explanation. Rarer than you would think.'],
    ['I would let you hold a flask at full boil. That is not a small thing.', 'Sit. I will show you the good bench, the one with the level top.'],
    ['I have written your name in the margin of my best recipe. In ink.'],
  ],
  bram: [
    ['You are quieter than most. Good.', 'The moss on the north wall tells me you are all right.'],
    ['I will tell you where the good stones are, one day.', 'Do not tell the others, but I like it when you come.'],
    ['You are the only one I have told about the owl.'],
  ],
};

export const tierOf = (trust: number): number => TIERS.filter((t) => trust >= t).length;
export const likes = (id: string, item: string): boolean => LIKES[id]?.includes(item) ?? false;
