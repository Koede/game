/**
 * What the town says about the wider world: the age the player has reached, a storm, a boiler warning (docs/api/npcs.md, "Reactions").
 * Pure phrase tables and pickers; the manager decides when to say them. Ages are the furnace ages (1 bronze .. 5 star).
 */
import type { PersonId } from './contentment';

/** One thing each person says the first time they are spoken to after the player reaches an age. Keyed by age index (1..5). */
export const AGE_TALK: Readonly<Record<PersonId, Readonly<Record<number, string>>>> = {
  orrin: {
    1: 'Bronze! A hot furnace and a steady hand. Gears next, I think. Shafts and cogs do half the building for you.',
    2: 'Iron. Real iron. I have not smelled coke smoke like that since the old workshop. Steam is the next door.',
    3: 'Current! I can feel it in the fillings of my teeth. Wire every hall, and mind the sparks.',
    4: 'Circuits. You are building things I only drew on napkins. Do not let the reactor out of your sight.',
    5: 'A star in a cellar. I was wrong about the limit; I am glad to be wrong.',
  },
  rosa: {
    1: 'Bronze pots, bronze spoons. The stew tastes the same, but it looks grander.',
    2: 'Iron skillets at last! Everything fries better, and I will not hear otherwise.',
    3: 'A lamp that never gutters. The late drinkers will never go home now.',
    4: 'Folk walk in here talking about atoms. I pour them the same ale, mind.',
    5: 'Night has stopped meaning much. Come in, sit down, drink something warm.',
  },
  gruk: {
    1: 'Bronze edge. Better. Still not iron, but better.',
    2: 'Iron! Now we talk. Bring me ore and a hot fire and I will show you what an anvil is for.',
    3: 'Machines that hit harder than me. I should be offended. I am mostly impressed.',
    4: 'Hum in the walls. My ears hurt. Good work, though.',
    5: 'Gruk saw a sun made in a room. Gruk does not know what to say.',
  },
  mara: {
    1: 'The air smells different around the furnace now. Hot metal sings to the old lines. Listen when you can.',
    2: 'The forge has changed the earth under the town. I can feel it when I walk the hedge.',
    3: 'Current runs like a river, and rivers have moods. Keep your wires dry.',
    4: 'Something in the walls of the world is thinner now. Be careful what you split.',
    5: 'You made a star. The old stories said that took a god. Perhaps they meant a patient builder.',
  },
  bram: {
    1: 'More noise from your corner of the world. I liked it better quiet. A little.',
    2: 'Smoke on the wind from the south. Iron, is it? Hmph. Good.',
    3: 'Buzzing wires. Do not run any past my window, hear me?',
    4: 'I do not understand it, but nothing has blown up yet. That is something.',
    5: 'I have seen a lot of sunrises. I did not expect a new one.',
  },
  veyra: {
    1: 'Bronze catalyses nothing, but it stains beautifully. Try copper in the still sometime.',
    2: 'Iron salts, a hot forge, fine glass. You are making the world I wanted to study.',
    3: 'Do you know what an electric still could do? I do. Please build me one.',
    4: 'Radioactive decay is just slow alchemy. I find that comforting.',
    5: 'Transmutation, at last, and with a star for a crucible. I may faint.',
  },
};

/** The line for `person` at `age`: the exact age's line, else the nearest earlier one, else null. */
export function ageTalk(person: PersonId, age: number): { age: number; text: string } | null {
  for (let a = Math.floor(age); a >= 1; a--) {
    const t = AGE_TALK[person]?.[a];
    if (t) return { age: a, text: t };
  }
  return null;
}

export type DisasterKind = 'boiler' | 'chimney' | 'storm';
export type DisasterLevel = 'watch' | 'warning' | 'imminent' | 'struck' | 'averted';

/** What a resident shouts. Only the loud levels get a line: a watch is for the HUD, not the town. */
export const DISASTER_SHOUTS: Readonly<Record<DisasterKind, Partial<Record<DisasterLevel, readonly string[]>>>> = {
  boiler: {
    warning: ['That boiler is hissing wrong! Somebody check the gauge!', 'Pressure is climbing in the boiler. Open a vent, quickly!'],
    imminent: ['Get away from the boiler! It is about to go!', 'Back, everyone back! The boiler is screaming!'],
    struck: ['The boiler! Is everyone out?'],
    averted: ['Phew. Pressure is down. Whoever fixed that, thank you.'],
  },
  chimney: {
    warning: ['Smoke is coming back down the chimney. Something is blocked.', 'That flue is not drawing. Clear it before the room fills.'],
    imminent: ['The chimney is about to catch! Water, anyone?'],
    struck: ['Chimney fire! Keep low, get out!'],
    averted: ['Flue is clear again. Good. I can breathe.'],
  },
  storm: {
    warning: ['A storm is coming. Bring in what you can and mind the high places.', 'Lightning on the way. Keep clear of the metal.'],
    imminent: ['It is right on top of us! Get under cover!'],
    struck: ['That one hit close. Everyone all right?'],
    averted: ['It passed over. We were lucky.'],
  },
};

export function disasterShout(kind: DisasterKind, level: DisasterLevel, rng: () => number): string | null {
  const pool = DISASTER_SHOUTS[kind]?.[level];
  if (!pool || pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** Said once when bad weather starts (in the open air only; the manager decides who hears it). */
export const WEATHER_TALK: Readonly<Record<'rain' | 'storm', readonly string[]>> = {
  rain: ['Rain again. Good for the crops, bad for the washing.', 'Smells like rain. Hang the laundry in, someone.'],
  storm: ['Dark clouds rolling in. Stay indoors tonight.', 'That sky means a storm. I am staying under a roof.'],
};

export function weatherTalk(kind: string, rng: () => number): string | null {
  if (kind !== 'rain' && kind !== 'storm') return null;
  const pool = WEATHER_TALK[kind];
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}
