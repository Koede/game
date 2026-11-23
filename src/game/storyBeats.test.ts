import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import type { DayPhase } from '../core/gameEvents';
import { Journal } from './journal';
import { STORY_BEATS, StoryDirector } from './storyBeats';

function rig(age = 0, phase: DayPhase = 'day', journal = new Journal(() => 1)) {
  const bus = createBus();
  const lines: string[] = [];
  bus.on('toast', (t) => lines.push(t.text));
  let now: DayPhase = phase;
  const d = new StoryDirector(bus, journal, () => now, age);
  const run = (s: number): void => {
    for (let t = 0; t < s; t += 0.5) d.tick(0.5);
  };
  return { bus, lines, journal, d, run, setPhase: (p: DayPhase) => (now = p) };
}

describe('StoryDirector', () => {
  it('waits for the first night after an age begins, then plays its lines in order, once', () => {
    const r = rig();
    r.bus.emit('age:advanced', { age: 1 });
    r.run(20);
    expect(r.lines).toEqual([]);
    r.setPhase('night');
    r.run(30);
    expect(r.lines).toEqual(STORY_BEATS[0].lines.map((l) => l.text));
    expect(r.journal.entries.some((e) => e.key === 'story:1')).toBe(true);
    r.run(60);
    expect(r.lines).toHaveLength(STORY_BEATS[0].lines.length);
    expect(r.d.isPlaying).toBe(false);
  });

  it('re-arms after a load only for beats missing from the journal', () => {
    const j = new Journal(() => 1);
    j.add('age', 'x', 'story:1');
    const r = rig(2, 'night', j);
    expect(r.d.waiting).toBe(1);
    r.run(30);
    expect(r.lines[0]).toBe(STORY_BEATS[1].lines[0].text);
  });

  it('does not play for the Ember age or by day', () => {
    const r = rig();
    r.bus.emit('age:advanced', { age: 0 });
    r.setPhase('night');
    r.run(30);
    expect(r.lines).toEqual([]);
    expect(r.d.waiting).toBe(0);
  });
});
