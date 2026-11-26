// Browser check of the lodge (docs/plans/just-you-and-orrin.md, phases 3 and 4), headless Chromium with real input:
//
//   node scripts/build.mjs --out=<dir>                                   (build first)
//   node scripts/e2e-lodge.mjs --out=<dir-with-a-build> [--shots=<dir>] [--device=desktop|phonePortrait]
//
// A new world starts at the camp. The storage bay is stocked (window.__hw.supplyLodge: the dev skip for the materials), and days are
// skipped with setDay while Gruk builds the lodge on its plot. Then the lodge stands: its bedroom passes the room check in the
// world, the player wakes there (the respawn point moves to the bedroom), and the common room is shown with its hearth. Screenshots
// of the lodge. window.__hw only sets up and reads.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const device = flag('device', 'desktop');
const dir = e2eDist(root, argv);
await ensureBuilt(argv, dir);
const shots = resolve(flag('shots', join(root, 'test-results/e2e-lodge')));
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
const town = () => d.hw(() => window.__hw.town());
const lodge = () => d.hw(() => window.__hw.lodge());
const teleport = (p) => d.hw((t) => window.__hw.teleport(t.x, t.y, t.z), p);
const surfaceAt = (x, z) => d.hw((c) => window.__hw.surfaceY(c.x, c.z), { x, z });

try {
  await step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'lodge-e2e');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(2000);
  });

  let plot = null;
  await step('the plan puts the lodge second, after the storage bay, on a plot', async () => {
    await waitFor(page, () => window.__hw.town()?.plan?.some((b) => b.template === 'lodge'), 'the lodge is planned', { timeout: 60_000, interval: 300 });
    const t = await town();
    plot = t.plan.find((b) => b.template === 'lodge');
    assert(t.plan[0].template === 'storage_bay' && t.plan[1].template === 'lodge', `order: ${t.plan.slice(0, 3).map((b) => b.template).join(', ')}`);
    assert(plot.rot === 0, 'the lodge is planned with no turn (its door faces north)');
    const l = await lodge();
    assert(l.level === 0 && l.hasTavern === false, `the lodge is not up yet (level ${l.level})`);
    console.log(`  lodge plot at ${plot.x},${plot.z}`);
  });

  await step('the storage bay is stocked and Gruk walks the player to the plot; the bay stands first', async () => {
    const n = await d.hw(() => window.__hw.supplyLodge(4000));
    assert(n === 4000, 'the bay holds the lodge materials');
    const y = await surfaceAt(plot.x + 6, plot.z + 7);
    await teleport({ x: plot.x + 6, y: y + 2, z: plot.z - 3 });
    await d.settle(800);
  });

  // The lodge is built a stage at a time: each day skipped with setDay earns the budget for one day of cells.
  let day = 2;
  await step('days are skipped until the lodge stands (its first stage: the bedroom)', async () => {
    for (; day <= 60; day++) {
      await d.hw((n) => window.__hw.setDay(n), day);
      await d.settle(250);
      const l = await lodge();
      if (l.level >= 1) break;
    }
    const l = await lodge();
    assert(l.level >= 1, `the lodge's first stage stands (level ${l.level}, day ${day})`);
    console.log(`  the lodge stands on day ${day} (level ${l.level}, origin ${JSON.stringify(l.origin)})`);
  });

  await step('the first bedroom passes the room check in the world, and the bed and the furnace are placed', async () => {
    const l = await lodge();
    assert(Array.isArray(l.bedroom) && l.bedroom.length === 0, `room check: ${JSON.stringify(l.bedroom)}`);
    const o = l.origin;
    const bed = await d.hw((p) => window.__hw.getBlock(p.x, p.y, p.z).block, { x: o[0] + 1, y: o[1] + 1, z: o[2] + 1 });
    const hearth = await d.hw((p) => window.__hw.getBlock(p.x, p.y, p.z).block, { x: o[0] + 11, y: o[1] + 1, z: o[2] + 2 });
    assert(bed === 'wool_bedding', `the bed is in the bedroom (got ${bed})`);
    assert(hearth === 'furnace_clay', `the hearth is in the common room (got ${hearth})`);
    assert(l.hasTavern === false, 'the tavern (trader, festival, jukebox) waits for the last stage');
  });

  await step('the respawn point moves to the bedroom', async () => {
    const l = await lodge();
    const s = await d.hw(() => window.__hw.app.game.state.player.spawn);
    assert(l.spawn && Math.abs(s.x - l.spawn.x) < 0.01 && Math.abs(s.z - l.spawn.z) < 0.01, `spawn ${JSON.stringify(s)} is the bedroom ${JSON.stringify(l.spawn)}`);
  });

  await step('the player goes into the bedroom and looks at it; the lodge is shown from the front', async () => {
    const l = await lodge();
    const o = l.origin;
    await teleport({ x: l.spawn.x, y: l.spawn.y + 0.2, z: l.spawn.z });
    await d.hw((p) => window.__hw.lookAt(p.x, p.y + 1, p.z), { x: o[0] + 2, y: o[1] + 2, z: o[2] + 2 });
    await d.settle(800);
    await d.shot('1-bedroom');
    // Out front, a little back from the door, so the building and its hall windows show.
    await teleport({ x: o[0] + 6, y: o[1] + 1, z: o[2] - 4 });
    await d.hw((p) => window.__hw.lookAt(p.x, p.y + 1.5, p.z), { x: o[0] + 6, y: o[1] + 2, z: o[2] + 4 });
    await d.settle(1000);
    await d.shot('2-lodge-front');
  });

  await step('the lodge keeps going: the bar counter and the second bedroom follow when their stages are built', async () => {
    for (; day <= 90; day++) {
      await d.hw((n) => window.__hw.setDay(n), day);
      await d.settle(200);
      const l = await lodge();
      if (l.level >= 2) break;
    }
    const l = await lodge();
    assert(l.level >= 2, `the bar stage stands (level ${l.level}, day ${day})`);
    const t = await town();
    console.log(`  building now: ${t.building}, level ${l.level}`);
    await d.shot('3-lodge-bar');
  });
} finally {
  await session.close();
}
if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures || errors.length ? 1 : 0);
