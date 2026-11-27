// Phone controls: the thumb cluster never overlaps itself or the HUD that talks over it, and the Use button says what it will do.
//
//   node scripts/e2e-phone-controls.mjs                         build, then phonePortrait and phoneLandscape
//   node scripts/e2e-phone-controls.mjs --no-build --device=phonePortrait
//   node scripts/e2e-phone-controls.mjs --shots=<dir>
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
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-phone-controls'));
const dist = e2eDist(root, argv);
mkdirSync(shots, { recursive: true });
await ensureBuilt(argv, dist);

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (phone controls)`);
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
  const useLabel = () => btn('use').locator('.hw-touch-label').innerText();

  /** Viewport rects of the touch controls (drawn discs, plus the stick), keyed by name; only the ones showing. */
  const controls = () =>
    page.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll('.hw-touch-btn, .hw-touch-stick')) {
        const r = el.getBoundingClientRect();
        if (el.hidden || r.width === 0) continue;
        out[el.dataset.hwTouch ?? 'stick'] = { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
      }
      return out;
    });
  const rectOf = (sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el || el.hidden) return null;
      const r = el.getBoundingClientRect();
      return r.width === 0 ? null : { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    }, sel);
  const overlap = (a, b, gap = 0) => a.l < b.r + gap && b.l < a.r + gap && a.t < b.b + gap && b.t < a.b + gap;

  /** Fails when `rect` covers any thumb control. */
  async function clearOfControls(what, rect) {
    const c = await controls();
    for (const [name, r] of Object.entries(c)) assert(!overlap(rect, r), `${what} covers the ${name} control`);
  }

  /** A flat stone platform high above the terrain so aims are clean. */
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

  async function labelIs(want, what) {
    await waitFor(page, (w) => document.querySelector('[data-hw-touch="use"] .hw-touch-label')?.textContent === w, `${what}: Use caption ${want}`, { timeout: 4000, interval: 100, arg: want }).catch(() => {});
    const got = await useLabel();
    assert(got.toLowerCase() === want.toLowerCase(), `${what}: the Use caption is "${got}", wanted "${want}"`);
  }

  try {
    await report.step('a new world loads into play', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'phone controls');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
    });

    let at = null;
    await report.step('the thumb cluster: every control is 44 px or more and none overlaps another', async () => {
      at = await platform();
      await d.settle(500);
      const c = await controls();
      for (const n of ['jump', 'mine', 'use', 'place', 'bag', 'pause', 'menu', 'stick']) assert(c[n], `the ${n} control is not on screen`);
      for (const [n, r] of Object.entries(c)) assert(r.w >= 44 && r.h >= 44, `the ${n} control is ${Math.round(r.w)}x${Math.round(r.h)}, under 44x44`);
      const names = Object.keys(c);
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) assert(!overlap(c[names[i]], c[names[j]], 2), `${names[i]} overlaps ${names[j]}`);
      await d.shot('01-cluster');
    });

    await report.step('the Use caption names the outcome: sky, workbench, food, block, Place armed', async () => {
      await d.hw(() => window.__hw.look(0, 1.1));
      await labelIs('Use', 'sky, empty hands');
      await d.hw((a) => window.__hw.setVoxel(a.px, a.py, a.pz - 3, 'workbench'), at);
      await d.hw((a) => window.__hw.lookAt(a.px, a.py, a.pz - 3), at);
      await labelIs('Open', 'a workbench');
      await d.shot('02-use-open');
      await d.hw(() => { window.__hw.give('bread', 2); window.__hw.selectSlot(0); window.__hw.look(0, 1.1); });
      await labelIs('Eat', 'bread held at the sky');
      await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('plank', 8); window.__hw.selectSlot(0); });
      await d.hw((a) => { window.__hw.setVoxel(a.px, a.py, a.pz - 2, 'stone'); window.__hw.lookAt(a.px, a.py, a.pz - 2); }, at);
      await labelIs('Place', 'a block held, aimed at stone');
      await d.hw(() => { window.__hw.clearInventory(); window.__hw.look(0, 1.1); });
      await labelIs('Use', 'hands emptied again');
    });

    await report.step('the first-minutes coach mark and a toast stay clear of the thumb controls', async () => {
      await d.hw(() => localStorage.setItem('hearthwatt.coach', JSON.stringify(['look'])));
      await page.reload();
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await d.press(page.locator('.hw-title button', { hasText: /continue|new world/i }).first());
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play again', { timeout: 120_000 });
      await d.settle(1500);
      await waitFor(page, () => { const c = document.querySelector('.hw-coach'); return c && !c.hidden && c.dataset.mark === 'mine'; }, 'the mine coach mark', { timeout: 8000, interval: 150 });
      const coach = await rectOf('.hw-coach');
      assert(coach, 'the coach mark has no box');
      await clearOfControls('the coach mark', coach);
      await d.shot('03-coach');
      await d.hw(() => window.__hw.app.game.state.bus.emit('toast', { text: 'A long toast line: the camp is out of firewood and Gruk looks cold', kind: 'info' }));
      await d.settle(400);
      const toasts = await rectOf('.hw-toasts');
      if (toasts) await clearOfControls('the toast layer', toasts);
    });

    await report.step('the conversation box sits clear of the thumb controls and still closes on a tap', async () => {
      await d.hw(() => window.__hw.app.game.state.bus.emit('npc:say', { role: 'gruk', name: 'Gruk', title: 'camp', id: 'gruk', work: true, text: 'Ugh. Fire low. Need wood. Bring wood, many wood, then Gruk not cold. You help?' }));
      await waitFor(page, () => !document.querySelector('.hw-npcsay')?.hidden, 'the dialogue box', { timeout: 5000, interval: 100 });
      await d.settle(1800);
      const box = await rectOf('.hw-npcsay');
      assert(box, 'the dialogue box has no rect');
      await clearOfControls('the conversation box', box);
      const { width, height } = d.size;
      assert(box.l >= 0 && box.r <= width && box.t >= 0 && box.b <= height, 'the conversation box is not fully on screen');
      await d.shot('04-dialogue');
      // A tap finishes the line, another closes the box (it may also have timed out meanwhile: that is a close too).
      for (let i = 0; i < 3 && (await rectOf('.hw-npcsay')); i++) {
        await page.locator('.hw-npcsay').tap({ timeout: 2000 }).catch(() => {});
        await d.settle(250);
      }
      assert(!(await rectOf('.hw-npcsay')), 'the conversation box is still open after tapping it');
    });

    await report.step('the quick-menu ring: every item is a 56 px target, on screen, none overlapping', async () => {
      await d.press(btn('menu'));
      await waitFor(page, () => document.querySelectorAll('.hw-touch-radial__item').length > 0, 'ring items', { timeout: 3000, interval: 100 });
      await d.settle(300);
      const items = await page.evaluate(() => [...document.querySelectorAll('.hw-touch-radial__item')].map((el) => { const r = el.getBoundingClientRect(); return { n: el.textContent, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }));
      await d.shot('05-ring');
      const { width, height } = d.size;
      for (const it of items) {
        assert(it.w >= 56 && it.h >= 56, `ring item ${it.n} is ${Math.round(it.w)}x${Math.round(it.h)}`);
        assert(it.l >= 0 && it.r <= width && it.t >= 0 && it.b <= height, `ring item ${it.n} runs off the screen`);
      }
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) assert(Math.hypot((items[i].l + items[i].r - items[j].l - items[j].r) / 2, (items[i].t + items[i].b - items[j].t - items[j].b) / 2) >= 60, `ring items ${items[i].n} and ${items[j].n} overlap`);
      await d.press(btn('menu'));
    });

    await report.step('no page errors', async () => assert(errors.length === 0, `page errors: ${errors.join(' | ')}`));
  } finally {
    await session.close();
  }
}
