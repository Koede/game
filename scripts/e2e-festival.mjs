// The seasonal festivals (docs/api/npcs.md "Seasonal festivals"): on the Harvest Fair night the town gathers in the hall, holding a
// full basket of wheat and using Rosa enters the harvest basket, the Town page names the festival and the Hearth Log pays its keepsake.
//   node scripts/e2e-festival.mjs [--no-build] [--dist=<dir>] [--device=phonePortrait] [--shots=<dir>]
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const devices = flag('device').length ? flag('device') : ['phonePortrait'];
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-festival'));
const dist = e2eDist(root, argv);
mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
await ensureBuilt(argv, dist);
const report = createReporter();
const assert = (ok, msg) => {
  if (!ok) throw new Error(msg);
};
for (const device of devices) {
  console.log(`\n${device} (festivals)`);
  const session = await openGame({ dir: dist, device });
  const { page } = session;
  const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
  const npcs = () => d.hw(() => {
    const n = window.__hw.app.game.state.npcs;
    return { at: n.at, now: n.festivalNow(), rec: n.festivalRecord(), views: n.views().map((v) => ({ id: v.id, x: v.x, y: v.y, z: v.z, dancing: v.dancing })) };
  });
  try {
    await report.step('a settled world on the Harvest Fair night: the town gathers in the hall', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'festival-e2e');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      if (!(await d.hw(() => window.__hw.settle()))) throw new Error('could not settle the camp into the tavern');
      await d.hw(() => {
        window.__hw.setDay(18); // the last day of autumn
        window.__hw.setTime(0.68);
      });
      await waitFor(page, () => window.__hw.app.game.state.npcs.festivalNow(), 'the festival night', { timeout: 10_000, interval: 100 });
      const toast = await waitFor(page, () => document.querySelector('.hw-toasts')?.textContent ?? '', 'a toast', { timeout: 5000, interval: 100 }).catch(() => '');
      // Let everyone walk in, then stand by the door and look over the dance floor.
      await d.settle(9000);
      const s = await npcs();
      const gruk = s.views.find((v) => v.id === 'gruk');
      assert(gruk && Math.abs(gruk.x - (s.at[0] + 5.5)) < 0.6 && Math.abs(gruk.z - (s.at[2] + 4.5)) < 0.6, `Gruk watches by the floor: ${JSON.stringify(gruk)}`);
      assert(s.views.filter((v) => v.dancing).length >= 2, 'people dance');
      console.log(`  toast: ${String(toast).slice(0, 120)}`);
    });

    await report.step('holding a basket of wheat and using Rosa enters the harvest basket', async () => {
      await d.hw(() => window.__hw.give('wheat', 64));
      await d.selectItem('wheat');
      let entered = false;
      for (let attempt = 0; attempt < 6 && !entered; attempt++) {
        const s = await npcs();
        const v = s.views.find((x) => x.id === 'rosa');
        await d.hw((p) => window.__hw.teleport(p.x, p.y, p.z - 3), v);
        await d.settle(300);
        await d.hw((p) => window.__hw.lookAt(p.x - 0.5, p.y + 1.6 - 0.5, p.z - 0.5), v);
        await d.settle(150);
        const cover = (await d.state()).target;
        if (cover && cover.block === 'torch') {
          await d.hw((c) => window.__hw.setVoxel(c.x, c.y, c.z, 'air'), cover);
          await d.hw((p) => window.__hw.lookAt(p.x - 0.5, p.y + 1.6 - 0.5, p.z - 0.5), v);
          await d.settle(150);
        }
        await d.holdUse(100);
        await d.settle(900);
        entered = (await npcs()).rec.entries >= 1;
      }
      assert(entered, 'the basket was never entered');
      await d.settle(600);
      await d.shot('2-basket-judged');
      const left = await d.hw(() => window.__hw.app.game.state.player.inventory.count('wheat'));
      assert(left === 64, `the basket is only shown, ${left} wheat left`);
    });

    await report.step('the Town page names tonight\'s festival', async () => {
      await d.hw(() => window.__hw.open({ type: 'town' }));
      await d.waitScreen('town');
      const text = (await page.locator('.hw-window').first().innerText()).replace(/\s+/g, ' ');
      assert(/Festival: Harvest Fair/i.test(text) && /Medals so far/.test(text), `town page: ${text.slice(0, 400)}`);
      // The Town page redraws as it ticks, so Playwright's actionability wait can lose the node: scroll it with one in-page call.
      await page.locator('.hw-town__sec', { hasText: 'Festival' }).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await d.settle(300);
      await d.shot('3-town-page');
      await d.closeScreen();
    });

    await report.step('the Hearth Log pays the Harvest Fair keepsake', async () => {
      await waitFor(page, () => window.__hw.app.game.state.dailyGoals.keepsakes.includes('k_corn_dolly'), 'the Corn Dolly', { timeout: 6000, interval: 200 });
      await d.hw(() => window.__hw.open({ type: 'log' }));
      await d.waitScreen('log');
      const text = (await page.locator('.hw-window').first().innerText()).replace(/\s+/g, ' ');
      assert(/Harvest Fair/.test(text), `log: ${text.slice(0, 400)}`);
      await page.getByText('Enter a contest at the Harvest Fair').first().scrollIntoViewIfNeeded().catch(() => undefined);
      await d.settle(300);
      await d.shot('4-hearth-log');
      await d.closeScreen();
    });
  } finally {
    await session.close();
  }
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
