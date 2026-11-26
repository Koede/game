// Browser check of the settlement's jobs (headless Chromium, real taps; window.__hw only sets up and reads):
//
//   node scripts/e2e-jobs.mjs --out=<dir-with-a-build>   (build first: node scripts/build.mjs --out=<dir>)
//   node scripts/e2e-jobs.mjs --device=desktop|phonePortrait --shots=<dir>
//
// Talk to Gruk, tap "Give work", set him to haul ore, pick the two stops by aiming and Use, then let a day pass and see the ore arrive.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const device = flag('device', 'phonePortrait');
const dir = e2eDist(root, argv);
await ensureBuilt(argv, dir);
const shots = resolve(flag('shots', join(root, 'test-results/e2e-jobs')));
mkdirSync(shots, { recursive: true });

const report = createReporter();
const session = await openGame({ dir, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
let ok = true;
const step = async (name, run) => {
  if (!ok) return console.log(`  skip ${name}`);
  const before = report.failures;
  await report.step(name, run);
  if (report.failures !== before) {
    ok = false;
    await d.shot(`FAILED-${name.replace(/\W+/g, '-')}`).catch(() => undefined);
  }
};
const A = { x: 0, y: 0, z: 0 };
const B = { x: 0, y: 0, z: 0 };
const depotHolds = (p) => d.hw((q) => window.__hw.app.game.workshop.peek(q.x, q.y, q.z), p);

try {
  await step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'jobs-e2e');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(2000);
  });

  await step('two depots stand on a stone pad, one holding copper ore', async () => {
    const r = await d.hw(() => {
      const hw = window.__hw;
      hw.setTime(0.1);
      hw.clearInventory();
      const p = hw.state().player;
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z) + 6;
      for (let dx = -6; dx <= 6; dx++) for (let dz = -3; dz <= 3; dz++) {
        hw.setVoxel(px + dx, py - 1, pz + dz, 'stone');
        for (let dy = 0; dy <= 3; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'air');
      }
      hw.setVoxel(px - 4, py, pz, 'depot');
      hw.setVoxel(px + 4, py, pz, 'depot');
      hw.teleport(px + 0.5, py, pz + 3.5);
      return { a: { x: px - 4, y: py, z: pz }, b: { x: px + 4, y: py, z: pz } };
    });
    Object.assign(A, r.a);
    Object.assign(B, r.b);
    await d.settle(600);
    const n = await d.hw((q) => window.__hw.app.game.workshop.offer(q.x, q.y, q.z, 'copper_ore', 30), A);
    assert(n === 30, `the depot took ${n} ore`);
  });

  await step('talking to Gruk offers work, and the button opens the Jobs screen', async () => {
    // Put Gruk on the pad in front of the player, and aim at him.
    await d.hw(() => {
      const hw = window.__hw;
      const s = hw.app.game.state;
      const p = s.player.position;
      const me = s.npcs.views().find((v) => v.id === 'gruk');
      const o = s.npcs.at;
      s.npcs.pos?.set?.('gruk', [p.x - o[0] - 0.5, p.z - 2.5 - o[2] - 0.5]);
      hw.look(0, 0);
      return !!me;
    });
    await d.settle(400);
    await d.hw(() => {
      const hw = window.__hw;
      const s = hw.app.game.state;
      const v = s.npcs.views().find((x) => x.id === 'gruk');
      const p = s.player.position;
      hw.lookAt(v.x, v.y + 1.2, v.z);
    });
    await d.use();
    await waitFor(page, () => !document.querySelector('.hw-npcsay')?.hidden, 'the dialogue box', { timeout: 5000, interval: 100 });
    await d.shot('01-dialogue');
    await page.locator('[data-testid="npc-work"]').waitFor({ state: 'visible', timeout: 4000 });
    await d.press(page.locator('[data-testid="npc-work"]'));
    await d.waitScreen('jobs');
    await d.shot('02-jobs-empty');
  });

  await step('Haul, Ore, then pick both stops by aiming and Use', async () => {
    await d.press(page.locator('[data-job="gruk:haul"]'));
    await d.press(page.locator('[data-filter="gruk:ore"]'));
    await d.shot('03-jobs-haul');
    for (const [which, p] of [['from', A], ['to', B]]) {
      await d.press(page.locator(`[data-pick="gruk:${which}"]`));
      await waitFor(page, () => !document.querySelector('.hw-window'), 'the screen closes while aiming', { timeout: 3000, interval: 100 });
      await d.settle(400);
      await d.hw((q) => window.__hw.lookAt(q.x, q.y, q.z), p);
      await waitFor(page, (q) => { const t = window.__hw.state().target; return !!t && t.x === q.x && t.z === q.z; }, `the ${which} depot under the crosshair`, { timeout: 4000, interval: 100, arg: p });
      await d.use();
      await d.settle(500);
      await d.waitScreen('jobs');
    }
    await d.shot('04-jobs-stops');
    const jobs = await d.hw(() => window.__hw.jobs());
    const g = jobs.find((j) => j.id === 'gruk');
    assert(g && JSON.stringify(g.from) === JSON.stringify(A) && JSON.stringify(g.to) === JSON.stringify(B), `stops ${JSON.stringify(g)}`);
  });

  await step('a day passes: the ore is carried across', async () => {
    await d.closeScreen();
    await d.hw(() => window.__hw.tick(20 * 200));
    const to = await depotHolds(B);
    const from = await depotHolds(A);
    const ore = to.filter((e) => e.item === 'copper_ore').reduce((n, e) => n + e.count, 0);
    assert(ore === 30, `the far depot holds ${JSON.stringify(to)}, the near one ${JSON.stringify(from)}`);
    const g = (await d.hw(() => window.__hw.jobs())).find((j) => j.id === 'gruk');
    assert(g.moved === 30, `moved ${g.moved}`);
  });

  await step('the Jobs screen shows what was carried', async () => {
    await d.hw(() => window.__hw.app.game.bus.emit('ui:open', { screen: { type: 'jobs', person: 'gruk' } }));
    await d.waitScreen('jobs');
    await d.settle(300);
    const text = await page.locator('.hw-jobs').innerText();
    assert(/Carried 30/.test(text), text);
    await d.shot('05-jobs-done');
    await d.closeScreen();
  });

  await step('no console errors', async () => {
    assert(errors.length === 0, errors.slice(0, 5).join(' | '));
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
