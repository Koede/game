/**
 * Pell, the wandering trader: arrives at dusk along the road with a lantern and a goat, sets up in the yard for three nights and
 * leaves at sunrise. This is the standing bank; each visit adds rumours that name real structures (trader.ts, traderBank).
 */
import type { PhraseBank } from './types';

export const TRADER: PhraseBank = {
  greet: [
    'Evening! Pell, trader, at your service. The goat is called Mr Wednesday. Do not ask.',
    'Ah, a face in the yard. Come and see what the road brought me this time.',
    'Welcome, welcome. Mind the lantern, it is hot and it is mine.',
    'You have a look of someone who needs something from far away. Good. So do I.',
  ],
  idle: [
    'I have walked a long way for these goods, so you will forgive me if I sound pleased with them.',
    'Mr Wednesday is eating your hedge. Do not mind him. He eats everybody\'s hedge.',
    'Three nights, then the road again. I never stay longer. Longer is how you get attached to a town, and then you never leave.',
    'Everything in the pack has a story. Most of the stories are about how I got it cheap.',
    'The lantern runs on oil and optimism. Mostly optimism.',
    'Coin is coin wherever I go. The price of bread is not, and that is the whole trade.',
    'A trader sees more of the world than a king. Kings have better hats, traders have better views.',
    'Sit if you like. The bench is a crate. The crate is honest about it.',
    'You want something rare? Look at the rare line. I do not show it to everyone.',
    'I will not haggle the price on the board. The board is the board. I am only the man who reads it.',
    'Rain on the road is the worst. Sun on the road is the second worst. I prefer evenings.',
    'Mr Wednesday has opinions about the wooden crate. I have not asked what they are.',
  ],
  morning: [
    'Sunrise is my cue. Three nights is my limit, and the road is calling.',
    'Good morning. I am still here, which is more than the weather can say.',
  ],
  evening: [
    'Dusk. The best hour for selling and the worst for walking. I chose it on purpose.',
    'The lantern goes on at dusk. Look up the road if you like. People used to come from there.',
  ],
  night: [
    'Night in the yard. Mr Wednesday is asleep, which means he is planning something.',
    'The stars look better over a yard than over a road. I have checked both.',
    'Cold? Stand nearer the lantern. It is hot, I did say.',
  ],
  rare: [
    'Between us, the rare stock is the best thing I carry. Do not tell the hermit.',
  ],
  farewell: [
    'Safe journey, friend. Come back when the road brings you past again.',
    'Keep the lantern lit. I will see you on the next dusk, if the road agrees.',
  ],
  hints: {},
};

/** Said when the want (what the trader asks for) is handed over. `{count}`, `{item}` and `{coin}` are filled in. */
export const TRADER_WANT_THANKS = [
  'Exactly what I was hoping for. {count} {item}, and here is {coin} coin for your trouble. A favour for a favour.',
  'Oh, well done. {count} {item}. That is {coin} coin, and I will remember who was kind.',
  'You found {count} {item} for me. Here, {coin} coin. Rarer than you think, out here.',
];

/** Said when the player holds the wanted item but not enough of it. `{count}`, `{item}` and `{have}` are filled in. */
export const TRADER_WANT_SHORT = [
  'I need {count} {item}, friend. You are holding {have}. Bring the lot and the price is better.',
  'Close! But {count} {item}, if you please. I am particular about counting.',
];

/** Said after a purchase from the stall is refused for want of room: nothing is given. */
export const TRADER_FULL = 'Your pack is full. Make room and ask me again. I will still be here, for a while.';

/** The rumour templates. `{place}` is the real name of a structure (src/world/structureDefs.ts). */
export const TRADER_RUMOURS: readonly string[] = [
  'I heard the {place} is still standing out past the ridge. Someone went looking for it last week and came back quiet.',
  'On the road in I passed a lamp burning by the {place}. Nobody lives there. The lamp does not care.',
  'They say the {place} hums on still nights. A man in the last town swore it sang to him, then asked me to sell him a rope.',
  'I sold a map to a boy who wanted to find the {place}. I hope he packed boots. The path is not kind.',
  'A caravan master told me the {place} is worth the walk, if you bring something it will want to trade for.',
  'Mind the {place} on the way out to the hills. The old wardens are still on their posts. Polite, but thorough.',
];
