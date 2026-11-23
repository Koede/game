import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { block, itemOrNull } from '../core/registry';
import { makeVoxel } from '../core/types';
import { RESEARCH_GATES } from '../magic/gates';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';
import { REPAIR_JOBS, REPAIRED_BLOCK, RUINED_BLOCK, Restoration, jobAt } from './restoration';

function rig() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  const r = new Restoration(world, bus, player);
  const place = (x: number): { x: number; y: number; z: number; block: { key: string } } => {
    world.setVoxel(x, 10, 0, makeVoxel(block(RUINED_BLOCK).id));
    return { x, y: 10, z: 0, block: { key: RUINED_BLOCK } };
  };
  return { world, player, toasts, r, place };
}

describe('repair jobs', () => {
  it('only unlock research-gated recipes and ask for real items', () => {
    for (const j of REPAIR_JOBS) {
      expect(RESEARCH_GATES.has(j.recipe), j.recipe).toBe(true);
      for (const [item] of j.parts) expect(itemOrNull(item), item).not.toBeNull();
    }
    expect(new Set(REPAIR_JOBS.map((j) => j.recipe)).size).toBe(REPAIR_JOBS.length);
  });

  it('give every machine the same job in the same world and spread over all jobs', () => {
    expect(jobAt(5, 1, 2, 3)).toBe(jobAt(5, 1, 2, 3));
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) seen.add(jobAt(9, i * 7, 20, i * 3).recipe);
    expect(seen.size).toBe(REPAIR_JOBS.length);
  });
});

describe('repairing', () => {
  it('names the parts when they are missing and leaves the machine alone', () => {
    const { r, place, toasts, world } = rig();
    const aim = place(0);
    expect(r.use(aim)).toBe('refused');
    expect(toasts.at(-1)).toMatch(/Bring .*to repair it/);
    expect(world.getBlock(0, 10, 0).key).toBe(RUINED_BLOCK);
    expect(r.use({ x: 0, y: 10, z: 0, block: { key: 'stone' } })).toBeNull();
  });

  it('takes the parts, becomes a repaired machine and unlocks the recipe over the research gate', () => {
    const { r, place, player, world, toasts } = rig();
    const aim = place(0);
    const job = jobAt(world.seed, 0, 10, 0);
    for (const [item, n] of job.parts) player.inventory.add(item, n + 1);
    expect(r.gate(() => 'Research it first')(job.recipe)).toBe('Research it first');
    expect(r.use(aim)).toBe('worked');
    expect(world.getBlock(0, 10, 0).key).toBe(REPAIRED_BLOCK);
    for (const [item] of job.parts) expect(player.inventory.count(item)).toBe(1);
    expect(r.unlocked(job.recipe)).toBe(true);
    expect(r.gate(() => 'Research it first')(job.recipe)).toBeNull();
    expect(r.gate(() => 'Research it first')('some_other')).toBe('Research it first');
    expect(toasts.at(-1)).toMatch(/shudders awake/);
    const again = new Restoration(world, createBus(), player);
    again.load(JSON.parse(JSON.stringify(r.toJSON())));
    expect(again.unlocked(job.recipe)).toBe(true);
  });

  it('refuses a second machine whose recipe is already known, without taking parts', () => {
    const { r, place, player, world } = rig();
    const a = place(0);
    const job = jobAt(world.seed, 0, 10, 0);
    for (const [item, n] of job.parts) player.inventory.add(item, n * 2);
    r.use(a);
    r.load([job.recipe]);
    world.setVoxel(0, 10, 0, makeVoxel(block(RUINED_BLOCK).id));
    const before = job.parts.map(([i]) => player.inventory.count(i));
    expect(r.use(a)).toBe('refused');
    expect(job.parts.map(([i]) => player.inventory.count(i))).toEqual(before);
  });
});
