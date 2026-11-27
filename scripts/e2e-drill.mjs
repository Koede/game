// Phone check of the drill rig with real taps (window.__hw only builds the pen and reads state): power it from a burner
// generator, fit a bit through its screen, watch it drill out its 3 by 3 shaft, and see the bit blunt.
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';
import { ensureBuilt, e2eDist } from './lib/e2eArgs.mjs';

const root = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-drill');
mkdirSync(shots, { recursive: true });
const dist = e2eDist(root, argv);
await ensureBuilt(argv, dist);
const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
let rig = null;
let gen = null;

/** Opens the screen of the block at `pos` with a real aim and Use. */
async function openAt(pos, type = 'machine') {
  assert(await d.aimAt(pos), `aimed at ${JSON.stringify(pos)}`);
  await d.use();
  await d.waitScreen(type);
  await d.settle(600);
}

/** Taps the bag slot holding `item`, then the "Move to <label>" button. */
async function moveFromBag(item, label) {
  const slot = await d.hw((it) => window.__hw.state().inventory.find((s) => s.item === it)?.slot ?? -1, item);
  assert(slot >= 0, `${item} in the bag`);
  const view = page.locator(slot < 9 ? '.hw-window .hw-bag__hotbar .hw-slot' : '.hw-window .hw-bag .hw-slot:not(.hw-slot--sm)').nth(slot < 9 ? slot : slot - 9);
  assert(await view.count(), `bag view for slot ${slot}`);
  await d.press(view);
  await d.settle(300);
  const btn = page.locator('.hw-window button', { hasText: new RegExp(`^\s*To ${label}\s*$`, 'i') }).first();
  if (await btn.count()) await d.press(btn);
  await d.settle(400);
}

try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'drill-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  await report.step('a drill rig and a burner generator stand on a stone shelf', async () => {
    ({ rig, gen } = await d.hw(() => {
      const hw = window.__hw;
      hw.setTime(0.1);
      hw.clearInventory();
      const p = hw.state().player;
      const px = Math.floor(p.x), py = Math.floor(p.y) + 8, pz = Math.floor(p.z);
      // A platform to stand on, a clear room above it, and solid stone with an ore vein under the rig.
      for (let dx = -4; dx <= 4; dx++) for (let dz = -7; dz <= 2; dz++) {
        for (let dy = -5; dy <= -1; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'stone');
        for (let dy = 0; dy <= 4; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'air');
      }
      const rx = px, rz = pz - 4;
      hw.setVoxel(rx + 1, py - 1, rz, 'coal_ore');
      hw.setVoxel(rx - 1, py - 1, rz - 1, 'copper_ore');
      hw.teleport(px + 0.5, py, pz + 0.5);
      hw.setVoxel(rx, py, rz, 'drill_rig', 0);
      hw.setVoxel(rx + 1, py, rz, 'burner_generator', 0);
      hw.setVoxel(rx, py + 1, rz, 'crate', 0);
      hw.give('drill_bit', 1);
      hw.give('coal', 16);
      return { rig: { x: rx, y: py, z: rz }, gen: { x: rx + 1, y: py, z: rz } };
    }));
    await d.settle(1200);
    await d.shot('01-rig');
  });

  await report.step('the rig screen says it needs a bit; a tap fits one', async () => {
    await openAt(rig);
    let text = await page.locator('.hw-mach-window').innerText();
    assert(/needs a drill bit/i.test(text), `status: ${text.slice(0, 300)}`);
    assert(/bit sharpness/i.test(text) && /no bit/i.test(text), `bit meter: ${text.slice(0, 300)}`);
    await d.shot('02-needs-bit');
    await moveFromBag('drill_bit', 'Drill bit');
    text = await page.locator('.hw-mach-window').innerText();
    assert(/64 of 64 blocks/.test(text), `bit fitted: ${text.slice(0, 400)}`);
    await d.shot('03-bit-fitted');
    await d.closeScreen();
  });

  await report.step('coal in the burner generator powers the rig', async () => {
    await openAt(gen);
    await moveFromBag('coal', 'Burner Generator');
    const fuel = await d.hw((g) => window.__hw.getBlock(g.x, g.y, g.z).block, gen);
    assert(fuel === 'burner_generator', 'generator stands');
    await d.closeScreen();
    const left = await d.hw(() => window.__hw.state().inventory.find((s) => s.item === 'coal')?.count ?? 0);
    assert(left < 16, `coal went in (left ${left})`);
  });

  await report.step('the rig drills out the top layer of its 3 by 3 shaft and blunts its bit', async () => {
    await waitFor(page, (r) => {
      const hw = window.__hw;
      let gone = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (hw.getBlock(r.x + dx, r.y - 1, r.z + dz).block === 'air') gone++;
      return gone >= 9;
    }, 'top layer drilled', { timeout: 90_000, arg: rig });
    await openAt(rig);
    const text = await page.locator('.hw-mach-window').innerText();
    assert(/drilling at depth|current block/i.test(text), `running: ${text.slice(0, 300)}`);
    const m = /(\d+) of 64 blocks/.exec(text);
    assert(m && Number(m[1]) <= 55, `bit blunted: ${m?.[0]}`);
    await d.shot('04-drilling');
    await d.closeScreen();
  });

  await report.step('finds go to the crate on top', async () => {
    await openAt({ x: rig.x, y: rig.y + 1, z: rig.z }, 'crate');
    const filled = await page.locator('.hw-window .hw-slot img, .hw-window .hw-slot canvas').count();
    await d.shot('05-crate');
    await d.closeScreen();
    assert(filled > 0, 'the crate holds what the rig found');
  });

  await report.step('looking down the shaft once a second layer is out', async () => {
    await waitFor(page, (r) => window.__hw.getBlock(r.x, r.y - 2, r.z).block === 'air' && window.__hw.getBlock(r.x + 1, r.y - 2, r.z + 1).block === 'air', 'second layer', { timeout: 120_000, arg: rig });
    await d.hw((r) => {
      window.__hw.setTime(0.1);
      window.__hw.teleport(r.x + 0.5, r.y, r.z + 3.5);
    }, rig);
    await d.settle(800);
    await d.hw((r) => window.__hw.lookAt(r.x, r.y - 1.5, r.z), rig);
    await d.settle(1500);
    await d.shot('06-shaft');
  });
} finally {
  await session.close?.();
}
report.finish?.(errors);
