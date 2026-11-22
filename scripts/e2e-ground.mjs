// Browser check of ground items and the Hand Vacuum Pump (headless Chromium, real input):
//
//   node scripts/e2e-ground.mjs --out=<dir-with-a-build>   (build first: node scripts/build.mjs --out=<dir>)
//   node scripts/e2e-ground.mjs --device=desktop|phonePortrait --shots=<dir>
//
// Breaks a block with real input, shows the drops resting and spinning, walks onto them, drops with Q (desktop) or the
// hotbar long-press / Drop button (phone), and pulls scattered items with the pump. window.__hw only sets up and reads.
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
const shots = resolve(flag('shots', join(root, 'test-results/e2e-ground')));
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
const ground = () => d.hw(() => window.__hw.groundItems());
const count = async (item) => (await d.inventory())[item] ?? 0;
try {
  await step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'hearth-ground');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  await step('a broken block leaves items resting on the ground, spinning', async () => {
    await d.hw(() => {
      const hw = window.__hw;
      hw.give('flint_pickaxe', 1);
      const p = hw.state().player;
      // A stone block to dig out in front of the player: set-up, the digging itself is real input.
      hw.setVoxel(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z) - 2, 'dirt');
    });
    const target = await d.hw(() => {
      const hw = window.__hw;
      const p = hw.state().player;
      const y = Math.floor(p.y);
      const x = Math.floor(p.x);
      const z = Math.floor(p.z) - 2;
      return { x, y, z, block: hw.getBlock(x, y, z).block };
    });
    if (target.block === 'air') throw new Error('no block to dig');
    await d.selectItem('flint_pickaxe');
    const aimed = await d.aimAt(target);
    assert(aimed, 'aims at the block');
    let n = 0;
    assert(await d.holdMine(async () => {
      n++;
      await d.hw((t) => window.__hw.lookAt(t.x, t.y, t.z), target); // the mouse hold nudges the view: keep the crosshair on it
      return d.hw((t) => window.__hw.getBlock(t.x, t.y, t.z).block === 'air', target);
    }, 8000), 'block broken');
    await d.settle(900);
    const items = await ground();
    assert(items.length > 0, 'the drop lies in the world as an entity');
    await d.hw(() => window.__hw.lookAt(...Object.values(window.__hw.groundItems()[0]).slice(2, 5)));
    await d.shot('1-items-resting-a');
    await d.settle(500);
    await d.shot('1-items-resting-b');
  });

  await step('walking up to them picks them up', async () => {
    const before = await d.inventory();
    const left = await d.collectDrops(8000);
    if (left) console.log('   still lying:', JSON.stringify(await ground()), JSON.stringify((await d.state()).player));
    assert(left === 0, `${left} items still on the ground`);
    const after = await d.inventory();
    assert(JSON.stringify(before) !== JSON.stringify(after), 'the pack changed');
    await d.shot('2-picked-up');
  });

  await step(device === 'desktop' ? 'Q drops the held item, Shift+Q the stack' : 'long-press on the hotbar drops the stack', async () => {
    await d.hw(() => window.__hw.give('coal', 5));
    await d.selectItem('coal');
    const before = await count('coal');
    if (device === 'desktop') {
      await page.keyboard.press('KeyQ');
      await d.settle(600);
      assert((await count('coal')) === before - 1, 'Q drops one');
      await d.shot('3-dropped-one');
      await page.keyboard.press('Shift+KeyQ');
      await d.settle(600);
      assert((await count('coal')) === 0, 'Shift+Q drops the rest');
    } else {
      const slot = (await d.state()).inventory.find((s) => s.item === 'coal').slot;
      const box = await page.locator('.hw-hotbar .hw-slot').nth(slot).boundingBox();
      await d.fingerDown(5, box.x + box.width / 2, box.y + box.height / 2);
      await d.settle(900);
      await d.fingerUp(5);
      await d.settle(600);
      assert((await count('coal')) === 0, 'long-press drops the stack');
    }
    const lying = (await ground()).filter((g) => g.item === 'coal').reduce((n, g) => n + g.count, 0);
    assert(lying === before, `all ${before} coal lie in the world (${lying})`);
    await d.shot('3-dropped');
    await d.settle(1500);
    assert((await count('coal')) === 0, 'not instantly re-collected');
  });

  await step(device === 'desktop' ? 'Q over an inventory slot drops it' : 'picking a stack and pressing Drop drops it', async () => {
    await d.hw(() => window.__hw.give('stick', 7));
    await d.openInventory();
    const slot = (await d.state()).inventory.find((s) => s.item === 'stick').slot;
    const view = page.locator(slot < 9 ? '.hw-bag__hotbar .hw-slot' : '.hw-bag .hw-slot:not(.hw-slot--sm)').nth(slot < 9 ? slot : slot - 9);
    if (device === 'desktop') {
      await view.hover();
      await page.keyboard.press('KeyQ');
    } else {
      await d.press(view);
      await d.press(page.locator('.hw-carry button', { hasText: 'Drop all' }));
    }
    await d.settle(500);
    await d.shot('4-inventory-drop');
    const left = await count('stick');
    assert(left < 7, `sticks left the pack (${left})`);
    await d.closeScreen();
  });

  await step('the Hand Vacuum Pump pulls scattered items from far away', async () => {
    // Scatter coal around the player at 5-8 blocks (set-up), then hold the pump and press Use.
    await d.hw(() => {
      const hw = window.__hw;
      hw.give('hand_vacuum', 1);
      const g = hw.app.game.state.player;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = 5 + (i % 3) * 1.5;
        const x = g.position.x + Math.cos(a) * r;
        const z = g.position.z + Math.sin(a) * r;
        g.ground.spawn('coal', 1, x, g.position.y + 1.5, z, { scatter: false, delayS: 0 });
      }
    });
    await d.settle(1800);
    const lying = (await ground()).filter((g) => g.item === 'coal').length;
    assert(lying >= 10, `items lie around (${lying})`);
    await d.selectItem('hand_vacuum');
    await d.shot('5-vacuum-before');
    const before = await count('coal');
    await d.use();
    await d.settle(450);
    await d.shot('5-vacuum-pulling');
    await d.settle(1800);
    await d.shot('5-vacuum-after');
    const got = (await count('coal')) - before;
    assert(got >= 8, `the pump pulled ${got} coal in`);
    const wear = (await d.state()).inventory.find((s) => s.item === 'hand_vacuum')?.durability;
    assert(wear !== undefined && wear < 480, `the pump wore (${wear})`);
  });

  await step('no console errors during the run', async () => {
    assert(errors.length === 0, `console errors: ${errors.slice(0, 5).join(' | ')}`);
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
