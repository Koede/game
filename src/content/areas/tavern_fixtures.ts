/**
 * The tavern's fixtures as real blocks (docs/api/npcs.md): the quest board, a notice board of pinned bounties, the wall
 * clock and the jukebox. Use the board for bounties and favours, and the clock for the time, just as you would talk to a regular. Oriented:
 * the painted face (`front`) looks into the room. Placed by the starting tavern only; not craftable.
 */
import type { AreaContent } from '../area';
import type { BlockSpec } from '../../core/types';

const fixture = (key: string, name: string, desc: string): BlockSpec => ({
  key, name, desc, hardness: 1.2, tool: 'axe', category: 'block', oriented: true,
  textures: { side: 'plank', top: 'plank', bottom: 'plank', front: `${key}_front` },
});

/** The jukebox: an arched cabinet that glows amber while it plays (the active bit; the manager flips it). */
const jukebox: BlockSpec = {
  key: 'jukebox', name: 'Jukebox', desc: 'An arched wooden cabinet with a brass grille. Use it to start the music; everyone but Gruk dances.',
  hardness: 1.2, tool: 'axe', category: 'block', oriented: true, lightActive: 6,
  textures: { side: 'plank', top: 'plank', bottom: 'plank', front: 'jukebox_front', frontActive: 'jukebox_front_on' },
};

export default {
  blocks: [
    jukebox,
    fixture('quest_board', 'Quest Board', 'A cork board of pinned bounties and favours. Use it with coin or the item it asks for.'),
    fixture('wall_clock', 'Wall Clock', 'A round clock on a plank backing. Use it to hear the time of day.'),
  ],
  recipes: [],
} satisfies AreaContent;
