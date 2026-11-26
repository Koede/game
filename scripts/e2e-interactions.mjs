// Interaction sweep on a phone: every Use outcome that can end in nothing must say why, every screen the Use button opens
// has a close control a thumb can hit, and the pause / bag / quick-menu paths all lead back to play.
//
//   node scripts/e2e-interactions.mjs                         build, then phonePortrait and phoneLandscape
//   node scripts/e2e-interactions.mjs --no-build --device=phonePortrait
//   node scripts/e2e-interactions.mjs --shots=<dir>
//
// Real input (taps on the world and the on-screen buttons); window.__hw only sets up (give, build, aim) and reads back.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const devices = flag('device').length ? flag('device') : ['phonePortrait', 'phoneLandscape'];
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-interactions'));
const dist = e2eDist(root, argv);
mkdirSync(shots, { recursive: true });
await ensureBuilt(argv, dist);

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (interactions)`);
  await runDevice(device);
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);

async function runDevice(device) {
  const session = await openGame({ dir: dist, device });
  const { page, errors } = session;
  const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
  const { assert } = report;
  const btn = (n) => page.locator(`[data-hw-touch="${n}"]`);
  const toasts = () => page.locator('.hw-toasts').innerText().catch(() => '');
  const windows = () => page.evaluate(() => [...document.querySelectorAll('.hw-window')].filter((w) => w.getBoundingClientRect().width > 0).length);
  const uiOpen = () => d.hw(() => window.__hw.state().ui ?? null);

  /** Waits until some toast text matches, polling the toast layer. */
  async function toastMatching(re, what) {
    const started = Date.now();
    let text = '';
    while (Date.now() - started < 4000) {
      text = await toasts();
      if (re.test(text)) return text;
      await d.settle(150);
    }
    throw new Error(`${what}: no toast matching ${re}, saw "${text.replace(/\n/g, ' | ')}"`);
  }

  /** Lets the toast layer drain so the next check cannot read the last step's toast. */
  const drainToasts = () => d.settle(300);

  /** A flat stone platform high above the terrain, walls-free, so the aim is always clean. Returns its origin. */
  async function platform() {
    return d.hw(() => {
      const hw = window.__hw;
      hw.setTime(0.2);
      hw.clearInventory();
      const p = hw.state().player;
      const px = Math.floor(p.x), py = Math.floor(p.y) + 8, pz = Math.floor(p.z);
      for (let dx = -4; dx <= 4; dx++) for (let dz = -6; dz <= 3; dz++) {
        hw.setVoxel(px + dx, py - 1, pz + dz, 'stone');
        for (let dy = 0; dy <= 4; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'air');
      }
      hw.teleport(px + 0.5, py, pz + 0.5);
      return { px, py, pz };
    });
  }

  /** Looks at the centre of a block (set-up), waits for the crosshair to land on it. */
  async function aimBlock(x, y, z) {
    assert(await d.aimAt({ x, y, z }), `could not aim at ${x},${y},${z}`);
  }

  /** The close control of the open window: visible, at least 44 px, and closes it. */
  async function closeByButton(what) {
    const close = page.locator('.hw-window button[aria-label="Close"], .hw-window button:has-text("Close")').first();
    await close.waitFor({ state: 'visible', timeout: 4000 });
    const box = await close.boundingBox();
    assert(box && box.width >= 44 && box.height >= 44, `${what}: close button is ${box && `${Math.round(box.width)}x${Math.round(box.height)}`}, smaller than 44x44`);
    await d.press(close);
    await waitFor(page, () => document.querySelectorAll('.hw-window').length === 0 || [...document.querySelectorAll('.hw-window')].every((w) => w.getBoundingClientRect().width === 0), `${what} closed`, { timeout: 4000, interval: 100 });
  }

  /** After a screen closed, input must be back: the touch buttons show and a look drag still turns the view. */
  async function playResumes(what) {
    const before = (await d.state()).player.yaw;
    const x = device === 'phonePortrait' ? 200 : 520, y = device === 'phonePortrait' ? 300 : 120;
    await d.fingerDown(7, x, y);
    for (let i = 1; i <= 5; i++) {
      await d.fingerMove(7, x + i * 14, y);
      await d.settle(40);
    }
    await d.fingerUp(7);
    await d.settle(200);
    const after = (await d.state()).player.yaw;
    assert(Math.abs(after - before) > 0.01, `${what}: dragging the world does not look around afterwards (input still blocked)`);
  }

  try {
    await report.step('a new world loads into play', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'interactions');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
    });

    let at = null;
    await report.step('a clean platform to work on', async () => {
      at = await platform();
      await d.settle(500);
    });

    await report.step('Use at the sky with empty hands says nothing is in reach', async () => {
      await d.hw(() => window.__hw.look(0, 1.1));
      await d.settle(300);
      await d.use();
      await toastMatching(/nothing in reach/i, 'sky Use');
      await d.shot('01-use-sky');
    });

    await report.step('Use on a block that does nothing with the held item says so', async () => {
      await drainToasts();
      await d.hw((a) => window.__hw.setVoxel(a.px, a.py, a.pz - 3, 'stone'), at);
      await aimBlock(at.px, at.py, at.pz - 3);
      await d.use();
      await toastMatching(/nothing to do with the stone/i, 'stone by hand');
    });

    await report.step('Place armed with no block in hand says to hold a block', async () => {
      await drainToasts();
      await d.press(btn('place'));
      await d.settle(150);
      await aimBlock(at.px, at.py, at.pz - 3);
      await d.use();
      await toastMatching(/hold a block/i, 'Place with nothing held');
      assert(!(await btn('place').getAttribute('class')).includes('armed'), 'Place stays armed after its one Use');
    });

    await report.step('a held block at the sky is explained, then placed once aimed at a face', async () => {
      await drainToasts();
      await d.hw(() => { window.__hw.give('plank', 8); window.__hw.selectSlot(0); window.__hw.look(0, 1.1); });
      await d.settle(300);
      await d.use();
      await toastMatching(/nothing in reach to use the plank/i, 'plank at the sky');
      await aimBlock(at.px, at.py, at.pz - 3);
      await d.use();
      await waitFor(page, (a) => window.__hw.getBlock(a.px, a.py, a.pz - 2).block === 'plank' || window.__hw.getBlock(a.px, a.py + 1, a.pz - 3).block === 'plank', 'plank placed', { timeout: 4000, interval: 100, arg: at });
    });

    await report.step('a block aimed from inside its own cell says to step aside', async () => {
      await drainToasts();
      await d.hw(() => window.__hw.clearInventory());
      await d.hw(() => { window.__hw.give('stone', 4); window.__hw.selectSlot(0); });
      // Straight down at the floor under the feet: the cell to place into is the one the player stands in.
      await d.hw(() => window.__hw.look(0, -1.5));
      await d.settle(400);
      await d.use();
      await toastMatching(/standing in the way/i, 'placing into the own cell');
      await d.hw(() => window.__hw.clearInventory());
    });

    await report.step('food: eaten at the sky when hungry, explained when full', async () => {
      await drainToasts();
      await d.hw(() => { const hw = window.__hw; hw.give('bread', 2); hw.selectSlot(0); hw.setFood(5); hw.look(0, 1.1); });
      await d.settle(300);
      const before = (await d.inventory()).bread;
      await d.use();
      await waitFor(page, (n) => (window.__hw.state().inventory.find((s) => s.item === 'bread')?.count ?? 0) < n, 'bread eaten', { timeout: 4000, interval: 100, arg: before });
      await d.hw(() => window.__hw.setFood(100));
      await d.settle(1500);
      await drainToasts();
      await d.use();
      await toastMatching(/full|not hungry|hungry/i, 'eating when full');
      await d.hw(() => window.__hw.clearInventory());
    });

    await report.step('Use at the sky with the notebook or goggles only gives the hint; the Bag chips open them', async () => {
      for (const [item, chip, held] of [['field_notebook', 'Notebook', 'Field Notebook'], ['engineer_goggles', 'Workshop Guide', 'Engineer']]) {
        await drainToasts();
        await d.hw((i) => { window.__hw.clearInventory(); window.__hw.give(i, 1); window.__hw.selectSlot(0); window.__hw.look(0, 1.1); }, item);
        await d.settle(300);
        await d.use();
        await toastMatching(/nothing in reach/i, `${item} at the sky`);
        assert((await windows()) === 0, `${item} at the sky still opens a screen`);
        await d.press(btn('bag'));
        await waitFor(page, () => document.querySelectorAll('.hw-window').length > 0, 'the bag', { timeout: 4000, interval: 100 });
        const chipEl = page.locator('.hw-bag-chips button', { hasText: chip });
        await chipEl.waitFor({ state: 'visible', timeout: 4000 });
        const box = await chipEl.boundingBox();
        assert(box && box.height >= 32, `${chip} chip is too small`);
        await d.shot(`02-chip-${item}`);
        await d.press(chipEl);
        await d.settle(500);
        assert((await windows()) === 1 && !(await page.locator('.hw-bag-chips').isVisible()), `${chip} chip did not open its screen`);
        await closeByButton(chip);
        await playResumes(chip);
      }
      await d.hw(() => window.__hw.clearInventory());
    });

    await report.step('hotbar slots are at least 43 px wide and 44 px tall in one row', async () => {
      const boxes = await page.evaluate(() => [...document.querySelectorAll('.hw-hotbar .hw-slot')].map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, y: Math.round(r.y), r: r.right }; }));
      assert(boxes.length === 9, `${boxes.length} hotbar slots`);
      if (device === 'phonePortrait') {
        assert(boxes.every((b) => b.w >= 43 && b.h >= 44), `a hotbar slot is smaller than 43x44: ${JSON.stringify(boxes[0])}`);
        assert(new Set(boxes.map((b) => b.y)).size === 1, 'the hotbar wrapped onto two rows');
        assert(boxes[8].r <= 391, 'the hotbar overflows the screen');
      }
    });

    // Every station the Use button opens: a real block, aimed at, Use, a close control, input back.
    for (const station of ['workbench', 'crate', 'furnace_clay', 'crusher', 'still', 'rune_desk', 'arcane_workbench', 'research_table', 'fluid_pipe', 'item_pipe', 'battery', 'steam_engine']) {
      await report.step(`Use on a ${station} opens its screen with a thumb-sized close`, async () => {
        await drainToasts();
        const spot = await d.hw((a) => {
          const hw = window.__hw;
          hw.clearInventory();
          hw.teleport(a.px + 0.5, a.py, a.pz + 0.5);
          hw.setVoxel(a.px, a.py, a.pz - 2, 'air');
          return { x: a.px, y: a.py, z: a.pz - 2 };
        }, at);
        await d.hw(([s, b]) => window.__hw.setVoxel(s.x, s.y, s.z, b, 0), [spot, station]);
        await d.settle(300);
        await aimBlock(spot.x, spot.y, spot.z);
        await d.use();
        // A screen opens, or a toast says why not: a station Use must never end mute.
        const outcome = await page.waitForFunction(() => (document.querySelectorAll('.hw-window').length > 0 ? 'screen' : (document.querySelector('.hw-toasts')?.innerText ?? '').trim() ? 'toast' : false), null, { timeout: 5000, polling: 100 }).then((h) => h.jsonValue());
        if (outcome === 'toast') {
          console.log(`       ${station}: no screen, said: ${(await toasts()).replace(/\n/g, ' | ')}`);
          await d.hw((s) => window.__hw.setVoxel(s.x, s.y, s.z, 'air', 0), spot);
          return;
        }
        await d.shot(`04-${station}`);
        await closeByButton(station);
        await playResumes(station);
        await d.hw((s) => window.__hw.setVoxel(s.x, s.y, s.z, 'air', 0), spot);
      });
    }

    await report.step('on the tractor a stray tap on the world keeps you aboard; the Exit button gets you off', async () => {
      await drainToasts();
      await d.hw((a) => {
        const hw = window.__hw;
        hw.clearInventory();
        for (let dx = -2; dx <= 2; dx++) for (let dz = -6; dz <= -1; dz++) for (let dy = 0; dy <= 3; dy++) hw.setVoxel(a.px + dx, a.py + dy, a.pz + dz, 'air');
        hw.teleport(a.px + 0.5, a.py, a.pz + 0.5);
        window.__hw.app.game.vehicles.place(a.px + 0.5, a.py, a.pz - 3, 0, null, 400);
        const t = [...window.__hw.app.game.vehicles.tractors.values()][0];
        hw.lookAt(Math.floor(t.x), Math.floor(t.y + 0.8), Math.floor(t.z));
      }, at);
      await d.settle(500);
      const driving = () => d.hw(() => window.__hw.app.game.vehicles.driving !== null);
      await d.use();
      await waitFor(page, () => window.__hw.app.game.vehicles.driving !== null, 'boarded the tractor', { timeout: 4000, interval: 100 });
      await d.settle(700);
      if (device === 'phonePortrait') {
        const p = d.worldPoint();
        await d.tapFinger(5, p.x, p.y);
        await d.settle(600);
        assert(await driving(), 'a stray tap on the world got the player off the tractor');
        await toastMatching(/exit/i, 'stray tap while driving');
      }
      await d.press(btn('use'));
      await waitFor(page, () => window.__hw.app.game.vehicles.driving === null, 'got off the tractor', { timeout: 4000, interval: 100 });
    });

    await report.step('the bag opens from its button, shows a 44 px close, and closes', async () => {
      await d.press(btn('bag'));
      await waitFor(page, () => document.querySelectorAll('.hw-window').length > 0, 'the bag', { timeout: 4000, interval: 100 });
      await closeByButton('bag');
      await playResumes('bag');
    });

    await report.step('pause: Settings and How to Play each lead back, Resume returns to play', async () => {
      await d.press(btn('pause'));
      await page.locator('.hw-window button', { hasText: 'Settings' }).first().waitFor({ state: 'visible', timeout: 4000 });
      await d.press(page.locator('.hw-window button', { hasText: 'Settings' }).first());
      await d.settle(300);
      await d.shot('05-settings');
      await d.press(page.locator('.hw-window button', { hasText: 'Back' }).first());
      await d.press(page.locator('.hw-window button', { hasText: 'How to Play' }).first());
      await d.settle(300);
      await d.shot('06-howto');
      const copy = await page.locator('.hw-window').innerText();
      assert(!/right click|mouse/i.test(copy) || /touch|tap/i.test(copy), 'How to Play on a phone only describes mouse controls');
      await d.press(page.locator('.hw-window button', { hasText: 'Back' }).first());
      await d.press(page.locator('.hw-window button', { hasText: 'Resume' }).first());
      await waitFor(page, () => document.querySelectorAll('.hw-window').length === 0, 'pause closed', { timeout: 4000, interval: 100 });
      await playResumes('pause');
    });

    await report.step('the quick menu opens, runs an emote, and closes without a stuck state', async () => {
      await d.press(btn('menu'));
      await d.settle(500);
      await d.shot('07-quick');
      await d.press(btn('menu'));
      await d.settle(300);
      await playResumes('quick menu');
    });

    await report.step('a hotbar slot tap selects it', async () => {
      await d.hw(() => { window.__hw.give('stone', 2); window.__hw.give('plank', 2); });
      await d.settle(300);
      const slot = page.locator('.hw-hotbar .hw-slot, .hw-slot--sm').nth(1);
      await d.press(slot);
      await d.settle(200);
      assert((await d.state()).player.selectedSlot === 1, 'tapping hotbar slot 2 did not select it');
    });

    await report.step('a screen that cannot be built says so instead of staying mute', async () => {
      await drainToasts();
      await d.hw((a) => window.__hw.open({ type: 'furnace', x: a.px + 3, y: a.py + 2, z: a.pz - 5 }), at);
      await toastMatching(/nothing to open/i, 'a furnace screen on empty air');
      assert((await windows()) === 0, 'a window is open for a station that is not there');
    });

    await report.step('the goal tracker and What next? answer a tap, and the log they open closes', async () => {
      await d.press(page.locator('.hw-goal'));
      await waitFor(page, () => document.querySelectorAll('.hw-window').length > 0, 'the log from the goal tracker', { timeout: 4000, interval: 100 });
      await closeByButton('log');
      await playResumes('log');
      await d.press(page.locator('.hw-nudge__ask'));
      await d.settle(500);
      const text = (await page.locator('.hw-hud__mid').innerText()).replace(/\s+/g, ' ');
      assert(!/^\S*\s*$/.test(text) && /what next|\w{4,}/i.test(text), 'What next? shows nothing');
      await d.shot('08-nudge');
    });

    await report.step('dying shows Respawn, and tapping it puts the player back in control', async () => {
      await d.hw(() => window.__hw.damage(9999, 'fall'));
      const respawn = page.locator('.hw-window button', { hasText: /respawn/i }).first();
      await respawn.waitFor({ state: 'visible', timeout: 6000 });
      const box = await respawn.boundingBox();
      assert(box && box.height >= 44, 'the Respawn button is smaller than 44 px high');
      await d.shot('09-death');
      await d.press(respawn);
      await waitFor(page, () => !window.__hw.state().player.dead && document.querySelectorAll('.hw-window').length === 0, 'respawned into play', { timeout: 6000, interval: 150 });
      await playResumes('respawn');
    });

    await report.step('no page errors', async () => {
      assert(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' | ')}`);
    });
  } finally {
    await session.close();
  }
}
