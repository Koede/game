/**
 * The camp goals: the first hours of a new world, built around the camp, on their own track. They are not in the main goal list
 * (src/content/objectives*.ts), so an old save never gets stuck on a goal it cannot finish: the track shows only in a world that
 * has a camp or a lodge, and it reads what the town has already done, so a goal whose work is behind you is done at once.
 * DOM-free and pure over `CampFacts`; the manager keeps the set of what was seen done (saved as `goals`).
 */

/** What the town has done, as the goals see it. */
export interface CampFacts {
  /** The player has talked to the builder. */
  metBuilder: boolean;
  /** The player warmed up at a fire (the well_warmed flag). */
  warmed: boolean;
  /** The player rested by a fire or in a bed until dawn (the rested flag). */
  rested: boolean;
  /** Town standing: above 0 once a build bounty was filled. */
  standing: number;
  /** Lodge stages standing (0..5). */
  lodgeLevel: number;
  /** People who moved in, not counting the builder. */
  residents: number;
}

export interface CampGoal {
  id: string;
  title: string;
  /** One or two sentences: what to do and where. */
  text: string;
  done: (f: CampFacts) => boolean;
  /** The diary line written when the goal is done. */
  note: string;
}

export const CAMP_GOALS: readonly CampGoal[] = [
  {
    id: 'meet_builder',
    title: 'Meet Gruk',
    text: 'Walk to the cart by the campfire and use Gruk. He has wooden tools for you and a plan for the place.',
    done: (f) => f.metBuilder,
    note: 'Met Gruk at the camp. He builds; I gather.',
  },
  {
    id: 'warm_up',
    title: 'Warm up at the fire',
    text: 'Stand by the campfire a while. Cold wears you down, and the fire is the first thing the camp gives.',
    done: (f) => f.warmed,
    note: 'Warmed my hands at the camp fire.',
  },
  {
    id: 'first_night',
    title: 'Sleep a night',
    text: 'At dusk, sleep by the fire (use it) until dawn. Nothing comes for a camp that has someone awake by a fire.',
    done: (f) => f.rested,
    note: 'Slept my first night at the camp.',
  },
  {
    id: 'first_bounty',
    title: 'Fill a bounty on the board',
    text: 'Gruk pins what he needs on his building board in the storage bay. Hold the materials and use the board.',
    done: (f) => f.standing > 0 || f.lodgeLevel >= 1,
    note: 'Filled my first bounty on Gruk\'s board. The town has a standing now.',
  },
  {
    id: 'open_lodge',
    title: 'Raise the lodge',
    text: 'Keep the materials coming. The lodge has a hearth, a table and a bedroom; the bedroom is where a newcomer will sleep.',
    done: (f) => f.lodgeLevel >= 1,
    note: 'The lodge stands. It has a hearth, and a bed waiting for someone.',
  },
  {
    id: 'first_newcomer',
    title: 'Welcome a newcomer',
    text: 'Each night the bedroom stands empty, someone may walk up the road. Open the Town page to see who is next and what they wait for.',
    done: (f) => f.residents >= 1,
    note: 'Someone has moved into the lodge. The place is not just mine and Gruk\'s any more.',
  },
  {
    id: 'three_neighbours',
    title: 'Make a home for three',
    text: 'Three people in the lodge make a town. More bedrooms come with the bar, the kitchen and the upper floor.',
    done: (f) => f.residents >= 3,
    note: 'Three neighbours now. The lodge is loud in the evenings, and I like it.',
  },
];

/** The goals done by the facts, plus every goal before the last one done (a later fact means the earlier ones happened). */
export function doneGoals(f: CampFacts, seen: ReadonlySet<string> = new Set()): Set<string> {
  const done = new Set<string>(seen);
  let last = -1;
  CAMP_GOALS.forEach((g, i) => {
    if (done.has(g.id) || g.done(f)) last = Math.max(last, i);
  });
  CAMP_GOALS.forEach((g, i) => {
    if (i <= last) done.add(g.id);
  });
  return done;
}

/** The first goal not done, or null when the track is finished. */
export function currentGoal(done: ReadonlySet<string>): CampGoal | null {
  return CAMP_GOALS.find((g) => !done.has(g.id)) ?? null;
}
