// Browser check of newcomers and the Town page (docs/plans/just-you-and-orrin.md, phases 5 to 7), headless Chromium with real input:
//
//   node scripts/build.mjs --out=<dir>                                       (build first)
//   node scripts/e2e-newcomers.mjs --out=<dir-with-a-build> [--shots=<dir>] [--device=desktop|phonePortrait]
//
// A new world starts at the camp; the bay is stocked and days are skipped until the lodge stands. Then nights are skipped one day at a
// time until the first newcomer (Rosa) moves into the bedroom: she is in the settlement, the toast and the diary say so, the HUD's town
// chip shows the camp goal, a tap on it opens the Town page (building, standing, residents, rooms, who is next), and the pause menu has
// a Town entry. window.__hw only sets up and reads.
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
const shots = resolve(flag('shots', join(root, 'test-results/e2e-newcomers')));
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
const settlement = () => d.hw(() => window.__hw.settlement());
const teleport = (p) => d.hw((t) => window.__hw.teleport(t.x, t.y, t.z), p);
const surfaceAt = (x, z) => d.hw((c) => window.__hw.surfaceY(c.x, c.z), { x, z });

try {
  await step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'newcomers-e2e');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(2000);
  });

  let plot = null;
  await step('the camp goal shows in the HUD before anyone has come', async () => {
    await waitFor(page, () => window.__hw.town()?.plan?.some((b) => b.template === 'lodge'), 'the lodge is planned', { timeout: 60_000, interval: 300 });
    plot = (await town()).plan.find((b) => b.template === 'lodge');
    const chip = page.locator('[data-testid="town-chip"]');
    await chip.waitFor({ state: 'visible', timeout: 10_000 });
    const text = (await chip.textContent()) ?? '';
    assert(/camp goal/i.test(text), `chip: ${text}`);
    await d.shot('0-camp-chip');
  });

  let day = 2;
  await step('the lodge is built (bay stocked, days skipped)', async () => {
    await d.hw(() => window.__hw.supplyLodge(4000));
    const y = await surfaceAt(plot.x + 6, plot.z + 7);
    await teleport({ x: plot.x + 6, y: y + 2, z: plot.z - 3 });
    await d.settle(800);
    for (; day <= 60; day++) {
      await d.hw((n) => window.__hw.setDay(n), day);
      await d.settle(250);
      if ((await lodge()).level >= 1) break;
    }
    assert((await lodge()).level >= 1, `the lodge stands (day ${day})`);
  });

  await step('nights pass and the first newcomer, Rosa, moves into the bedroom', async () => {
    const before = await settlement();
    assert(before.present.join() === 'gruk', `only Gruk lives here (${before.present.join()})`);
    assert(before.line[0]?.id === 'rosa' && before.line[0].eligible, 'Rosa is first in line and eligible');
    for (let n = 0; n < 45; n++) {
      day++;
      await d.hw((x) => window.__hw.setDay(x), day);
      await d.settle(200);
      if ((await settlement()).present.includes('rosa')) break;
    }
    const s = await settlement();
    assert(s.present.includes('rosa'), `Rosa moved in (day ${day})`);
    assert(/^lodge_/.test(s.occupancy.rosa ?? ''), `her room: ${JSON.stringify(s.occupancy)}`);
    assert(!s.present.includes('orrin'), 'nobody else came the same night');
    console.log(`  Rosa moved in by day ${day}`);
  });

  await step('the HUD chip moves on, and a tap opens the Town page with the building, standing, residents and rooms', async () => {
    await d.settle(500);
    await d.shot('1-hud');
    const chip = page.locator('[data-testid="town-chip"]');
    // On desktop the mouse is captured by pointer lock (letting go opens the pause menu), so the HUD chip is clicked through the DOM there.
    if ((await d.state()).ui?.pointerLocked) await chip.evaluate((el) => el.click());
    else await d.press(chip);
    await d.waitScreen('town');
    const text = (await page.locator('.hw-window').first().innerText()).replace(/\s+/g, ' ');
    for (const want of ['Gruk is building', 'Standing', 'Who lives here', 'Rosa', 'Lodge bedroom', 'Rooms', 'Camp goals']) assert(text.toLowerCase().includes(want.toLowerCase()), `the page says "${want}": ${text.slice(0, 300)}`);
    await d.shot('2-town-page');
    const box = await page.locator('.hw-window').first().boundingBox();
    const vp = page.viewportSize();
    assert(box && box.x >= -1 && box.x + box.width <= vp.width + 1, `the page fits the width (${JSON.stringify(box)} in ${vp.width})`);
    await d.closeScreen();
  });

  await step('the pause menu has a Town entry that opens the page', async () => {
    await d.pause();
    const btn = page.locator('.hw-menu button', { hasText: /^Town$/ });
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await d.shot('3-pause-menu');
    await d.press(btn);
    await d.waitScreen('town');
    await d.closeScreen();
  });

  await step('Rosa is in the common room, and the lodge is shown with her in it', async () => {
    const l = await lodge();
    const o = l.origin;
    await teleport({ x: o[0] + 6, y: o[1] + 1, z: o[2] + 6 });
    await d.hw((p) => window.__hw.lookAt(p.x, p.y + 1.5, p.z), { x: o[0] + 5, y: o[1] + 1.5, z: o[2] + 2 });
    await d.settle(1500);
    await d.shot('4-common-room');
  });
} finally {
  await session.close();
}
if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures || errors.length ? 1 : 0);
