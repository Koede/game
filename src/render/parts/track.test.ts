import { describe, expect, it } from 'vitest';
import { buildHearthModel } from '../formed/hearthModel';
import { MeshBuilder } from '../formed/meshBuilder';
import { evalParts, MAX_PARTS, newMotion, Phase, stepMotion, type PartDef } from './track';

const apply = (m: Float32Array, slot: number, p: [number, number, number]): number[] => {
  const o = slot * 16;
  return [0, 1, 2].map((r) => m[o + r] * p[0] + m[o + 4 + r] * p[1] + m[o + 8 + r] * p[2] + m[o + 12 + r]);
};
const near = (a: number[], b: number[]): void => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 4));
const out = (): Float32Array => new Float32Array(16 * (MAX_PARTS + 1));

describe('motion states', () => {
  it('goes idle -> starting -> running, then stopping -> idle, coasting rather than jumping', () => {
    const m = newMotion();
    expect(m.phase).toBe(Phase.Idle);
    stepMotion(m, 0.1, 1);
    expect(m.phase).toBe(Phase.Starting);
    expect(m.speed).toBeGreaterThan(0);
    expect(m.speed).toBeLessThan(0.3);
    for (let i = 0; i < 100; i++) stepMotion(m, 0.1, 1);
    expect(m.phase).toBe(Phase.Running);
    stepMotion(m, 0.1, 0);
    expect(m.phase).toBe(Phase.Stopping);
    expect(m.speed).toBeGreaterThan(0.9); // a flywheel coasts
    const angle = m.angle;
    for (let i = 0; i < 200; i++) stepMotion(m, 0.1, 0);
    expect(m.phase).toBe(Phase.Idle);
    expect(m.speed).toBe(0);
    expect(m.angle).toBeGreaterThan(angle); // it kept turning while it stopped
  });
});

describe('tracks', () => {
  const part = (tracks: PartDef['tracks'], pivot: PartDef['pivot'] = [0, 0, 0], parent = -1): PartDef => ({ name: 'p', parent, pivot, tracks });

  it('spin turns about the pivot and keeps the pivot fixed', () => {
    const m = newMotion();
    m.angle = Math.PI / 2;
    const o = out();
    evalParts([part([{ type: 'spin', axis: [0, 1, 0], rate: 1 }], [5, 0, 5])], m, o);
    near(apply(o, 1, [5, 3, 5]), [5, 3, 5]);
    near(apply(o, 1, [6, 0, 5]), [5, 0, 4]); // a quarter turn about +y
    near(apply(o, 0, [1, 2, 3]), [1, 2, 3]); // slot 0 is the static root
  });

  it('osc moves along its direction and its stroke follows the speed', () => {
    const m = newMotion();
    m.cycles = 0.25;
    m.speed = 1;
    const o = out();
    const def = part([{ type: 'osc', dir: [1, 0, 0], amp: 0.2, hz: 1 }]);
    evalParts([def], m, o);
    near(apply(o, 1, [0, 0, 0]), [0.2, 0, 0]);
    m.speed = 0.5;
    evalParts([def], m, o);
    near(apply(o, 1, [0, 0, 0]), [0.1, 0, 0]);
  });

  it('ramp and swing follow the eased level; scale stretches about the pivot', () => {
    const m = newMotion();
    m.level = 1;
    const o = out();
    evalParts([part([{ type: 'ramp', dir: [0, -1, 0], amount: 0.5 }])], m, o);
    near(apply(o, 1, [0, 1, 0]), [0, 0.5, 0]);
    evalParts([part([{ type: 'swing', axis: [1, 0, 0], amount: -Math.PI / 2, ease: 'linear' }])], m, o);
    near(apply(o, 1, [0, 0, 1]), [0, 1, 0]); // a hinge lifting its free edge
    evalParts([part([{ type: 'scale', axis: [0, 0, 1], amount: 1, ease: 'linear' }], [0, 0, 2])], m, o);
    near(apply(o, 1, [0, 0, 3]), [0, 0, 4]);
    near(apply(o, 1, [0, 0, 2]), [0, 0, 2]);
    m.level = 0;
    evalParts([part([{ type: 'ramp', dir: [0, -1, 0], amount: 0.5 }])], m, o);
    near(apply(o, 1, [0, 1, 0]), [0, 1, 0]);
  });

  it('a child rides on its parent', () => {
    const m = newMotion();
    m.level = 1;
    const o = out();
    evalParts(
      [part([{ type: 'ramp', dir: [1, 0, 0], amount: 2, ease: 'linear' }]), part([{ type: 'ramp', dir: [0, 1, 0], amount: 1, ease: 'linear' }], [0, 0, 0], 0)],
      m,
      o,
    );
    near(apply(o, 2, [0, 0, 0]), [2, 1, 0]);
  });
});

describe('parts in models', () => {
  it('tags vertices with their part and keeps the static ones at slot 0', () => {
    const b = new MeshBuilder();
    b.box(0, 0, 0, 1, 1, 1, 1, [1, 1, 1]);
    const i = b.part('arm', [0, 0, 0], [{ type: 'spin', axis: [0, 1, 0], rate: 1 }]);
    b.box(1, 0, 0, 2, 1, 1, 1, [1, 1, 1]);
    b.endPart();
    const m = b.build([2, 1, 1]);
    expect(i).toBe(0);
    expect(m.parts.map((p) => p.name)).toEqual(['arm']);
    expect(new Set(m.partIds)).toEqual(new Set([0, 1]));
    expect(m.partIds.length).toBe(m.vertexCount);
  });

  it('refuses more than the part limit', () => {
    const b = new MeshBuilder();
    for (let i = 0; i < MAX_PARTS; i++) b.part('x', [0, 0, 0], []);
    expect(() => b.part('y', [0, 0, 0], [])).toThrow(/parts/);
  });

  const spec = (tier: number, closed: boolean, parts: { cell: [number, number, number]; normal: [number, number, number]; kind: string }[] = []) => ({
    kind: 'hearth', tier, size: [5, 5, 5] as [number, number, number], closed, parts, controller: null,
  });

  it('gives each hearth its moving parts: damper, blower fan and bellows, electrode, coil, star ring', () => {
    const names = (tier: number, closed: boolean, parts = [] as Parameters<typeof spec>[2]): string[] => buildHearthModel(spec(tier, closed, parts)).parts.map((p) => p.name);
    expect(names(3, false)).toEqual(['damper']);
    const blower = [{ cell: [4, 2, 2] as [number, number, number], normal: [1, 0, 0] as [number, number, number], kind: 'blower' }];
    expect(names(3, false, blower)).toEqual(expect.arrayContaining(['bellows', 'fan']));
    expect(names(4, true, [{ cell: [2, 4, 2], normal: [0, 1, 0], kind: 'electrode' }])).toEqual(['electrode']);
    expect(names(5, true)).toEqual(['coil']);
    expect(names(6, true)).toEqual(['ring']);
    const m = buildHearthModel(spec(6, true));
    expect(Math.max(...m.partIds)).toBe(m.parts.length);
  });
});
