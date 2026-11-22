/** Feature visuals part 2: the pure logic behind packets, pipe contents, hearths, ghosts and the highlight arrow. */
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBus } from '../../core/context';
import { PIPE_CORE_MAX, PIPE_CORE_MIN } from '../../core/constants';
import { blockId, itemOrNull } from '../../core/registry';
import { Face } from '../../core/types';
import { HEAT_STOPS } from '../../ui/kit/format';
import { PIPE_COLLAR_DEPTH } from '../../world/meshPipe';
import { FakeWorld } from '../testKit';
import { CellLight, packLight, skyOf, blockOf } from './cellLight';
import { hearthBox, hearthOpenTop, shellNormal } from './hearthInfo';
import { HEAT_RAMP, heatColor, heatGlow } from './heat';
import { BlockHighlight, edgeArrow, type EdgeArrow } from './highlight';
import { itemLook } from './packets';
import { cumulativeLengths, packetDistance, pointAlong } from './path';
import { buildPipeMask, pipePieces, shownLevel } from './pipeOverlay';
import { BLOCKED, CLEAR, LEAVES_ONLY, sightTo } from './sightline';

describe('packet paths', () => {
  const pts = new Float32Array([0, 0, 0, 2, 0, 0, 2, 3, 0]);
  const cum = cumulativeLengths(pts);
  const out = new Float32Array(3);

  it('measure the polyline and find points along it, clamped to its ends', () => {
    expect(Array.from(cum)).toEqual([0, 2, 5]);
    pointAlong(pts, cum, 1, out);
    expect(Array.from(out)).toEqual([1, 0, 0]);
    expect(pointAlong(pts, cum, 3.5, out)).toBe(1);
    expect(Array.from(out)).toEqual([2, 1.5, 0]);
    pointAlong(pts, cum, -1, out);
    expect(Array.from(out)).toEqual([0, 0, 0]);
    pointAlong(pts, cum, 99, out, 1);
    expect(Array.from(out)).toEqual([2, 3, 0]);
  });

  it('extrapolate between ticks at the packet speed and stop at the end', () => {
    expect(packetDistance(1, 4, 0.025, 5, 5)).toBeCloseTo(1.1);
    expect(packetDistance(4.9, 4, 1, 5, 5)).toBe(5);
    expect(packetDistance(2, 0, 3, 5, 5)).toBe(2); // waiting (blocked) packets stay put
    expect(packetDistance(2.5, 0, 0, 5, 10)).toBe(5); // scaled to the polyline's own length
  });

  it('draw block items as cubes and everything else as icons', () => {
    expect(itemLook('iron_ore').icon).toBe(false);
    expect(itemLook('coal').icon).toBe(true);
    expect(itemLook('coal').side).toBe(itemOrNull('coal')!.iconLayer);
    expect(itemLook('item_pipe').icon).toBe(true); // a pipe block is not cube-like
  });
});

describe('pipe overlay', () => {
  it('masks the window texels of each pipe tile in its own channel', () => {
    const m = buildPipeMask();
    const count = (ch: number): number => {
      let n = 0;
      for (let i = 0; i < 256; i++) if (m[i * 4 + ch] === 255) n++;
      return n;
    };
    // Fluid pipe sight glasses: the outer 3 texels x 4 rows of each of the tile's 4 arms; hot pipe ports 2x2 per arm.
    expect(count(0)).toBe(4 * 3 * 4);
    expect(count(1)).toBe(4 * 2 * 2);
    expect(count(2)).toBeGreaterThan(40); // item pipe glass
    expect(count(3)).toBeGreaterThan(10); // conveyor roller gaps
    // Never in the junction square or the clear corners.
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const band = (v: number): boolean => v >= 4 && v <= 11;
        if (band(x) === band(y)) for (let c = 0; c < 4; c++) expect(m[(y * 16 + x) * 4 + c]).toBe(0);
      }
    }
  });

  it('rebuilds the mesher pipe: a core, arms to joined neighbours, collars at endpoints', () => {
    const w = new FakeWorld();
    w.put(0, 20, 0, 'fluid_pipe');
    w.put(1, 20, 0, 'fluid_pipe');
    w.put(-1, 20, 0, 'tank');
    w.put(0, 21, 0, 'item_pipe'); // another family: no arm
    const out: number[] = [];
    const n = pipePieces(blockId('fluid_pipe'), 0, 20, 0, 2, (x, y, z) => w.getVoxel(x, y, z), out);
    expect(n).toBe(4); // core, +x arm, -x arm, -x collar
    const piece = (i: number): number[] => out.slice(i * 11, i * 11 + 11);
    const arms = (1 << Face.PX) | (1 << Face.NX);
    expect(piece(0)).toEqual([PIPE_CORE_MIN, 20 + PIPE_CORE_MIN, PIPE_CORE_MIN, PIPE_CORE_MAX, 20 + PIPE_CORE_MAX, PIPE_CORE_MAX, arms, 2, 3, 0, 0]);
    expect(piece(1).slice(0, 9)).toEqual([PIPE_CORE_MAX, 20 + PIPE_CORE_MIN, PIPE_CORE_MIN, 1, 20 + PIPE_CORE_MAX, PIPE_CORE_MAX, 3, 2, 0]);
    expect(piece(2)[0]).toBeCloseTo(PIPE_COLLAR_DEPTH);
    expect(piece(2)[3]).toBe(PIPE_CORE_MIN);
    expect(piece(3)[8]).toBe(4); // a collar on the x axis
    expect(piece(3)[6]).toBe(1 << Face.NX); // its face against the tank is hidden
  });

  it('shows a stream in a pipe that passes fluid straight through', () => {
    expect(shownLevel({ fill: 0, flowing: true })).toBe(0.6);
    expect(shownLevel({ fill: 0.8, flowing: true })).toBe(0.8);
    expect(shownLevel({ fill: 0.3, flowing: false })).toBe(0.3);
  });
});

describe('hearths', () => {
  it('use the same heat ramp as the UI', () => {
    expect(HEAT_RAMP.map(([t, r, g, b]) => ({ tempC: t, rgb: [r, g, b] }))).toEqual(HEAT_STOPS.map((s) => ({ tempC: s.tempC, rgb: [...s.rgb] })));
    const c = new Float32Array(3);
    expect(Array.from(heatColor(800, c)).map((v) => Math.round(v * 255))).toEqual([242, 107, 29]);
    expect(Array.from(heatColor(650, c)).map((v) => Math.round(v * 255))).toEqual([198, 75, 25]);
    expect(Array.from(heatColor(9999, c)).map((v) => Math.round(v * 255))).toEqual([143, 184, 255]);
    expect(heatGlow(100)).toBe(0);
    expect(heatGlow(2000)).toBe(1);
    expect(heatGlow(475)).toBeCloseTo(0.5);
  });

  it('read the formed box off the furnace entity', () => {
    const e = { kind: 'furnace', x: 5, y: 10, z: 3, hearth: { tier: 3, inner: [3, 3, 2], closed: false, windows: 0, min: [4, 9, 3], max: [8, 11, 7] } };
    const open = hearthBox(e)!;
    expect(open.inner).toEqual([5, 10, 4, 7, 11, 6]);
    expect(hearthOpenTop(e)).toBe(true);
    const closed = hearthBox({ ...e, hearth: { ...e.hearth, closed: true, max: [8, 12, 7] } })!;
    expect(closed.inner).toEqual([5, 10, 4, 7, 11, 6]);
    expect(hearthBox({ ...e, hearth: null })).toBeNull();
    expect(hearthBox({ ...e, hearth: { tier: 3, min: [1, 2], max: [3, 4, 5] } })).toBeNull();
    expect(hearthBox({ ...e, kind: 'crate' })).toBeNull();
    expect(shellNormal(open, 4, 10, 5)).toEqual([-1, 0, 0]);
    expect(shellNormal(open, 6, 10, 7)).toEqual([0, 0, 1]);
    expect(shellNormal(closed, 6, 12, 5)).toEqual([0, 1, 0]);
    expect(shellNormal(open, 6, 10, 5)).toBeNull();
  });
});

describe('ghost sight lines', () => {
  it('see through air, faintly through leaves, never through stone', () => {
    const w = new FakeWorld(0);
    expect(sightTo(w, 0.5, 20.5, 0.5, 6, 20, 0)).toBe(CLEAR);
    w.put(3, 20, 0, 'oak_leaves');
    expect(sightTo(w, 0.5, 20.5, 0.5, 6, 20, 0)).toBe(LEAVES_ONLY);
    w.put(4, 20, 0, 'stone');
    expect(sightTo(w, 0.5, 20.5, 0.5, 6, 20, 0)).toBe(BLOCKED);
    // The ghost's own cell and the eye's own cell never count.
    const v = new FakeWorld(0);
    v.put(6, 21, 0, 'stone');
    v.put(0, 21, 0, 'stone');
    expect(sightTo(v, 0.5, 21.5, 0.5, 6, 21, 0)).toBe(CLEAR);
  });
});

describe('problem highlight', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Just enough DOM for the edge arrow (the test runs in node). */
  const make = (): { bus: ReturnType<typeof createBus>; hl: BlockHighlight; cam: THREE.PerspectiveCamera } => {
    const el = (): object => ({ style: {}, remove: () => undefined });
    vi.stubGlobal('document', { getElementById: () => null, createElement: el, head: { appendChild: () => undefined } });
    const canvas = { clientWidth: 400, clientHeight: 800, after: () => undefined } as unknown as HTMLCanvasElement;
    const bus = createBus();
    const cam = new THREE.PerspectiveCamera(70, 0.5, 0.1, 100);
    cam.updateMatrixWorld();
    return { bus, hl: new BlockHighlight(bus, canvas), cam };
  };

  it('fades out once the hearth round the marked block forms, instead of marking a solved problem', () => {
    const { bus, hl, cam } = make();
    bus.emit('highlight:block', { x: 4, y: 10, z: 2, seconds: 10 });
    hl.update(0.5, cam);
    expect(hl.remaining).toBeCloseTo(9.5);
    bus.emit('hearth:formed', { x: 5, y: 10, z: 4, tier: 1, min: [3, 9, 2], max: [7, 12, 6] });
    expect(hl.remaining).toBeLessThanOrEqual(0.6);
    expect(hl.remaining).toBeGreaterThan(0);
    hl.update(0.3, cam);
    expect(hl.remaining).toBeGreaterThan(0); // fading, not vanished
    hl.update(0.3, cam);
    expect(hl.remaining).toBe(0);
    expect(hl.group.visible).toBe(true);
    hl.update(0.016, cam);
    expect(hl.group.visible).toBe(false);
    hl.dispose();
  });

  it('keeps a highlight on another structure, and one that is already fading, as they are', () => {
    const { bus, hl } = make();
    bus.emit('highlight:block', { x: 40, y: 10, z: 2, seconds: 10 });
    bus.emit('hearth:formed', { x: 5, y: 10, z: 4, tier: 1, min: [3, 9, 2], max: [7, 12, 6] });
    expect(hl.remaining).toBe(10);
    bus.emit('highlight:block', { x: 4, y: 10, z: 2, seconds: 0.3 });
    bus.emit('hearth:formed', { x: 5, y: 10, z: 4, tier: 1, min: [3, 9, 2], max: [7, 12, 6] });
    expect(hl.remaining).toBe(0.3);
    hl.dispose();
    bus.emit('highlight:block', { x: 4, y: 10, z: 2, seconds: 5 });
    expect(hl.remaining).toBe(0.3); // unsubscribed
  });
});

describe('highlight arrow', () => {
  const out: EdgeArrow = { visible: false, x: 0, y: 0, angle: 0 };
  const ins = { side: 40, top: 60, bottom: 100 };
  it('hides while the block is on screen', () => {
    expect(edgeArrow(0, 0, -5, 0.2, -0.4, 800, 600, ins, out).visible).toBe(false);
  });
  it('sits inside the keep-out bands, on the line from the centre towards the block', () => {
    edgeArrow(10, 0, -5, 3, 0, 800, 600, ins, out);
    expect(out).toMatchObject({ visible: true, x: 760, y: 300 });
    expect(out.angle).toBeCloseTo(0);
    edgeArrow(0, 10, -5, 0, 4, 800, 600, ins, out);
    expect(out).toMatchObject({ x: 400, y: 60 });
    expect(out.angle).toBeCloseTo(-Math.PI / 2);
    edgeArrow(0, -10, -5, 0, -4, 800, 600, ins, out);
    expect(out).toMatchObject({ x: 400, y: 500 }); // above the hotbar band
  });
  it('points the way to turn for a block behind the camera', () => {
    edgeArrow(-3, -2, 5, 0.9, 0.5, 800, 600, ins, out); // behind and to the left: the projection would lie
    expect(out).toMatchObject({ visible: true, x: 40, y: 300 });
    expect(Math.abs(out.angle)).toBeCloseTo(Math.PI);
    edgeArrow(0.5, 0, 5, 0, 0, 800, 600, ins, out);
    expect(out.x).toBe(760);
  });
});

describe('cell light', () => {
  it('probes a few cells per update and answers -1 until then', () => {
    const w = new FakeWorld(10);
    const light = new CellLight(w, 2, 0);
    expect(light.get(0, 20, 0)).toBe(-1);
    expect(light.get(1, 20, 0)).toBe(-1);
    expect(light.get(2, 20, 0)).toBe(-1);
    light.update();
    const lit = [light.get(0, 20, 0), light.get(1, 20, 0), light.get(2, 20, 0)].filter((v) => v >= 0);
    expect(lit).toHaveLength(2);
    expect(skyOf(lit[0])).toBe(1); // open sky
    light.update();
    expect(light.get(0, 20, 0)).toBe(packLight(1, 0));
    expect(blockOf(packLight(0.4, 0.6))).toBeCloseTo(0.6);
  });
});
