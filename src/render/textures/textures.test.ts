import { describe, expect, it } from 'vitest';
import { BLOCKS, TEXTURE_NAMES } from '../../core/registry';
import { Canvas } from './canvas';
import { averageColor, hasPainter, paintTexture, TEXTURE_SIZE } from './index';
import { PAINTERS } from './painters';

const BYTES = 16 * 16 * 4;
const alphaAt = (px: Uint8ClampedArray, x: number, y: number): number => px[(y * 16 + x) * 4 + 3];
const lum = (px: Uint8ClampedArray, i: number): number => 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];

function fresh(name: string): Uint8ClampedArray {
  const c = new Canvas(name);
  PAINTERS[name](c);
  return c.data;
}

/** Texture names used by blocks of the given predicate, on any face, idle or active. */
function blockTextures(pred: (b: (typeof BLOCKS)[number]) => boolean): Set<string> {
  const out = new Set<string>();
  for (const b of BLOCKS) {
    if (b.shape === 'none' || !pred(b)) continue;
    for (const l of [...b.layers, ...b.layersActive]) out.add(TEXTURE_NAMES[l]);
  }
  return out;
}

describe('texture API', () => {
  it('is 16x16 RGBA and returns a fresh array for any name', () => {
    expect(TEXTURE_SIZE).toBe(16);
    for (const name of ['stone', 'item_coal', 'no_such_texture', '', 'constructor', '__proto__']) {
      const a = paintTexture(name);
      expect(a).toBeInstanceOf(Uint8ClampedArray);
      expect(a.length).toBe(BYTES);
      a.fill(7);
      expect(paintTexture(name)[3]).not.toBe(7);
    }
  });

  it('paints a magenta/black checker for unknown names and reports no painter for them', () => {
    for (const name of ['no_such_texture', 'toString', '__proto__']) {
      expect(hasPainter(name)).toBe(false);
      const px = paintTexture(name);
      expect([px[0], px[1], px[2], px[3]]).toEqual([255, 0, 255, 255]);
      expect([px[16], px[17], px[18], px[19]]).toEqual([0, 0, 0, 255]);
    }
    expect(paintTexture('missing')).toEqual(paintTexture('no_such_texture'));
  });

  it('has a dedicated painter for every registry texture name', () => {
    expect(TEXTURE_NAMES.length).toBeGreaterThan(150);
    const checker = paintTexture('no_such_texture');
    for (const name of TEXTURE_NAMES) {
      expect(hasPainter(name), name).toBe(true);
      if (name !== 'missing') expect(paintTexture(name), name).not.toEqual(checker);
    }
  });

  it('paints deterministically, independent of what was painted before', () => {
    const forward = TEXTURE_NAMES.map(fresh);
    const backward = [...TEXTURE_NAMES].reverse().map(fresh).reverse();
    TEXTURE_NAMES.forEach((name, i) => {
      expect(forward[i], name).toEqual(backward[i]);
      expect(paintTexture(name), name).toEqual(forward[i]);
    });
  });

  it('averageColor is the mean of the opaque pixels', () => {
    expect(averageColor('no_such_texture')).toEqual([128, 0, 128]);
    for (const name of ['stone', 'item_copper_ingot', 'water', 'tall_grass']) {
      const px = paintTexture(name);
      let r = 0;
      let n = 0;
      for (let i = 0; i < BYTES; i += 4) if (px[i + 3] >= 128) {
        r += px[i];
        n++;
      }
      expect(n).toBeGreaterThan(0);
      expect(averageColor(name)[0]).toBe(Math.round(r / n));
    }
  });
});

describe('texture content', () => {
  it('no texture is blank, flat or fully transparent, and no two are identical', () => {
    const seen = new Map<string, string>();
    for (const name of TEXTURE_NAMES) {
      const px = paintTexture(name);
      const colours = new Set<number>();
      let visible = 0;
      for (let i = 0; i < BYTES; i += 4) {
        if (px[i + 3] === 0) continue;
        visible++;
        colours.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
      }
      expect(visible, name).toBeGreaterThan(30);
      expect(colours.size, name).toBeGreaterThanOrEqual(name === 'missing' ? 2 : 5);
      const key = Array.from(px).join(',');
      expect(seen.get(key), `${name} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, name);
    }
  });

  it('opaque block faces are fully opaque; cutout plants and torches have only clean holes', () => {
    const solid = blockTextures((b) => b.shape === 'cube' || b.shape === 'slab' || b.liquid === 'lava');
    const translucent = blockTextures((b) => b.translucent);
    for (const name of solid) {
      if (translucent.has(name)) continue;
      const px = paintTexture(name);
      for (let i = 3; i < BYTES; i += 4) expect(px[i], name).toBe(255);
    }
    for (const name of blockTextures((b) => b.shape === 'cross' || b.shape === 'torch')) {
      const px = paintTexture(name);
      let holes = 0;
      for (let i = 3; i < BYTES; i += 4) {
        expect([0, 255], name).toContain(px[i]);
        if (px[i] === 0) holes++;
      }
      expect(holes, name).toBeGreaterThan(64);
    }
  });

  it('water is see-through everywhere and glass has an opaque frame around a clear pane', () => {
    const water = paintTexture('water');
    for (let i = 3; i < BYTES; i += 4) {
      expect(water[i]).toBeGreaterThan(150);
      expect(water[i]).toBeLessThan(255);
    }
    const glass = paintTexture('glass');
    expect(alphaAt(glass, 0, 7)).toBe(255);
    expect(alphaAt(glass, 15, 15)).toBe(255);
    expect(alphaAt(glass, 8, 8)).toBeLessThan(80);
  });

  it('the torch post and flame sit where the mesher samples them', () => {
    const px = paintTexture('torch');
    for (let y = 6; y < 16; y++) for (const x of [7, 8]) expect(alphaAt(px, x, y), `${x},${y}`).toBe(255);
    // The top of the post glows: bright flame pixels in rows 6-7.
    expect(lum(px, (6 * 16 + 7) * 4)).toBeGreaterThan(180);
  });

  it('cables are opaque along the plus the mesher samples and clear in the corners', () => {
    for (const name of ['copper_cable', 'heavy_cable', 'super_cable']) {
      const px = paintTexture(name);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const band = (x >= 5 && x <= 10) || (y >= 5 && y <= 10);
          expect(alphaAt(px, x, y) === 255, `${name} ${x},${y}`).toBe(band);
        }
      }
    }
  });

  it('pipes are opaque along the 8/16 plus the mesher samples and clear in the corners', () => {
    const pipes = BLOCKS.filter((b) => b.shape === 'pipe').map((b) => TEXTURE_NAMES[b.layers[0]]);
    expect(pipes).toEqual(['pipe_item', 'pipe_item_fast', 'pipe_fluid', 'pipe_fluid_hot']);
    for (const name of pipes) {
      const px = paintTexture(name);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const band = (x >= 4 && x <= 11) || (y >= 4 && y <= 11);
          expect(alphaAt(px, x, y) === 255, `${name} ${x},${y}`).toBe(band);
        }
      }
    }
  });

  it('formed hearth walls glow: their lit seams are brighter than the cold ones', () => {
    const mean = (name: string): number => {
      const px = paintTexture(name);
      let sum = 0;
      for (let i = 0; i < BYTES; i += 4) sum += lum(px, i);
      return sum / 256;
    };
    for (const name of ['brick', 'refractory_brick', 'plasma_casing', 'star_casing', 'electrode', 'hatch_item', 'hatch_fluid', 'power_port']) {
      expect(mean(`${name}_on`), name).toBeGreaterThan(mean(name) + 8);
    }
  });

  it('terrain tiles tile seamlessly: the wrap seam is no harsher than the harshest edge inside the tile', () => {
    const tiled = [
      'corestone', 'stone', 'rubble', 'dirt', 'grass_top', 'sand', 'gravel', 'clay', 'snow', 'ice', 'basalt', 'limestone',
      'water', 'lava', 'corium', 'oak_leaves', 'pine_leaves', 'oak_log_side', 'pine_log_side', 'plank', 'brick', 'stone_brick',
      'concrete', 'oil_shale',
      'packed_ice', 'basalt_column_top', 'peat', 'oil', 'mossy_stone_brick', 'cactus_side',
      // Hearth walls (spec 17), cold and formed: a whole wall of them must read as one surface.
      'brick_on', 'refractory_brick', 'refractory_brick_on', 'plasma_casing', 'plasma_casing_on', 'star_casing', 'star_casing_on',
    ];
    const diff = (px: Uint8ClampedArray, a: number, b: number): number =>
      Math.abs(px[a] - px[b]) + Math.abs(px[a + 1] - px[b + 1]) + Math.abs(px[a + 2] - px[b + 2]);
    // Median difference between row (or column) j and j+1, wrapping at 15 -> 0. A real seam shows along most
    // of the edge; the median ignores the odd pebble that happens to straddle it.
    const rowStep = (px: Uint8ClampedArray, j: number, vertical: boolean): number => {
      const steps: number[] = [];
      for (let k = 0; k < 16; k++) {
        const a = vertical ? (k * 16 + j) * 4 : (j * 16 + k) * 4;
        const b = vertical ? (k * 16 + ((j + 1) % 16)) * 4 : (((j + 1) % 16) * 16 + k) * 4;
        steps.push(diff(px, a, b));
      }
      steps.sort((p, q) => p - q);
      return (steps[7] + steps[8]) / 2;
    };
    for (const name of tiled) {
      const px = paintTexture(name);
      for (const vertical of [false, true]) {
        let harshest = 0;
        for (let j = 0; j < 15; j++) harshest = Math.max(harshest, rowStep(px, j, vertical));
        expect(rowStep(px, 15, vertical), `${name} ${vertical ? 'left/right' : 'top/bottom'}`).toBeLessThanOrEqual(harshest * 1.15 + 4);
      }
    }
  });

  it('ores keep the host rock of their depth untouched between their flecks (so they tile like it)', () => {
    const hosts: Record<string, string[]> = {
      stone: ['coal_ore', 'copper_ore', 'tin_ore', 'iron_ore', 'sulfur_ore', 'quartz_ore'],
    };
    for (const [host, ores] of Object.entries(hosts)) {
      const rock = paintTexture(host);
      for (const name of ores) {
        const px = paintTexture(name);
        let same = 0;
        for (let i = 0; i < BYTES; i += 4) if (px[i] === rock[i] && px[i + 1] === rock[i + 1] && px[i + 2] === rock[i + 2]) same++;
        expect(same / 256, name).toBeGreaterThan(0.5);
      }
    }
  });

  it('item icons have a transparent background and a darker outline', () => {
    const icons = TEXTURE_NAMES.filter((n) => n.startsWith('item_'));
    expect(icons.length).toBe(83);
    for (const name of icons) {
      const px = paintTexture(name);
      let clear = 0;
      let edge = 0;
      let edgeN = 0;
      let inner = 0;
      let innerN = 0;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const a = alphaAt(px, x, y);
          expect([0, 255], name).toContain(a);
          if (a === 0) {
            clear++;
            continue;
          }
          const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => alphaAt(px, x + dx, y + dy) === 0);
          if (rim) {
            edge += lum(px, (y * 16 + x) * 4);
            edgeN++;
          } else {
            inner += lum(px, (y * 16 + x) * 4);
            innerN++;
          }
        }
      }
      expect(clear, name).toBeGreaterThan(30);
      expect(innerN, name).toBeGreaterThan(10);
      expect(edge / edgeN, name).toBeLessThan(inner / innerN);
    }
  });

  it('ores in stone have fleck palettes that do not overlap', () => {
    const stone = paintTexture('stone');
    const ores = ['coal_ore', 'copper_ore', 'tin_ore', 'iron_ore', 'sulfur_ore', 'quartz_ore'];
    // The colours an ore adds to the shared host rock, ignoring the shadow rim that seats every fleck.
    const flecks = ores.map((name) => {
      const px = paintTexture(name);
      const out: number[][] = [];
      for (let i = 0; i < BYTES; i += 4) {
        if (Math.hypot(px[i] - stone[i], px[i + 1] - stone[i + 1], px[i + 2] - stone[i + 2]) < 40) continue;
        out.push([px[i], px[i + 1], px[i + 2]]);
      }
      expect(out.length, name).toBeGreaterThan(12);
      return out;
    });
    // Mean distance from each fleck pixel of one ore to the nearest fleck colour of the other (both ways).
    const nearest = (a: number[][], b: number[][]): number =>
      a.reduce((s, p) => s + Math.min(...b.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))), 0) / a.length;
    for (let a = 0; a < ores.length; a++) {
      for (let b = a + 1; b < ores.length; b++) {
        const d = Math.min(nearest(flecks[a], flecks[b]), nearest(flecks[b], flecks[a]));
        expect(d, `${ores[a]} vs ${ores[b]}`).toBeGreaterThan(25);
      }
    }
  });

  it('every lit variant differs from its idle face, and lit furnace mouths are brighter', () => {
    for (const name of TEXTURE_NAMES.filter((n) => n.endsWith('_on'))) {
      const idle = name.slice(0, -3);
      expect(TEXTURE_NAMES, name).toContain(idle);
      expect(paintTexture(name), name).not.toEqual(paintTexture(idle));
    }
    // Row 9, x 5..10 lies inside every tier's mouth and clear of the blast furnace's grate bars.
    const mouth = (n: string): number => {
      const px = paintTexture(n);
      let sum = 0;
      for (let x = 5; x <= 10; x++) sum += lum(px, (9 * 16 + x) * 4);
      return sum / 6;
    };
    for (const tier of ['clay', 'blast', 'arc', 'plasma', 'star']) {
      expect(mouth(`furnace_${tier}_front_on`), tier).toBeGreaterThan(mouth(`furnace_${tier}_front`) + 50);
    }
  });

  it('paints the whole set quickly', () => {
    const t0 = performance.now();
    for (const name of TEXTURE_NAMES) fresh(name);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
