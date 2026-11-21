import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { block } from '../core/registry';
import type { BlockDef, IWorld } from '../core/types';
import { JAR_UNITS, VIAL_UNITS } from '../content/itemsMagic';
import { PlayerState } from '../game/playerState';
import { Magic, type MagicTarget } from './magic';

/** A world of stone below y=0, water at one column, air above, one jar and one furnace. */
function setup() {
  const bus = createBus();
  const cells = new Map<string, string>([['5,1,5', 'essentia_jar'], ['7,1,5', 'furnace_clay']]);
  const world = {
    getBlock: (x: number, y: number, z: number): BlockDef => block(cells.get(`${x},${y},${z}`) ?? (y <= 0 ? 'stone' : 'air')),
  } as unknown as IWorld;
  const player = new PlayerState(bus, { x: 0.5, y: 1, z: 0.5 });
  let stoked = 0;
  const magic = new Magic(world, bus, player, { stokeFurnace: (_x, _y, _z, s) => ((stoked += s), true) });
  const toasts: string[] = [];
  bus.on('toast', (t) => toasts.push(t.text));
  const hold = (item: string, count = 1): void => {
    player.inventory.clear();
    player.inventory.add(item, count);
    player.selectedSlot = 0;
  };
  const at = (key: string, x: number, y: number, z: number): MagicTarget => ({ x, y, z, block: block(key) });
  return { bus, magic, player, toasts, hold, at, stoked: () => stoked, cells };
}

describe('magic runtime', () => {
  it('the notebook scans a block once and opens its screen at the sky', () => {
    const t = setup();
    t.hold('field_notebook');
    const opened: unknown[] = [];
    t.bus.on('ui:open', (e) => opened.push(e.screen));
    expect(t.magic.use(t.at('copper_ore', 0, 0, 0))).toBe('worked');
    expect(t.magic.research.scanned).toEqual(['copper_ore']);
    expect(t.magic.research.known).toContain('vein');
    expect(t.magic.use(null)).toBe('screen');
    expect(opened).toEqual([{ type: 'notebook' }]);
  });

  it('the rod fills an empty vial from the land and the land runs dry', () => {
    const t = setup();
    t.hold('vis_rod');
    t.player.inventory.add('glass_vial', 2);
    for (let i = 0; i < VIAL_UNITS; i++) {
      t.magic.tick(1);
      expect(t.magic.use(null)).toBe('worked');
    }
    expect(t.player.inventory.count('glass_vial')).toBe(1);
    expect(t.player.inventory.count('vial_loam')).toBe(1);
    // Stone gives about 147 blocks x 4 loam / 8 => capped; keep drawing until drained.
    let refused = false;
    for (let i = 0; i < 200 && !refused; i++) {
      t.magic.tick(0.25);
      if (!t.player.inventory.has('glass_vial')) t.player.inventory.add('glass_vial', 1);
      refused = t.magic.use(null) === 'refused';
    }
    expect(refused).toBe(true);
  });

  it('jars take and give vials of one aspect, and survive a save', () => {
    const t = setup();
    t.hold('vial_cinder', 3);
    const jar = t.at('essentia_jar', 5, 1, 5);
    expect(t.magic.use(jar)).toBe('worked');
    expect(t.magic.jarText(5, 1, 5)).toBe(`Essentia Jar - Cinder ${VIAL_UNITS}/${JAR_UNITS}`);
    t.player.inventory.add('vial_brook', 1);
    t.player.selectedSlot = t.player.inventory.toJSON().findIndex((s) => s?.item === 'vial_brook');
    expect(t.magic.use(jar)).toBe('refused');
    t.hold('glass_vial', 1);
    expect(t.magic.use(jar)).toBe('worked');
    expect(t.player.inventory.count('vial_cinder')).toBe(1);
    expect(t.magic.jarText(5, 1, 5)).toBe('Essentia Jar - empty');
    t.hold('vial_cinder', 1);
    t.magic.use(jar);
    const saved = JSON.parse(JSON.stringify(t.magic.toJSON()));
    const u = setup();
    u.magic.load(saved);
    expect(u.magic.jarText(5, 1, 5)).toBe(`Essentia Jar - Cinder ${VIAL_UNITS}/${JAR_UNITS}`);
    u.magic.load({ jars: [[1, 2, 3, 'nope', 5], 'x'], research: 7 });
    expect(u.magic.research.scanned).toEqual([]);
  });

  it('a Vial of Cinder feeds a burning furnace only after the research', () => {
    const t = setup();
    t.hold('vial_cinder', 1);
    const furnace = t.at('furnace_clay', 7, 1, 5);
    expect(t.magic.use(furnace)).toBe('refused');
    for (const k of ['field_notes', 'glassware', 'gathering_rod', 'warm_hearth']) t.magic.research.entries[k] = { done: true, tokens: {} };
    expect(t.magic.use(furnace)).toBe('worked');
    expect(t.stoked()).toBeGreaterThan(0);
    expect(t.player.inventory.count('glass_vial')).toBe(1);
  });

  it('gates the vial recipe until the research is done', () => {
    const t = setup();
    expect(t.magic.craftGate('glass_vial')).toMatch(/Vessels of Essence/);
    t.magic.research.entries.glassware = { done: true, tokens: {} };
    expect(t.magic.craftGate('glass_vial')).toBeNull();
  });
});
