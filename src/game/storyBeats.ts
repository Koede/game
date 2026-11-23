/**
 * Story beats: a short scripted moment at the turn of each age. When a new age is reached, the first night that follows brings a few
 * quiet lines (the first night of the bronze fire, and so on), shown one after another as toasts and written into the journal.
 * DOM-free. What has played lives in the journal (entry key `story:<age>`), so nothing extra is saved: on load every age already
 * reached whose beat is not in the journal is simply armed again.
 */
import type { GameBus } from '../core/context';
import type { DayPhase } from '../core/gameEvents';
import type { Journal } from './journal';

export interface StoryLine {
  /** Seconds after the previous line (or after the beat starts). */
  afterS: number;
  text: string;
}

export interface StoryBeat {
  /** The age whose first night this is (index into AGES, 1-based: the Ember age has no beat). */
  age: number;
  title: string;
  lines: readonly StoryLine[];
}

export const STORY_BEATS: readonly StoryBeat[] = [
  {
    age: 1,
    title: 'The first night of the bronze fire',
    lines: [
      { afterS: 0, text: 'Night settles. The new furnace glows steadier than the clay one ever did.' },
      { afterS: 6, text: 'Tin and copper, married in the crucible: a colour the old fire never made.' },
      { afterS: 6, text: 'You sit by it a while. Somewhere out in the dark, steam is waiting to be tamed.' },
    ],
  },
  {
    age: 2,
    title: 'Iron under the stars',
    lines: [
      { afterS: 0, text: 'The forge rings in the dark, steady as a heartbeat.' },
      { afterS: 6, text: 'Iron remembers every blow. So do your hands.' },
      { afterS: 6, text: 'Tonight the machines do a little of the work, and you watch the sparks go up.' },
    ],
  },
  {
    age: 3,
    title: 'The night the lamps came on',
    lines: [
      { afterS: 0, text: 'A wire hums. Then, for the first time, the dark has an edge you chose.' },
      { afterS: 6, text: 'Heat without smoke. Light without fuel. The world feels smaller and closer.' },
    ],
  },
  {
    age: 4,
    title: 'A glow that is not fire',
    lines: [
      { afterS: 0, text: 'Something in the core is warm, and nothing is burning.' },
      { afterS: 6, text: 'You keep the door shut and the watch long. Power has a weight now.' },
    ],
  },
  {
    age: 5,
    title: 'The star in the clay',
    lines: [
      { afterS: 0, text: 'The old clay furnace is still out there, a lump on the hillside.' },
      { afterS: 6, text: 'Look up. The thing you are building was always meant to hold a star.' },
    ],
  },
];

const keyOf = (age: number): string => `story:${age}`;

export class StoryDirector {
  /** Ages whose beat is waiting for a night. */
  private readonly armed = new Set<number>();
  private playing: { beat: StoryBeat; i: number; wait: number } | null = null;
  private readonly offs: Array<() => void> = [];
  /** Seconds to wait after an age is reached while it is already night, so the beat does not trample the age banner. */
  private static readonly SETTLE_S = 6;
  private settle = 0;

  constructor(
    private readonly bus: GameBus,
    private readonly journal: Journal,
    private readonly phase: () => DayPhase,
    currentAge: number,
  ) {
    // After a load: every age already reached whose beat has not played is waiting for its night.
    for (const b of STORY_BEATS) if (b.age <= currentAge && !journal.has(keyOf(b.age))) this.armed.add(b.age);
    this.offs.push(
      bus.on('age:advanced', ({ age }) => {
        if (STORY_BEATS.some((b) => b.age === age) && !journal.has(keyOf(age))) {
          this.armed.add(age);
          this.settle = StoryDirector.SETTLE_S;
        }
      }),
    );
  }

  get isPlaying(): boolean {
    return this.playing !== null;
  }

  get waiting(): number {
    return this.armed.size;
  }

  tick(dt: number): void {
    if (this.settle > 0) this.settle -= dt;
    if (!this.playing) {
      if (this.armed.size === 0 || this.settle > 0 || this.phase() !== 'night') return;
      const age = Math.min(...this.armed);
      this.armed.delete(age);
      const beat = STORY_BEATS.find((b) => b.age === age);
      if (!beat) return;
      this.journal.add('age', beat.title + '.', keyOf(age));
      this.playing = { beat, i: 0, wait: beat.lines[0]?.afterS ?? 0 };
    }
    const s = this.playing;
    if (!s) return;
    s.wait -= dt;
    while (s.wait <= 0 && s.i < s.beat.lines.length) {
      this.bus.emit('toast', { text: s.beat.lines[s.i].text, kind: 'info' });
      s.i++;
      s.wait += s.beat.lines[s.i]?.afterS ?? 0;
    }
    if (s.i >= s.beat.lines.length) this.playing = null;
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
  }
}
