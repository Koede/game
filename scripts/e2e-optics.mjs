// Phone/desktop check of glass and optics (docs/api/optics.md): an old lighthouse stands on a shore of a new world; a
// Lighthouse Lamp set on its plinth and fed coal lights it (beam, ward, Hearth Log); the spyglass raised far off zooms in
// and spots the lighthouse; a telescope at night reads the weather in the stars.
//   node scripts/e2e-optics.mjs [--no-build] [--device=phonePortrait]
// `window.__hw` only sets up (blocks, items, time) and reads state; raising the glass goes through the real Use control.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-optics');
mkdirSync(shots, { recursive: true });
const dist = e2eDist(root, argv);
await ensureBuilt(argv, dist);

const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
let L = null;

/** Teleports and waits until the ground under (x, z) is loaded. */
async function goTo(x, y, z) {
  await d.hw((p) => window.__hw.teleport(p.x, p.y, p.z), { x, y, z });
  await waitFor(page, (p) => window.__hw.surfaceY(Math.floor(p.x), Math.floor(p.z)) > 0, 'ground loaded', { timeout: 60_000, interval: 250, arg: { x, z } });
  await d.settle(600);
}

try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'optics-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  await report.step('an old lighthouse stands on a shore within reach', async () => {
    const m = await d.hw(() => window.__hw.app.game.optics.nearby(1800).find((l) => l.name === 'Old Lighthouse') ?? null);
    assert(m !== null, 'no lighthouse within 1800 blocks');
    // The site's centre is x0 + 3.5: the door is at local (3, 0), the lamp's plinth at local (3, 3).
    L = { x0: Math.round(m.x - 3.5), z0: Math.round(m.z - 3.5), distance: m.distance };
    await goTo(L.x0 + 3.5, 90, L.z0 - 14);
    await waitFor(page, (p) => window.__hw.getBlock(p.x0 + 3, 60, p.z0 + 3).block !== undefined && window.__hw.surfaceY(p.x0 + 3, p.z0 + 3) > 30, 'tower loaded', { timeout: 60_000, interval: 250, arg: L });
    L.top = await d.hw((p) => {
      for (let y = 100; y > 20; y--) if (window.__hw.getBlock(p.x0 + 3, y, p.z0 + 3).block === 'brick') return y;
      return -1;
    }, L);
    assert(L.top > 0, 'no brick cap on the tower');
    L.lampY = L.top - 3;
    const plinth = await d.hw((p) => window.__hw.getBlock(p.x0 + 3, p.lampY - 1, p.z0 + 3).block, L);
    assert(plinth === 'stone_brick', `plinth is ${plinth}`);
    const ground = await d.hw((p) => window.__hw.surfaceY(p.x0 + 3, p.z0 - 6), L);
    await goTo(L.x0 + 3.5, ground + 1, L.z0 - 6);
    await d.hw((p) => window.__hw.lookAt(p.x0 + 3, p.lampY - 4, p.z0 + 3), L);
    await d.settle(800);
    await d.shot('01-tower');
  });

  await report.step('a lamp on the plinth, fed coal, lights the lighthouse at night', async () => {
    await d.hw((p) => {
      const hw = window.__hw;
      hw.setWeather('clear', true);
      hw.setTime(0.82);
      hw.setVoxel(p.x0 + 3, p.lampY, p.z0 + 3, 'lighthouse_lamp');
    }, L);
    await d.hw(() => window.__hw.tick(10));
    const added = await d.hw((p) => window.__hw.app.game.state.sim.machineSlots(p.x0 + 3, p.lampY, p.z0 + 3)?.add('coal', 4) ?? -1, L);
    assert(added === 0, `coal left over: ${added}`);
    await d.hw(() => window.__hw.tick(60));
    const lamp = await d.hw((p) => window.__hw.getBlock(p.x0 + 3, p.lampY, p.z0 + 3), L);
    assert(lamp.block === 'lighthouse_lamp' && lamp.active, `lamp ${JSON.stringify(lamp)}`);
    const safe = await d.hw((p) => window.__hw.isSafe(p.x0 + 3.5, p.lampY - 10, p.z0 + 3.5), L);
    assert(safe, 'the foot of the tower is not warded');
    const log = await d.hw(() => window.__hw.app.game.state.journal.entries.map((e) => e.text).join(' | '));
    assert(/Lit a lighthouse/.test(log), `journal: ${log.slice(-200)}`);
    // Inside the lantern room, the lamp burning on its plinth.
    await d.hw((p) => window.__hw.teleport(p.x0 + 4.5, p.lampY - 1, p.z0 + 4.5), L);
    await d.settle(400);
    await d.hw((p) => window.__hw.lookAt(p.x0 + 3, p.lampY, p.z0 + 3), L);
    await d.settle(900);
    await d.shot('02-lantern');
  });

  await report.step('the beam sweeps the night, seen from along the shore', async () => {
    const ground = await d.hw((p) => window.__hw.surfaceY(p.x0 - 26, p.z0 - 26), L);
    await goTo(L.x0 - 26, Math.max(ground + 1, 34), L.z0 - 26);
    await d.hw((p) => window.__hw.lookAt(p.x0 + 3, p.lampY - 2, p.z0 + 3), L);
    await d.settle(1500);
    const beams = await d.hw(() => window.__hw.app.game.renderer.beams?.drawn ?? -1);
    assert(beams !== 0, `beams drawn: ${beams}`);
    await d.shot('03-beam');
  });

  await report.step('the spyglass, raised far off with Use, zooms in and spots the lighthouse', async () => {
    await d.hw(() => {
      window.__hw.setTime(0.3);
      window.__hw.clearInventory();
      window.__hw.give('spyglass', 1);
    });
    const far = 56;
    const gx = L.x0 + 3 - far;
    const gz = L.z0 + 3 - 20;
    const gy = await d.hw((p) => window.__hw.surfaceY(p.x, p.z), { x: gx, z: gz });
    await goTo(gx + 0.5, Math.max(gy + 1, 40), gz + 0.5);
    // Stand on a little stone pillar so the shore's trees do not hide the tower.
    await d.hw((p) => {
      const hw = window.__hw;
      const base = Math.max(hw.surfaceY(p.x, p.z) + 1, 33);
      for (let k = 0; k < 14; k++) hw.setVoxel(p.x, base + k, p.z, 'stone');
      hw.teleport(p.x + 0.5, base + 14, p.z + 0.5);
    }, { x: gx, z: gz });
    // Let the chunks between here and the tower stream in.
    await d.settle(2500);
    await d.selectItem('spyglass');
    await d.hw((p) => window.__hw.lookAt(p.x0 + 3, p.lampY - 3, p.z0 + 3), L);
    await d.settle(600);
    await d.use();
    await waitFor(page, () => window.__hw.app.game.optics.raised === 'spyglass', 'spyglass raised', { timeout: 5000, interval: 100 });
    const zoom = await d.hw(() => window.__hw.app.game.controller.zoom);
    assert(zoom === 4, `zoom ${zoom}`);
    await waitFor(page, () => window.__hw.app.game.state.journal.entries.some((e) => /Spotted Old Lighthouse/.test(e.text)), 'lighthouse spotted', { timeout: 8000, interval: 200 });
    await d.settle(700);
    const label = await page.locator('.hw-optics-label').textContent();
    assert(/Old Lighthouse/.test(label ?? '') && /spotted/.test(label ?? ''), `label: ${label}`);
    await d.shot('04-spyglass');
    await d.use();
    await waitFor(page, () => window.__hw.app.game.optics.raised === 'none', 'spyglass lowered', { timeout: 5000, interval: 100 });
    assert(await page.locator('.hw-optics--on').count() === 0, 'eyepiece still shown');
  });

  await report.step('a telescope at night reads the weather in the stars', async () => {
    const at = await d.hw(() => {
      const hw = window.__hw;
      const p = hw.state().player;
      const x = Math.floor(p.x) + 1;
      const z = Math.floor(p.z);
      const y = Math.floor(p.y);
      hw.setVoxel(x, y - 1, z, 'stone');
      hw.setVoxel(x, y, z, 'telescope');
      hw.setTime(0.85);
      hw.clearInventory();
      return { x, y, z };
    });
    await d.settle(400);
    assert(await d.aimAt(at), 'cannot aim at the telescope');
    await d.use();
    await waitFor(page, () => window.__hw.app.game.optics.raised === 'telescope', 'telescope raised', { timeout: 5000, interval: 100 });
    const zoom = await d.hw(() => window.__hw.app.game.controller.zoom);
    assert(zoom === 10, `zoom ${zoom}`);
    await waitFor(page, () => [...document.querySelectorAll('.hw-toast, [class*="toast"]')].some((el) => /The stars say/.test(el.textContent ?? '')), 'sky reading toast', { timeout: 5000, interval: 100 });
    await d.hw((p) => window.__hw.lookAt(p.x0 + 3, p.lampY + 2, p.z0 + 3), L);
    await d.settle(900);
    await d.shot('05-telescope');
  });

  await report.step('no console errors', async () => {
    assert(errors.length === 0, errors.slice(0, 5).join(' | '));
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
