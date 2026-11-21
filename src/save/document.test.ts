import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/context';
import { createBus } from '../core/context';
import { GameClock } from '../game/clock';
import { ObjectiveTracker } from '../game/objectives';
import { PlayerState } from '../game/playerState';
import { Survival } from '../game/survival';
import { FakeWorld } from '../game/fakeWorld';
import { isWorldSave, normalizeDocument, sanitizeSettings, SaveSlot, SAVE_KEY, SAVE_VERSION, type WorldSave } from './document';
import { MemoryStorage, type StorageLike } from './storage';

function worldSave(): WorldSave {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const player = new PlayerState(bus, { x: 1.5, y: 40, z: 2.5 });
  player.give('oak_log', 3);
  player.give('flint_axe', 1);
  const clock = new GameClock(bus);
  const survival = new Survival(world, player, clock, () => 'woodland');
  const objectives = new ObjectiveTracker(bus, player);
  return {
    seed: 99,
    seedText: 'ninety-nine',
    world: { version: 1, seed: 99, edits: { '0,0': 'AAAA' }, entities: [{ kind: 'crate', x: 1, y: 40, z: 1, slots: [] }] },
    player: player.toJSON(),
    clock: clock.toJSON(),
    survival: survival.toJSON(),
    objectives: objectives.toJSON(),
    playTimeS: 12.5,
  };
}

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem(): void {
    throw new Error('SecurityError');
  }
  removeItem(): void {
    throw new Error('SecurityError');
  }
}

class QuotaStorage extends MemoryStorage {
  setItem(key: string, value: string): void {
    if (value.length > 200) {
      const err = new Error('full');
      err.name = 'QuotaExceededError';
      throw err;
    }
    super.setItem(key, value);
  }
}

describe('settings', () => {
  it('repairs anything into complete, in-range settings', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({ renderDistance: 40, fov: 10, volume: -2, invertY: true, touchControls: 'sideways', showFps: 'yes', mouseSensitivity: Number.NaN });
    expect(s.renderDistance).toBe(12);
    expect(s.fov).toBe(55);
    expect(s.volume).toBe(0);
    expect(s.invertY).toBe(true);
    expect(s.touchControls).toBe('auto');
    expect(s.showFps).toBe(false);
    expect(s.mouseSensitivity).toBe(DEFAULT_SETTINGS.mouseSensitivity);
    expect(sanitizeSettings({ renderDistance: 7.6 }).renderDistance).toBe(8);
  });
});

describe('world save validation', () => {
  it('accepts a real snapshot, also after a JSON round trip', () => {
    const save = worldSave();
    expect(isWorldSave(save)).toBe(true);
    expect(isWorldSave(JSON.parse(JSON.stringify(save)))).toBe(true);
  });

  it('rejects damaged snapshots', () => {
    const save = worldSave();
    const broken: unknown[] = [
      null,
      { ...save, seed: 'x' },
      { ...save, world: { ...save.world, entities: [{ kind: 3 }] } },
      { ...save, world: { ...save.world, edits: { '0,0': 5 } } },
      { ...save, player: { ...save.player, position: { x: 1, y: Number.NaN, z: 0 } } },
      { ...save, player: { ...save.player, inventory: [{ count: 2 }] } },
      { ...save, player: { ...save.player, stats: { made: {}, placed: {}, broken: { a: 'b' }, deaths: 0 } } },
      { ...save, clock: { timeOfDay: 0.5 } },
      { ...save, survival: {} },
      { ...save, objectives: { ...save.objectives, peaks: {} } },
    ];
    for (const b of broken) expect(isWorldSave(b)).toBe(false);
  });

  it('keeps the settings when only the world is damaged', () => {
    const problems: string[] = [];
    const doc = normalizeDocument({ settings: { fov: 90 }, world: { seed: 1 } }, (p) => problems.push(p));
    expect(doc?.world).toBeNull();
    expect(doc?.settings.fov).toBe(90);
    expect(problems).toHaveLength(1);
    expect(normalizeDocument(42)).toBeNull();
  });
});

describe('SaveSlot', () => {
  it('writes and reads the whole document', () => {
    const storage = new MemoryStorage();
    const slot = new SaveSlot(storage);
    expect(slot.read()).toEqual({ settings: DEFAULT_SETTINGS, world: null });
    const doc = { settings: { ...DEFAULT_SETTINGS, fov: 80 }, world: worldSave() };
    expect(slot.write(doc).ok).toBe(true);
    const again = new SaveSlot(storage).read();
    expect(again).toEqual(JSON.parse(JSON.stringify(doc)));
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).v).toBe(SAVE_VERSION);
  });

  it('ignores corrupt text and documents from an unknown version', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    expect(new SaveSlot(storage).read().world).toBeNull();
    storage.setItem(SAVE_KEY, JSON.stringify({ v: 999, t: 0, d: { settings: {}, world: worldSave() } }));
    expect(new SaveSlot(storage).read().world).toBeNull();
  });

  it('reports a damaged world once and still reads the settings', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, t: 0, d: { settings: { volume: 0.2 }, world: { broken: true } } }));
    const slot = new SaveSlot(storage);
    const doc = slot.read();
    expect(doc.world).toBeNull();
    expect(doc.settings.volume).toBe(0.2);
    expect(slot.lastProblem).toMatch(/damaged/);
  });

  it('keeps working in memory when storage throws (sandboxed frames)', () => {
    const slot = new SaveSlot(new ThrowingStorage());
    const doc = { settings: { ...DEFAULT_SETTINGS }, world: worldSave() };
    const result = slot.write(doc);
    expect(result.ok).toBe(false);
    expect(slot.read().world?.seed).toBe(99);
  });

  it('survives a full storage: the save stays in memory and the reason is quota', () => {
    const slot = new SaveSlot(new QuotaStorage());
    const result = slot.write({ settings: { ...DEFAULT_SETTINGS }, world: worldSave() });
    expect(result).toEqual({ ok: false, reason: 'quota' });
    expect(slot.read().world?.seedText).toBe('ninety-nine');
  });
});
