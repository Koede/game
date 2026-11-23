// One screenshot per render-polish feature (docs: src/render). Real world, window.__hw only stages scenes and aims.
//   node scripts/e2e-visuals.mjs [--only=outline,ao,water,light,fog,drops] [--no-build] [--dist=<dir>] [--shots=<dir>] [--device=desktop]
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const device = flag('device')[0] ?? 'desktop';
const only = (flag('only')[0] ?? 'outline,ao,water,light,fog,drops').split(',');
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-visuals'));
const dist = e2eDist(root, argv);
mkdirSync(shots, { recursive: true });
await ensureBuilt(argv, dist);

const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page } = session;
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [page]', m.text().slice(0, 300)); });
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));

const FLOOR = 60;
const watch = (x, y, z) => d.hw((p) => window.__hw.lookAt(p.x, p.y, p.z), { x, y, z });
/** A flat stone pad (21 x 21) high above the terrain around (cx, cz), cleared above; stands on it looking along yaw/pitch. Returns the floor y. */
const stand = async (cx, cz, yaw, pitch) => {
  await d.hw((p) => {
    const w = window.__hw;
    for (let x = p.cx - 10; x <= p.cx + 10; x++) for (let z = p.cz - 10; z <= p.cz + 10; z++) {
      w.setVoxel(x, p.y, z, 'stone');
      for (let y = p.y + 1; y <= p.y + 6; y++) w.setVoxel(x, y, z, 'air');
    }
    w.teleport(p.cx + 0.5, p.y + 1, p.cz + 0.5);
    w.look(p.yaw, p.pitch);
  }, { cx, cz, y: FLOOR, yaw, pitch });
  return FLOOR + 1;
};
const set = (list) => d.hw((l) => { for (const b of l) window.__hw.setVoxel(b[0], b[1], b[2], b[3]); }, list);
const box = (x0, y0, z0, x1, y1, z1, block) => {
  const l = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) l.push([x, y, z, block]);
  return set(l);
};

try {
  await report.step('open a new world', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'visuals-e2e');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(2500);
    await d.hw(() => { window.__hw.setTime(0.3); window.__hw.setWeather('clear'); });
  });

  if (only.includes('outline')) {
    await report.step('outline and cracks on the aimed block', async () => {
      const y = await stand(0, 0, 0, 0);
      await box(-1, y, 3, 1, y + 1, 3, 'stone');
      await d.aimAt({ x: 0, y: y + 1, z: 3 });
      await d.mineDown();
      await d.settle(700);
      await d.shot('outline-cracks');
      await d.mineUp();
    });
  }

  if (only.includes('ao')) {
    await report.step('ambient occlusion in corners', async () => {
      const y = await stand(30, 0, 0, -0.3);
      await box(27, y, 5, 33, y + 1, 5, 'stone');
      await box(30, y + 2, 5, 30, y + 2, 5, 'stone');
      await box(28, y, 3, 32, y, 3, 'dirt');
      await watch(30.5, y + 1, 5);
      await d.settle(1200);
      await d.shot('ao-corners');
    });
  }

  if (only.includes('water')) {
    await report.step('water waves, foam and lava glow', async () => {
      const y = await stand(-30, 0, 0, -0.45);
      await box(-33, y - 1, 3, -27, y - 1, 7, 'water');
      await box(-27, y - 1, 7, -23, y - 1, 7, 'lava');
      await set([[-29, y, 5, 'stone']]);
      await d.hw(() => window.__hw.setTime(0.8));
      await watch(-28, y - 1, 6);
      await d.settle(1500);
      await d.shot('water-lava');
    });
  }

  if (only.includes('light')) {
    await report.step('warm torch, cool magic light and dusk tint', async () => {
      const y = await stand(0, 30, 0, -0.1);
      await box(-3, y, 33, 3, y + 3, 33, 'stone');
      await set([[-1, y + 1, 32, 'torch'], [1, y + 1, 32, 'torch']]);
      await d.hw(() => window.__hw.setTime(0.72));
      await watch(0.5, y + 1, 33);
      await d.settle(1500);
      await d.shot('light-dusk');
    });
  }

  if (only.includes('fog')) {
    await report.step('distance fog towards the horizon', async () => {
      await stand(0, -30, 3.14, 0.05);
      await d.hw(() => window.__hw.setTime(0.3));
      await d.settle(2500);
      await d.shot('fog-distance');
    });
  }

  if (only.includes('drops')) {
    await report.step('item drops bob and glow by rarity', async () => {
      const y = await stand(30, 30, 0, -0.5);
      await d.hw((p) => {
        const g = window.__hw.app.game.state.player.ground;
        ['stick', 'bauxite', 'solar_panel', 'pitchblende', 'furnace_star'].forEach((k, i) => {
          try { g.spawn(k, 1, p.x + (i - 2) * 0.9 + 0.5, p.y, p.z + 3.5, { scatter: false }); } catch { /* unknown key */ }
        });
      }, { x: 30, y, z: 30 });
      await watch(30.5, y, 33.5);
      await d.settle(2000);
      await d.shot('drops-rarity');
    });
  }
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
