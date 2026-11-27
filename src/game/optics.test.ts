import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { WATER_TOP } from '../world/terrain';
import { FakeWorld } from './fakeWorld';
import {
  Optics, SPOT_HOLD_S, ZOOM, directionWord, isLighthouse, landmarkInView, landmarksNear, offAxis, skyReading, type Landmark,
} from './optics';
import { PlayerState } from './playerState';

function setup(seed = 3) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const player = new PlayerState(bus, { x: 0.5, y: 40, z: 0.5 });
  const zooms: number[] = [];
  const views: Array<GameEvents['optics:view']> = [];
  const toasts: string[] = [];
  const notes: string[] = [];
  bus.on('optics:view', (v) => views.push(v));
  bus.on('toast', (t) => toasts.push(t.text));
  bus.on('town:note', (n) => notes.push(n.text));
  let night = false;
  const optics = new Optics({
    world, bus, player, seed,
    setZoom: (z) => zooms.push(z),
    isNight: () => night,
    weather: () => ({ kind: 'clear', next: 'rain', nextInS: 600 }),
  });
  return { bus, world, player, optics, zooms, views, toasts, notes, setNight: (n: boolean) => (night = n) };
}

/** Points the player's view at (x, z): yaw is the HUD compass's (heading + yaw = 0 straight ahead). */
function face(player: PlayerState, x: number, z: number): void {
  player.yaw = -Math.atan2(x - player.position.x, -(z - player.position.z));
}

describe('optics: directions and the view', () => {
  it('names the eight compass points (north is -Z)', () => {
    expect(directionWord(0, 0, 0, -10)).toBe('north');
    expect(directionWord(0, 0, 10, -10)).toBe('north-east');
    expect(directionWord(0, 0, 10, 0)).toBe('east');
    expect(directionWord(0, 0, 0, 10)).toBe('south');
    expect(directionWord(0, 0, -10, 1)).toBe('west');
  });

  it('picks the landmark nearest the middle of the view, within range and the cone', () => {
    const marks: Landmark[] = [
      { key: 'a', name: 'A', x: 0, z: -100 },
      { key: 'b', name: 'B', x: 6, z: -100 },
      { key: 'c', name: 'C', x: 0, z: -900 },
      { key: 'd', name: 'D', x: 0, z: -5 },
    ];
    const yaw = 0;
    expect(Math.abs(offAxis(0, 0, yaw, 0, -100))).toBeLessThan(1e-9);
    expect(landmarkInView(marks, 0, 0, yaw, 0.1, 300)?.key).toBe('a');
    expect(landmarkInView(marks, 0, 0, yaw - 0.06, 0.1, 300)?.key).toBe('b');
    // Too far, too close, or out of the cone: nothing.
    expect(landmarkInView(marks.filter((m) => m.key === 'c' || m.key === 'd'), 0, 0, yaw, 0.1, 300)).toBeNull();
    expect(landmarkInView(marks, 0, 0, Math.PI / 2, 0.1, 300)).toBeNull();
    // Yaw on it but the view tilted up at the sky: not in the middle of the view.
    expect(landmarkInView(marks, 0, 0, yaw, 0.1, 300, 0.1)?.key).toBe('a');
    expect(landmarkInView(marks, 0, 0, yaw, 0.1, 300, 0.8)).toBeNull();
    expect(landmarkInView(marks, 0, 0, yaw, 0.1, 300, -0.8)).toBeNull();
  });

  it('reads the weather in the stars', () => {
    expect(skyReading('clear', 'rain', 600)).toBe('The stars say clear skies now, and rain in about 10 minutes.');
    expect(skyReading('storm', 'storm', 60)).toBe('The stars say a storm, and more of it to come.');
    expect(skyReading('cloudy', 'clear', 7200)).toContain('in about 2 hours');
  });
});

describe('optics: the spyglass and the telescope', () => {
  it('raises and lowers the spyglass with Use, and lowers it when it leaves the hand', () => {
    const { optics, player, zooms, views } = setup();
    player.inventory.set(player.selectedSlot, { item: 'spyglass', count: 1 });
    expect(optics.use(null, 'spyglass')).toBe('worked');
    expect(optics.raised).toBe('spyglass');
    expect(zooms.at(-1)).toBe(ZOOM.spyglass);
    expect(views.at(-1)?.mode).toBe('spyglass');
    expect(optics.use(null, 'spyglass')).toBe('worked');
    expect(optics.raised).toBe('none');
    expect(zooms.at(-1)).toBe(1);
    optics.use(null, 'spyglass');
    player.inventory.set(player.selectedSlot, null);
    optics.update(0.1);
    expect(optics.raised).toBe('none');
    // Anything else in hand is not ours.
    expect(optics.use(null, 'stick')).toBeNull();
  });

  it('looks through a telescope aimed at, reads the stars at night under open sky, and steps back when the player walks off', () => {
    const { optics, world, player, zooms, toasts, setNight } = setup();
    world.put(1, 40, 0, 'telescope');
    const hit = { x: 1, y: 40, z: 0, block: { key: 'telescope' } };
    // A held building block is left to be placed.
    expect(optics.use(hit, 'stone_brick')).toBeNull();
    setNight(true);
    expect(optics.use(hit, null)).toBe('worked');
    expect(optics.raised).toBe('telescope');
    expect(zooms.at(-1)).toBe(ZOOM.telescope);
    expect(toasts.at(-1)).toContain('The stars say clear skies now, and rain');
    player.position.x = 8;
    optics.update(0.1);
    expect(optics.raised).toBe('none');
  });

  it('spots a real landmark held in the middle of the view, once, with a Hearth Log line', () => {
    const { optics, player, toasts, notes, views } = setup(3);
    // A landmark of this seed a few hundred blocks off.
    const marks = landmarksNear(3, 0, 0, 900).filter((m) => Math.hypot(m.x, m.z) > 60);
    expect(marks.length).toBeGreaterThan(0);
    const target = marks.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
    // Stand 150 blocks from it and look at it.
    const d = Math.hypot(target.x, target.z);
    player.position.x = target.x - (target.x / d) * 150;
    player.position.z = target.z - (target.z / d) * 150;
    face(player, target.x, target.z);
    player.inventory.set(player.selectedSlot, { item: 'spyglass', count: 1 });
    optics.use(null, 'spyglass');
    for (let t = 0; t < SPOT_HOLD_S + 0.6; t += 0.05) optics.update(0.05);
    const seen = views.at(-1)?.target;
    expect(seen?.spotted).toBe(true);
    expect(toasts.filter((t) => t.startsWith('Spotted:'))).toHaveLength(1);
    expect(notes).toHaveLength(1);
    for (let t = 0; t < 2; t += 0.05) optics.update(0.05);
    expect(toasts.filter((t) => t.startsWith('Spotted:'))).toHaveLength(1);
    // Spotted landmarks are saved.
    const saved = optics.toJSON();
    expect(saved.spotted).toHaveLength(1);
    const again = setup(3);
    again.optics.load(saved);
    expect(again.optics.hasSpotted(saved.spotted[0])).toBe(true);
  });
});

describe('optics: lighthouses', () => {
  it('a lamp is a lighthouse only high over a shore with water round much of it', () => {
    const world = new FakeWorld();
    expect(isLighthouse(world, 0, WATER_TOP + 10, 0)).toBe(false);
    for (let x = -20; x <= 20; x++) for (let z = 3; z <= 20; z++) world.put(x, WATER_TOP, z, 'water');
    expect(isLighthouse(world, 0, WATER_TOP + 10, 0)).toBe(true);
    expect(isLighthouse(world, 0, WATER_TOP + 2, 0)).toBe(false);
  });
});
