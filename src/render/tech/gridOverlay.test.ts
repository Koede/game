import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GridCell } from '../../sim';
import { GridOverlay, loadColour } from './gridOverlay';

const cell = (over: Partial<GridCell>): GridCell => ({ x: 0, y: 0, z: 0, kind: 'cable', net: 1, load: 0.2, state: 'ok', short: false, ...over });
const hex = (load: number, state: GridCell['state']): number => loadColour(load, state, new THREE.Color()).getHex();

describe('loadColour', () => {
  it('runs green to amber to red as the cables fill', () => {
    expect(hex(0.1, 'ok')).toBe(0x58e07a);
    const mid = new THREE.Color();
    loadColour(0.75, 'ok', mid);
    expect(mid.r).toBeGreaterThan(0.35);
    expect(mid.g).toBeGreaterThan(0.6);
    expect(hex(0.9, 'ok')).toBe(0xf0b440);
    expect(hex(1, 'ok')).toBe(0xe8503c);
  });
  it('an overloaded grid is red whatever the load, a brown-out is amber-red', () => {
    expect(hex(0.1, 'overload')).toBe(0xe8503c);
    const b = loadColour(0.1, 'brownout', new THREE.Color());
    expect(b.r).toBeGreaterThan(0.8);
    expect(b.g).toBeLessThan(0.6);
  });
});

describe('GridOverlay', () => {
  it('draws cables and machines in their own batches, and hides when fed nothing', () => {
    const o = new GridOverlay();
    o.update(0.05, { tick: 1, cells: [cell({}), cell({ x: 1 }), cell({ x: 2, kind: 'source' }), cell({ x: 3, kind: 'load' })] });
    expect(o.drawn).toBe(4);
    expect(o.group.children.map((m) => (m as THREE.InstancedMesh).count)).toEqual([2, 2]);
    expect(o.group.children.every((m) => m.visible)).toBe(true);
    o.update(0.05, null);
    expect(o.drawn).toBe(0);
    expect(o.group.children.some((m) => m.visible)).toBe(false);
    o.dispose();
  });

  it('only rewrites its instances when the tick changes', () => {
    const o = new GridOverlay();
    const cells = [cell({})];
    o.update(0.05, { tick: 1, cells });
    cells.push(cell({ x: 5 }));
    o.update(0.05, { tick: 1, cells });
    expect(o.drawn).toBe(1);
    o.update(0.05, { tick: 2, cells });
    expect(o.drawn).toBe(2);
    o.dispose();
  });

  it('pulses only while something is wrong', () => {
    const o = new GridOverlay();
    const opacity = () => ((o.group.children[0] as THREE.InstancedMesh).material as THREE.MeshBasicMaterial).opacity;
    o.update(0.1, { tick: 1, cells: [cell({})] });
    expect(opacity()).toBe(0.85);
    o.update(0.1, { tick: 2, cells: [cell({ state: 'brownout' })] });
    expect(opacity()).not.toBe(0.85);
    o.update(0.1, { tick: 3, cells: [cell({ kind: 'load', short: true })] });
    expect(opacity()).not.toBe(0.85);
    o.dispose();
  });
});
