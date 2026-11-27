// Browser check of waypoint stones (headless Chromium, real taps; window.__hw only sets up and reads):
//   node scripts/e2e-waypoints.mjs --out=<dir-with-a-build> --device=phonePortrait --shots=<dir>
// Use a stone: the picker opens; the Travel button is greyed without charcoal, travels with it; the journal map circles the stones.
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
const shots = resolve(flag('shots', join(root, 'test-results/e2e-waypoints')));
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
  if (report.failures !== before) { ok = false; await d.shot(`FAILED-${name.replace(/\W+/g, '-')}`).catch(() => undefined); }
};
const S = { x: 0, y: 0, z: 0 };

try {
  await step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'way-e2e');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(2000);
  });

  await step('a stone stands in front of the player and a far one is already known', async () => {
    const r = await d.hw(() => {
      const hw = window.__hw;
      hw.setTime(0.1);
      hw.clearInventory();
      const p = hw.state().player;
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 5; dz++) {
        hw.setVoxel(px + dx, py - 1, pz + dz, 'stone');
        for (let dy = 0; dy <= 3; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'air');
      }
      hw.setVoxel(px, py, pz + 3, 'waypoint_stone');
      const ex = hw.app.game.state.exploration;
      ex.waypoints.place(px, py, pz + 3);
      ex.waypoints.place(px + 150, py, pz - 40, 'Far Camp');
      hw.teleport(px + 0.5, py, pz + 0.5);
      return { x: px, y: py, z: pz + 3 };
    });
    Object.assign(S, r);
    await d.settle(500);
  });

  await step('Use opens the picker, Travel is greyed without charcoal', async () => {
    await d.hw((q) => window.__hw.lookAt(q.x, q.y, q.z), S);
    await waitFor(page, (q) => { const t = window.__hw.state().target; return !!t && t.x === q.x && t.z === q.z; }, 'the stone under the crosshair', { timeout: 4000, interval: 100, arg: S });
    await d.use();
    await d.waitScreen('waypoints');
    await d.settle(300);
    const text = await page.locator('.hw-way').innerText();
    assert(/Far Camp/.test(text) && /charcoal/i.test(text), text);
    assert((await page.locator('[data-travel]').getAttribute('aria-disabled')) === 'true', 'travel should be greyed');
    await d.shot('01-picker-no-fuel');
    await page.locator('[data-travel]').dispatchEvent('click');
    await d.settle(200);
    assert(/needs \d+ charcoal/.test(await page.locator('.hw-way__status').innerText()), 'a refusal line');
  });

  await step('with charcoal Travel moves the player and takes the fuel', async () => {
    await d.hw(() => { window.__hw.app.game.state.player.inventory.add('charcoal', 6); });
    await d.settle(400);
    assert((await page.locator('[data-travel]').getAttribute('aria-disabled')) !== 'true', 'travel should be enabled');
    await d.shot('02-picker-fuel');
    await d.press(page.locator('[data-travel]'));
    await d.settle(800);
    const r = await d.hw(() => ({ p: window.__hw.state().player, c: window.__hw.app.game.state.player.inventory.count('charcoal') }));
    assert(Math.abs(r.p.x - (S.x + 150.5)) < 2, `player at ${r.p.x}`);
    assert(r.c < 6, `charcoal ${r.c}`);
  });

  await step('the journal map circles the stones with a key', async () => {
    await d.hw(() => window.__hw.app.game.bus.emit('ui:open', { screen: { type: 'log' } }));
    await d.waitScreen('log');
    await d.settle(1500);
    const key = await page.locator('.hw-journal__key').innerText();
    assert(/Waypoint/.test(key) && /Far Camp/.test(key), key);
    await page.locator('.hw-journal__map').scrollIntoViewIfNeeded();
    await d.shot('03-journal-map');
    await d.closeScreen();
  });

  await step('no console errors', async () => { assert(errors.length === 0, errors.slice(0, 5).join(' | ')); });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
