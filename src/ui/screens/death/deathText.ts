/**
 * The death screen's words for a death by an automaton (spec 19.4: "Felled by a Forge Warden"): the headline from
 * src/game's killerLine and a line on how to read that automaton's telegraph next time. DOM-free.
 */
import type { DamageCause } from '../../../core/gameEvents';
import { killerLine } from '../../../game/combat';

/** How to see each automaton's attack coming, keyed by species. */
export const AUTOMATON_TIPS: Readonly<Record<string, string>> = {
  cinder_mite: 'Cinder Mites hunt in twos and threes from dark places. Torches and lamps keep them from gathering near you.',
  forge_warden: 'A Forge Warden raises its hammer before it falls: step back then. Its shield arm halves blows from the front - strike from the side.',
  kiln_sentry: 'A Kiln Sentry\'s vent glows brighter just before it fires. Keep a wall between you, or close in between shots.',
  bellows_hound: 'A Bellows Hound crouches and flares its vents, then charges in a straight line: step aside as it crouches.',
  arc_drone: 'An Arc Drone crackles before it zaps, and the jolt doubles if you stand in water. Break its line of sight.',
  slag_colossus: 'A Slag Colossus raises both arms before it slams the ground: get more than three blocks away.',
};

const EMBER_TIP = 'An ember bolt sets you burning for a moment. Jump into water to put it out, and keep walls between you and a Kiln Sentry.';
const GENERIC_TIP = 'Every attack is telegraphed: when the embers flare, step out of reach. Your hot furnace is safe ground.';
/** The second line under any automaton death: what turns the fight. */
export const AUTOMATON_GEAR_LINE = 'A maul hits them hardest, armour softens their blows, and none will step into the warmth of a hot furnace.';

export interface AutomatonDeath {
  title: string;
  line: string;
}

/**
 * The death screen's title and line for a death by an automaton ('automaton') or the burning its bolt left ('ember');
 * null for any other cause or when the attacker is unknown (the screen keeps its generic words then).
 */
export function automatonDeath(cause: DamageCause | null, species: string | null): AutomatonDeath | null {
  const title = killerLine(cause, species);
  if (title === null || species === null) return null;
  const line = cause === 'ember' ? EMBER_TIP : (AUTOMATON_TIPS[species] ?? GENERIC_TIP);
  return { title, line };
}
