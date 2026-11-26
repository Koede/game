// End-to-end check of the play-assist features (docs/api/assist.md): recipe helper, quick-craft chip, item magnet, undo and
// copy-paste, "what next". Real clicks and keys; window.__hw only sets the pack up and reads it.
//   node scripts/e2e-assist.mjs [--no-build] [--dist=<dir>] [--device=desktop] [--shots=<dir>]
// Hold the machine lock while a browser runs: node scripts/with-lock.mjs assist -- node scripts/e2e-assist.mjs --dist=<tmp dir>
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const devices = flag('device').length ? flag('device') : ['desktop', 'phonePortrait'];
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-assist'));
const dist = e2eDist(root, argv);

mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
await ensureBuilt(argv, dist);

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (assist)`);
  const session = await openGame({ dir: dist, device });
  const { page } = session;
  const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
  const { assert } = report;
  // A mouse player has the pointer locked, so the HUD chips are keys there (Z undo, C mark, V paste, N what next, X repeat);
  // a phone taps them.
  const act = async (locator, key) => {
    if (d.touch) await d.press(locator);
    else await page.keyboard.press(key);
    await d.settle(300);
  };
  const count = (item) => d.hw((i) => window.__hw.app.game.state.player.inventory.count(i), item);
  try {
    await report.step('a new world opens', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'assist-e2e');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
    });

    await report.step('the recipe helper pins Cord and marks what is missing', async () => {
      await d.hw(() => {
        const inv = window.__hw.app.game.state.player.inventory;
        inv.clear();
        inv.add('fiber', 1);
      });
      await d.openInventory();
      await page.selectOption('.hw-helper__select', 'cord');
      await d.settle(300);
      const chips = await page.locator('.hw-helper__pinned .hw-ingr').count();
      const short = await page.locator('.hw-helper__pinned .hw-ingr[data-short]').count();
      assert(chips === 1 && short === 1, `chips ${chips}, short ${short}`);
      const ready = await page.locator('.hw-helper__ready').textContent();
      assert(/Can make now: Hand \d+/.test(ready ?? ''), `ready line "${ready}"`);
      await d.hw(() => window.__hw.app.game.state.player.inventory.add('fiber', 8));
      await d.settle(400);
      assert((await page.locator('.hw-helper__pinned .hw-ingr[data-short]').count()) === 0, 'nothing short once the fiber is there');
      await d.shot('1-helper');
    });

    await report.step('Make by hand, then the HUD chip repeats it without a screen', async () => {
      await d.press(page.locator('.hw-recipe[data-id="cord"] .hw-btn', { hasText: 'Make' }).first());
      await d.settle(300);
      await d.closeScreen();
      await d.settle(400);
      assert((await count('cord')) === 1, 'cord made once');
      const chip = page.locator('[data-testid="quick-craft"] .hw-quick__main');
      await chip.waitFor({ state: 'visible', timeout: 5000 });
      await act(chip, 'KeyX');
      assert((await count('cord')) === 2, `cord after the chip ${await count('cord')}`);
      await d.shot('2-quick');
    });

    await report.step('the item magnet pulls a drop from several blocks away', async () => {
      const spot = await d.hw(() => {
        const p = window.__hw.app.game.state.player;
        return { x: p.position.x + 4, y: p.position.y, z: p.position.z };
      });
      await d.hw((s) => {
        const p = window.__hw.app.game.state.player;
        p.assist.magnet = 'off';
        p.ground.spawn('coal', 1, s.x, s.y + 0.3, s.z, { scatter: false, delayS: 0 });
      }, spot);
      await d.settle(1500);
      assert((await count('coal')) === 0, 'off: not taken from 4 blocks');
      await d.hw(() => (window.__hw.app.game.state.player.assist.magnet = 'large'));
      await d.settle(2500);
      assert((await count('coal')) === 1, 'large: taken');
    });

    await report.step('Undo takes a placed block back and returns it', async () => {
      const at = await d.hw(() => {
        const g = window.__hw;
        const p = g.app.game.state.player;
        g.clearInventory();
        p.give('stone', 6);
        p.selectSlot(0);
        const x = Math.floor(p.position.x) + 1;
        const z = Math.floor(p.position.z);
        const y = g.surfaceY(x, z);
        return { x, y, z };
      });
      assert(await d.approach(at), 'aim at the ground');
      const before = await count('stone');
      await d.use();
      await d.settle(500);
      assert((await count('stone')) === before - 1, 'a stone was placed');
      const undo = page.locator('.hw-build [data-action="undo"]');
      await undo.waitFor({ state: 'visible', timeout: 5000 });
      await act(undo, 'KeyZ');
      assert((await count('stone')) === before, 'the stone came back');
      await d.shot('3-undo');
    });

    await report.step('copy and paste a small build at the aim', async () => {
      const base = await d.hw(() => {
        const g = window.__hw;
        const p = g.app.game.state.player;
        g.clearInventory();
        p.give('stone', 20);
        p.selectSlot(0);
        const x = Math.floor(p.position.x) + 3;
        const z = Math.floor(p.position.z) + 3;
        const y = g.surfaceY(x, z) + 1;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.setVoxel(x + i, y, z + j, 'stone');
        return { x, y, z };
      });
      const press = async (action, cell) => {
        assert(await d.approach(cell), `aim at ${JSON.stringify(cell)}`);
        if (d.touch && !(await page.locator(`.hw-build [data-action="${action}"]`).isVisible())) await d.press(page.locator('.hw-build .hw-quick__more'));
        await act(page.locator(`.hw-build [data-action="${action}"]`), { mark: 'KeyC', paste: 'KeyV' }[action]);
      };
      await press('mark', base);
      await press('mark', { x: base.x + 1, y: base.y, z: base.z + 1 });
      const dest = { x: base.x - 6, z: base.z };
      const ground = await d.hw((t) => window.__hw.surfaceY(t.x, t.z), dest);
      // Set-up: a flat 2 x 2 pad for the paste (the ground beside the aimed cell can be a block higher on a slope).
      await d.hw((t) => {
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
          window.__hw.setVoxel(t.x + i, t.y, t.z + j, i === 0 && j === 0 ? 'stone' : 'grass');
          for (let dy = 1; dy <= 3; dy++) window.__hw.setVoxel(t.x + i, t.y + dy, t.z + j, 'air');
        }
      }, { ...dest, y: ground });
      await press('paste', { x: dest.x, y: ground, z: dest.z });
      const placed = await d.hw((t) => {
        let n = 0;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (window.__hw.getBlock(t.x + i, t.y + 1, t.z + j).block === 'stone') n++;
        return n;
      }, { ...dest, y: ground });
      assert(placed === 4, `pasted blocks ${placed}`);
      assert((await count('stone')) === 16, `paid 4 stones, have ${await count('stone')}`);
      await d.shot('4-paste');
    });

    await report.step('What next gives a hint and an arrow', async () => {
      await act(page.locator('.hw-nudge__ask'), 'KeyN');
      await d.settle(400);
      const text = (await page.locator('.hw-nudge__text').textContent()) ?? '';
      assert(text.length > 3, `hint "${text}"`);
      await d.shot('5-nudge');
    });
  } finally {
    await session.close();
  }
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
