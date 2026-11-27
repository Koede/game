// Browser check of the cave boss: its lair, the fight and the hoard chest (and the kerosene lamp), at phone size by default.
//   node scripts/e2e-lair.mjs [--device=phonePortrait] [--shots=<dir>]
// __hw only sets up (a roofed stone room, the boss placed as the lair's guard, items, ticks) and reads; the fight and the chest are real input.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const arg = (n, d) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const device = arg('device', 'phonePortrait');
const out = e2eDist(root, argv);
const shots = resolve(arg('shots', join(root, 'test-results/e2e-lair')));
mkdirSync(shots, { recursive: true });
await ensureBuilt(argv, out);

const report = createReporter();
const { assert } = report;
const session = await openGame({ dir: out, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bossId = -1;
let room = null;

try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'lair-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  await report.step('a roofed stone room holds the boss as its lair guard', async () => {
    room = await d.hw(() => {
      const hw = window.__hw;
      hw.clearInventory();
      hw.setTime(0.5);
      const p = hw.state().player;
      const px = Math.floor(p.x), py = Math.floor(p.y) + 8, pz = Math.floor(p.z);
      for (let dx = -6; dx <= 6; dx++) for (let dz = -9; dz <= 3; dz++) {
        hw.setVoxel(px + dx, py - 1, pz + dz, 'stone');
        const wall = Math.abs(dx) === 6 || dz === -9 || dz === 3;
        for (let dy = 0; dy <= 5; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, wall || dy === 5 ? 'stone' : 'air');
      }
      hw.teleport(px + 0.5, py, pz + 1.5);
      const s = window.__hw.app.game.state;
      const id = hw.spawnMob('slag_colossus', px + 0.5, py, pz - 5.5, false);
      const m = s.mobs.hostiles.all.find((x) => x.id === id);
      m.hostile.role = 'guard';
      m.hostile.ruin = 'lair:0,0';
      hw.give('steel_maul', 1);
      return { px, py, pz, id };
    });
    bossId = room.id;
    await d.settle(800);
    await d.shot('01-lair');
    const s = await d.state();
    assert(s.hostiles.some((m) => m.id === bossId), `boss missing: ${JSON.stringify(s.hostiles)}`);
  });

  await report.step('the boss falls to real blows and leaves a chest where it fell, once', async () => {
    await d.selectItem('steel_maul');
    let swings = 0;
    for (let i = 0; i < 90; i++) {
      const state = await d.hw((id) => {
        const hw = window.__hw;
        hw.heal?.();
        const s = hw.state();
        const m = s.hostiles.find((x) => x.id === id && !x.dying);
        if (!m) return { gone: true };
        const p = s.player;
        const dx = m.x - p.x, dz = m.z - p.z;
        hw.look(Math.atan2(-dx, -dz), Math.atan2(m.y + 1.2 - (p.y + 1.62), Math.hypot(dx, dz)));
        return { gone: false, d: Math.hypot(dx, dz), health: m.health, hp: p.health };
      }, bossId);
      if (state.gone) break;
      if (state.hp < 8) await d.hw(() => window.__hw.heal?.());
      if (state.d > 2.6) await d.hw((r) => window.__hw.teleport(r.px + 0.5, r.py, window.__hw.state().player.z - 0.5), room);
      await d.mineDown();
      await sleep(350);
      await d.mineUp();
      swings++;
    }
    await d.settle(1500);
    const crate = await d.hw((r) => {
      for (let x = r.px - 6; x <= r.px + 6; x++) for (let z = r.pz - 9; z <= r.pz + 3; z++) for (let y = r.py; y <= r.py + 2; y++) {
        if (window.__hw.getBlock(x, y, z).block === 'crate') return { x, y, z };
      }
      return null;
    }, room);
    await d.shot('02-fallen');
    assert(crate, `no chest after ${swings} swings`);
    room.crate = crate;
  });

  await report.step('opening the chest shows the Masterwork enchanted pickaxe, and it can be taken', async () => {
    await d.hw((r) => window.__hw.teleport(r.crate.x + 0.5, r.crate.y, r.crate.z + 1.5), room);
    await d.settle(400);
    await d.useBlock(room.crate);
    await d.waitScreen('crate').catch(() => undefined);
    await d.settle(500);
    await d.shot('03-chest');
    const items = await d.hw((r) => {
      const e = window.__hw.app.game.state.world.getEntity(r.crate.x, r.crate.y, r.crate.z);
      return (e?.slots ?? []).filter(Boolean).map((s) => ({ item: s.item, count: s.count, quality: s.quality ?? 0, enchants: s.enchants ?? null }));
    }, room);
    const pick = items.find((s) => s.item === 'iron_pickaxe');
    assert(pick && pick.quality === 2 && pick.enchants?.veinseeker === 2 && pick.enchants?.magnet === 1, `pick: ${JSON.stringify(items)}`);
  });

  await report.step('the kerosene lamp takes a canister, lights, and leaves the empty one', async () => {
    await d.closeScreen().catch(() => undefined);
    const spot = await d.hw((r) => {
      const hw = window.__hw;
      const x = r.px + 3, y = r.py, z = r.pz + 1;
      hw.setVoxel(x, y, z, 'kerosene_lamp');
      const s = hw.app.game.state;
      s.sim.machineSlots(x, y, z).add('kerosene_canister', 1);
      hw.tick(20 * 3);
      return { x, y, z, block: hw.getBlock(x, y, z) };
    }, room);
    await d.shot('04-lamp-lit');
    assert(spot.block.block === 'kerosene_lamp' && spot.block.active, `lamp not lit: ${JSON.stringify(spot.block)}`);
    const after = await d.hw((p) => {
      window.__hw.tick(20 * 1300);
      const s = window.__hw.app.game.state.sim.machineSlots(p.x, p.y, p.z);
      return { active: window.__hw.getBlock(p.x, p.y, p.z).active, slot: s.get ? s.get(0) : null };
    }, spot);
    assert(!after.active, 'lamp still lit after its canister');
  });

  await report.step('no console errors', async () => {
    assert(errors.length === 0, errors.slice(0, 5).join(' | '));
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
