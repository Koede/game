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

/** The jukebox: a 1940s arched cabinet drawn as a miniblock model (src/world/jukeboxModel.ts); its window and bubble tubes glow while it plays (the active bit; the manager flips it). */
const jukebox: BlockSpec = {
  key: 'jukebox', name: 'Jukebox', desc: 'An arched wooden cabinet with a brass grille. Use it to start the music; everyone but Gruk dances.',
  hardness: 1.2, tool: 'axe', category: 'block', oriented: true, lightActive: 6,
  textures: { side: 'plank', top: 'plank', bottom: 'plank', front: 'jukebox_front', frontActive: 'jukebox_front_on',
    // The model's materials (src/world/jukeboxModel.ts).
    models: ['jukebox_wood', 'jukebox_chrome', 'jukebox_brass', 'jukebox_grille', 'jukebox_window', 'jukebox_window_on', 'jukebox_panel', 'jukebox_bubble', 'jukebox_bubble_on'],
  },
};

/** The party button behind the bar: a small brass-and-red panel. Use it to start the party (everyone in swimwear, dancing); lit while it is on. */
const partyButton: BlockSpec = {
  key: 'party_button', name: 'Party Button', desc: 'A brass panel with a big red button behind the bar. Use it to start the party: everyone puts on swimwear and dances. Again to stop.',
  hardness: 1.2, tool: 'axe', category: 'block', oriented: true, lightActive: 4,
  textures: { side: 'plank', top: 'plank', bottom: 'plank', front: 'party_button_front', frontActive: 'party_button_front_on' },
};

export default {
  blocks: [
    jukebox,
    partyButton,
    fixture('quest_board', 'Quest Board', 'A cork board of pinned bounties and favours. Use it with coin or the item it asks for.'),
    fixture('wall_clock', 'Wall Clock', 'A round clock on a plank backing. Use it to hear the time of day.'),
  ],
  recipes: [],
} satisfies AreaContent;
