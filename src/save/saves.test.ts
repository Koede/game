import { describe, expect, it } from 'vitest';
import { GameState } from '../app/state';
import { canonicalItemKey } from '../core/registry';
import { takeLostItems } from '../content/aliases';
import manifest from '../../tests/fixtures/saves/manifest.json';
import beforeBronze from '../../tests/fixtures/save-before-bronze.json';
import modulesAll from '../../tests/fixtures/saves/modules-all.json';
import sixAgeRev2 from '../../tests/fixtures/saves/sixage-rev2.json';
import saplingsSave from '../../tests/fixtures/saves/saplings.json';
import { MemoryStorage } from './storage';
import { PREV_KEY, SAVE_KEY, SaveSlot, type WorldSave } from './document';
import { SAVE_REV } from './migrations';

/**
 * Golden saves, one manifest (tests/fixtures/saves/manifest.json). Every row loads without a problem, survives 200
 * ticks, round-trips byte-identically on a second save and matches its summary. A stream that persists new state adds a
 * row (a fixture file plus its summary), never a test file.
 * To add a row: put the file in tests/fixtures, add it to FILES below and to the manifest, run the test and paste the
 * summary it prints in the failure diff.
 */
interface Row {
  name: string;
  /** Path under tests/fixtures. */
  file: string;
  /** Envelope version the file is stored with (the file holds the bare document). */
  v: number;
  summary: Summary;
}
interface Summary {
  entities: number;
  items: number;
  scanned: number;
  completed: number;
  age: number;
  extras: string[];
  /** Workshop parts and tractors (the headless modules, R3). */
  parts: number;
  tractors: number;
}
const FILES: Record<string, unknown> = { 'save-before-bronze.json': beforeBronze, 'saves/sixage-rev2.json': sixAgeRev2, 'saves/modules-all.json': modulesAll, 'saves/saplings.json': saplingsSave };
const rows = manifest as unknown as Row[];

function summarise(s: WorldSave): Summary {
  const inv = s.player.inventory.reduce((n, slot) => n + (slot ? slot.count : 0), 0);
  const magic = (s.world.extras as { magic?: { research?: { scanned?: string[] } } } | undefined)?.magic;
  return {
    entities: s.world.entities.length,
    items: inv,
    scanned: magic?.research?.scanned?.length ?? 0,
    completed: s.objectives.completed.length,
    age: s.objectives.age,
    extras: Object.keys(s.world.extras ?? {}).sort(),
    parts: (s.world.extras as { workshop?: { parts?: unknown[] } } | undefined)?.workshop?.parts?.length ?? 0,
    tractors: (s.world.extras as { vehicles?: { tractors?: unknown[] } } | undefined)?.vehicles?.tractors?.length ?? 0,
  };
}

function open(row: Row) {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, `{"v":${row.v},"t":0,"d":${JSON.stringify(FILES[row.file])}}`);
  const slot = new SaveSlot(storage);
  return { slot, storage, doc: slot.read() };
}

describe.each(rows)('golden save $name', (row) => {
  it('loads without a problem and is at the current rev', () => {
    const { slot, doc } = open(row);
    expect(slot.lastProblem).toBeNull();
    expect(doc.world).not.toBeNull();
    expect(doc.world!.rev).toBe(SAVE_REV);
  });

  it('matches its summary', () => {
    const { doc } = open(row);
    const got = summarise(doc.world!);
    expect(got).toEqual(row.summary);
  });

  it('runs 200 ticks and re-serialises byte-identically', () => {
    const { doc } = open(row);
    const a = GameState.restore(doc.world!);
    const text1 = a.toSaveJson();
    const b = GameState.restore(JSON.parse(text1));
    const text2 = b.toSaveJson();
    expect(text2).toBe(text1);
    for (let i = 0; i < 200; i++) a.tick();
    expect(() => a.toSaveJson()).not.toThrow();
    a.dispose();
    b.dispose();
  });

  it('keeps every item key resolvable (aliases or still real)', () => {
    const { doc } = open(row);
    takeLostItems();
    const state = GameState.restore(doc.world!);
    state.dispose();
    expect([...takeLostItems().keys()]).toEqual([]);
  });
});

describe('save revisions and backups', () => {
  it('a world without rev in an envelope-v2 save is current; a newer rev is held, not loaded', () => {
    const base = JSON.parse(JSON.stringify(beforeBronze));
    const storage = new MemoryStorage();
    base.world.rev = SAVE_REV + 1;
    const text = JSON.stringify({ v: 2, t: 0, d: base });
    storage.setItem(SAVE_KEY, text);
    const slot = new SaveSlot(storage);
    expect(slot.read().world).toBeNull();
    expect(slot.held).toBe(true);
    expect(storage.getItem(SAVE_KEY)).toBe(text);
  });

  it('rolls the previous save into .prev only when it is at least 10 minutes older', () => {
    const storage = new MemoryStorage();
    let now = 1_000_000;
    const slot = new SaveSlot(storage, () => now);
    const doc = { settings: slot.read().settings, world: null };
    expect(slot.write(doc).ok).toBe(true);
    const first = storage.getItem(SAVE_KEY);
    now += 60_000;
    slot.write(doc);
    expect(storage.getItem(PREV_KEY)).toBeNull();
    now += 11 * 60_000;
    slot.write(doc);
    expect(storage.getItem(PREV_KEY)).not.toBeNull();
    expect(JSON.parse(storage.getItem(PREV_KEY)!).t).toBe(1_000_000 + 60_000);
    expect(first).not.toBeNull();
  });

  it('an unknown item key is counted, an aliased one is not a loss', () => {
    takeLostItems();
    expect(canonicalItemKey('definitely_not_an_item')).toBeNull();
    expect([...takeLostItems().keys()]).toEqual(['definitely_not_an_item']);
    expect(canonicalItemKey('plank')).toBe('plank');
    expect(takeLostItems().size).toBe(0);
  });
});
