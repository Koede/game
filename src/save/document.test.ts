import { SAVE_REV } from './migrations';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/context';
import { createBus } from '../core/context';
import { GameClock } from '../game/clock';
import { ObjectiveTracker } from '../game/objectives';
import { PlayerState } from '../game/playerState';
import { Survival } from '../game/survival';
import { FakeWorld } from '../game/fakeWorld';
import { BACKUP_KEY, isWorldSave, normalizeDocument, sanitizeSettings, SaveSlot, SAVE_KEY, SAVE_VERSION, SETTINGS_KEY, type WorldSave } from './document';
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

  it('keeps the accessibility switches and reads their absence as off', () => {
    const back = sanitizeSettings({ reduceMotion: true, colorMode: 'blue-yellow', tapToMove: true, textScale: 1.3, hudScale: 1.25 });
    expect([back.reduceMotion, back.colorMode, back.tapToMove, back.textScale, back.hudScale]).toEqual([true, 'blue-yellow', true, 1.3, 1.25]);
    // The old single switch reads as the red-green palette; sizes are clamped to what the sliders offer.
    expect(sanitizeSettings({ colorSafe: true }).colorMode).toBe('red-green');
    expect(sanitizeSettings({ colorMode: 'sepia' }).colorMode).toBe('off');
    const wild = sanitizeSettings({ textScale: 9, hudScale: 0.1 });
    expect([wild.textScale, wild.hudScale]).toEqual([1.6, 0.8]);
    expect(sanitizeSettings({ reduceMotion: 'yes' }).reduceMotion).toBe(false);
  });

  it('keeps difficulty and UI size, and reads settings saved before them as Normal and normal', () => {
    const old = { renderDistance: 6, fov: 72, mouseSensitivity: 1, touchSensitivity: 1, invertY: false, volume: 0.8, touchControls: 'auto', showFps: false };
    expect(sanitizeSettings(old)).toEqual({ ...DEFAULT_SETTINGS, ...old, difficulty: 'normal', uiScale: 'normal' });
    expect(sanitizeSettings({ oneHanded: 'right' }).oneHanded).toBe('right');
    expect(sanitizeSettings({ oneHanded: 'sideways' }).oneHanded).toBe('off');
    const back = sanitizeSettings(JSON.parse(JSON.stringify({ ...DEFAULT_SETTINGS, difficulty: 'hard', uiScale: 'large' })));
    expect([back.difficulty, back.uiScale]).toEqual(['hard', 'large']);
    expect(sanitizeSettings({ difficulty: 'nightmare', uiScale: 3 })).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ graphics: 'low' }).graphics).toBe('low');
    expect(sanitizeSettings({ graphics: 'ultra' }).graphics).toBe('normal');
    expect(sanitizeSettings({ difficulty: 'peaceful' }).difficulty).toBe('peaceful');
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
    expect(again).toEqual(JSON.parse(JSON.stringify({ ...doc, world: { ...doc.world, rev: SAVE_REV } })));
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).v).toBe(SAVE_VERSION);
  });

  it('corrupt text, a newer version and a damaged world are reported, backed up and never written over by settings', () => {
    const cases: [string, RegExp][] = [
      ['{not json', /could not be read/],
      [JSON.stringify({ v: SAVE_VERSION + 1, t: 0, d: { settings: { volume: 0.3 }, world: worldSave() } }), /newer version/],
      [JSON.stringify({ v: SAVE_VERSION, t: 0, d: { settings: { volume: 0.3 }, world: { ...worldSave(), player: { position: { x: null } } } } }), /damaged/],
    ];
    for (const [raw, message] of cases) {
      const storage = new MemoryStorage();
      storage.setItem(SAVE_KEY, raw);
      const slot = new SaveSlot(storage);
      const doc = slot.read();
      expect(doc.world).toBeNull();
      expect(slot.lastProblem).toMatch(message);
      expect(slot.held).toBe(true);
      expect(storage.getItem(BACKUP_KEY)).toBe(raw);
      expect(slot.hasBackup).toBe(true);
      // A settings change (the app writes 400 ms after a slider moves) keeps the stored text as it was.
      expect(slot.write({ settings: { ...doc.settings, fov: 91 }, world: null }).ok).toBe(true);
      expect(slot.writeText({ ...doc.settings, fov: 92 }, null).ok).toBe(true);
      expect(storage.getItem(SAVE_KEY)).toBe(raw);
      // ...and the settings live on under their own key.
      const again = new SaveSlot(storage);
      expect(again.read().settings.fov).toBe(92);
      expect(again.held).toBe(true);
      // Starting a New World on purpose replaces it; the backup stays.
      expect(again.writeText(again.read().settings, JSON.stringify(worldSave())).ok).toBe(true);
      expect(again.held).toBe(false);
      expect(new SaveSlot(storage).read().world?.seed).toBe(99);
      expect(storage.getItem(BACKUP_KEY)).toBe(raw);
    }
  });

  it('keeps the settings of a damaged or newer save', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION + 1, t: 0, d: { settings: { volume: 0.25 }, world: null } }));
    expect(new SaveSlot(storage).read().settings.volume).toBe(0.25);
    expect(storage.getItem(SETTINGS_KEY)).toBeNull();
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
    expect(result).toEqual({ ok: false, reason: 'quota', keptAt: null });
    expect(slot.read().world?.seedText).toBe('ninety-nine');
  });

  it('a full storage never deletes the last good save, and frees the backup of an old unreadable save first', () => {
    const backing = new MemoryStorage();
    let room = 0;
    const storage: StorageLike = {
      getItem: (k) => backing.getItem(k),
      removeItem: (k) => backing.removeItem(k),
      setItem: (k, v) => {
        const used = [SAVE_KEY, BACKUP_KEY, SETTINGS_KEY].reduce((n, key) => n + (key === k ? 0 : (backing.getItem(key)?.length ?? 0)), 0);
        if (used + v.length > room) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
        backing.setItem(k, v);
      },
    };
    room = 1e9;
    const first = { settings: { ...DEFAULT_SETTINGS }, world: worldSave() };
    expect(new SaveSlot(storage).write(first).ok).toBe(true);
    const good = backing.getItem(SAVE_KEY);
    room = good!.length + 10;
    const slot = new SaveSlot(storage);
    const bigger = { ...first, world: { ...first.world!, seedText: 'x'.repeat(200) } };
    const result = slot.write(bigger);
    expect(result).toMatchObject({ ok: false, reason: 'quota' });
    expect(backing.getItem(SAVE_KEY)).toBe(good);
    expect(new SaveSlot(storage).read().world?.seedText).toBe('ninety-nine');
    // An old backup is given up to make room.
    backing.setItem(BACKUP_KEY, 'y'.repeat(400));
    room = good!.length + 260;
    expect(slot.write(bigger).ok).toBe(true);
    expect(backing.getItem(BACKUP_KEY)).toBeNull();
  });
});
