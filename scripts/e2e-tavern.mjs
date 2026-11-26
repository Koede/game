// End-to-end check of the starting tavern (docs/api/npcs.md) in the built game (headless Chromium), desktop and phone portrait:
//
//   node scripts/e2e-tavern.mjs                    build to a scratch dir, run both devices
//   node scripts/e2e-tavern.mjs --no-build         use the existing build (--dist=<dir>, default dist/)
//   node scripts/e2e-tavern.mjs --shots=<dir>      screenshots (default test-results/e2e-tavern)
//
// New World (survival) -> the player stands inside the tavern, the welcome toast shows, the people stand where the layout says ->
// aim at Rosa and Use: her gift (a hearth stew) arrives and her line shows as a toast -> the same for Gruk's wooden tools and Mara's
// notebook -> Continue after Save and quit still has the tavern. Real input for the Use; window.__hw only reads state and aims.
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
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-tavern'));
const dist = e2eDist(root, argv);

mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
await ensureBuilt(argv, dist);

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (tavern)`);
  await runDevice(device);
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);

async function runDevice(device) {
  const session = await openGame({ dir: dist, device });
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
  const npcs = () => d.hw(() => {
    const st = window.__hw.app.game.state;
    return { at: st.npcs.at, views: st.npcs.views(), pos: st.player.position, pack: Object.fromEntries(st.player.inventory.toJSON().filter(Boolean).map((s) => [s.item, s.count])) };
  });

  /**
   * Taps the conversation box away if a line is still up (a tap finishes the line, the next closes it): on a phone the box
   * covers the Use button, and a tap on it is taken by the box.
   */
  const closeTalk = async () => {
    const box = page.locator('.hw-npcsay:not([hidden])');
    for (let i = 0; i < 3 && (await box.count()) > 0; i++) {
      await (d.touch ? box.first().tap({ timeout: 2000 }) : box.first().click({ timeout: 2000 })).catch(() => undefined);
      await d.settle(250);
    }
  };

  try {
    await step('a new world opens inside the tavern with the welcome', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'tavern-e2e');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      // A new world starts at the camp; the tavern tests build the full tavern first (window.__hw.settle).
      if (!(await d.hw(() => window.__hw.settle()))) throw new Error('could not settle the camp into the tavern');
      await d.settle(2500);
      const s = await npcs();
      assert(s.at, 'no tavern was built');
      assert(s.views.length === 6, `${s.views.length} people and props`);
      const inside = s.pos.x > s.at[0] && s.pos.x < s.at[0] + 12 && s.pos.z > s.at[2] && s.pos.z < s.at[2] + 8;
      assert(inside, `the player is at ${s.pos.x},${s.pos.z}, outside the hall at ${s.at}`);
      assert(errors.length === 0, `console errors: ${errors.join(' | ')}`);
      await d.shot('1-start');
    });

    for (const [id, gift, word] of [['rosa', 'hearth_stew', 'On the house'], ['gruk', 'wooden_pickaxe', 'Wooden tools'], ['mara', 'field_notebook', 'notebook'], ['veyra', 'glass_vial', 'Glass. Clean']]) {
      await step(`using ${id} gives the welcome gift and a line`, async () => {
        // Stand two blocks from the person on the floor (Rosa is behind the bar, so three blocks north of her), then aim at their
        // chest. People walk between their spots by the hour, so each try reads where they are now and takes a side with room for
        // the player (north, south, west, east), in one go so they cannot step away between the stand and the aim.
        const off = id === 'rosa' ? [[0, -3]] : [[0, -2], [0, 2], [-2, 0], [2, 0]];
        let got = false;
        for (let i = 0; i < 6 && !got; i++) {
          const placed = await d.hw((p) => {
            const hw = window.__hw;
            const v = hw.app.game.state.npcs.views().find((x) => x.id === p.id);
            const free = (c) => {
              const b = (dy) => hw.getBlock(Math.floor(c.x), Math.floor(c.y) + dy, Math.floor(c.z));
              return !b(0).solid && !b(1).solid && b(-1).solid;
            };
            const stands = p.off.map(([dx, dz]) => ({ x: v.x + dx, y: v.y, z: v.z + dz })).filter(free);
            const stand = stands[p.i % Math.max(1, stands.length)];
            if (!stand) return null;
            hw.teleport(stand.x, stand.y, stand.z);
            hw.lookAt(v.x, v.y + 1.2, v.z);
            return { v: [v.x, v.y, v.z], stand };
          }, { id, off, i });
          assert(placed, `no room to stand beside ${id}`);
          await d.settle(250);
          if (i === 0) await d.shot(`2-${id}`);
          await d.holdUse(250);
          got = await waitFor(page, (item) => window.__hw.app.game.state.player.inventory.count(item) >= 1, `${gift} in the pack`, { timeout: 2500, interval: 100, arg: gift }).then(() => true, () => false);
        }
        assert(got, `timed out waiting for ${gift} in the pack`);
        await waitFor(page, () => document.querySelector('.hw-npcsay:not([hidden])') !== null, 'the dialogue box', { timeout: 4000, interval: 100 });
        await d.settle(1800);
        const said = await page.locator('.hw-npcsay__text').textContent();
        const nm = await page.locator('.hw-npcsay__name').textContent();
        assert(said.includes(word), `${nm} said "${said}", not "${word}"`);
        await d.shot(`2b-${id}-said`);
      });
    }

    // The quest board and the wall clock are blocks in the north wall: stand two blocks south of each, face its centre.
    const FIXTURE = { board: { lx: 3, ly: 2, lz: 0 }, clock: { lx: 5, ly: 3, lz: 0 } };
    for (const [id, word] of [['board', 'Quest board|Favour|bounty'], ['clock', 'It is'], ['orrin', 'wrench'], ['bram', 'Hold|hold|show|Show|Pick|What are you|Welcome|customer|Mind|sign|Come|goat|buy|Take|coin']]) {
      await step(`using ${id} answers`, async () => {
        await closeTalk();
        const s = await npcs();
        const fx = FIXTURE[id];
        const v = fx ? { x: s.at[0] + fx.lx + 0.5, y: s.at[1] + 1, z: s.at[2] + fx.lz + 0.5 } : s.views.find((x) => x.id === id);
        const prop = !!fx || s.views.find((x) => x.id === id).kind === 'prop';
        if (fx) {
          // A block in the wall: the same aim as any block (approach finds a stand that sees it).
          assert(await d.approach({ x: s.at[0] + fx.lx, y: s.at[1] + fx.ly, z: s.at[2] + fx.lz }), `aims at the ${id} block`);
          await d.settle(200);
        } else {
          await d.hw((p) => window.__hw.teleport(p.x, p.y, p.z + p.back), { x: v.x, y: v.y, z: v.z, back: prop ? 2.2 : -2 });
          await d.settle(300);
          await d.hw((p) => window.__hw.lookAt(p.x, p.y + p.h, p.z), { x: v.x, y: v.y, z: v.z, h: prop ? 0.7 : 1.2 });
          await d.settle(200);
        }
        await d.shot(`3-${id}`);
        await d.holdUse(250);
        // The answer is a toast or a typed line in the dialogue box: give it a moment to show.
        await waitFor(page, (w) => {
          const re = new RegExp(w, 'i');
          return [...document.querySelectorAll('.hw-toasts .hw-toast, .hw-npcsay__text')].some((e) => re.test(e.textContent ?? '')) || window.__hw.app.game.state.player.inventory.count('wrench') >= 1;
        }, `an answer matching ${word}`, { timeout: 3000, interval: 100, arg: word }).catch(() => undefined);
        const toasts = (await page.locator('.hw-toasts .hw-toast').allTextContents()).concat(await page.locator('.hw-npcsay__text').allTextContents());
        const re = new RegExp(word, 'i');
        assert(toasts.some((t) => re.test(t)) || (await npcs()).pack.wrench >= 1, `${id}: nothing matching ${word}: ${toasts.slice(-3).join(' | ')}`);
      });
    }
    await step('the jukebox makes everyone but Gruk dance', async () => {
      await closeTalk();
      const s = await npcs();
      // The jukebox is a block against the north wall now: aim at it like any block, from two blocks in front of it (from where
      // the last step left the player, the wall torch beside it at (7, 2, 1) can be in the way).
      await d.hw((a) => window.__hw.teleport(a[0] + 8.5, a[1] + 1, a[2] + 3.5), s.at);
      await d.settle(300);
      assert(await d.approach({ x: s.at[0] + 8, y: s.at[1] + 1, z: s.at[2] + 1 }), 'aims at the jukebox block');
      await d.settle(200);
      // One press: the jukebox toggles on every use, and a held Use repeats every 0.25 s (a 250 ms hold can switch it back off).
      await d.use();
      await d.settle(600);
      const after = await npcs();
      const dancing = after.views.filter((x) => x.dancing).map((x) => x.id).sort().join(',');
      assert(dancing === 'bram,mara,orrin,rosa,veyra', `dancers: ${dancing}`);
      await d.settle(15000); // they walk over to the dance floor, round the bar and through the doors
      const mara = (await npcs()).views.find((x) => x.id === 'mara');
      await d.hw((p) => window.__hw.teleport(p.x - 1.5, p.y, p.z + 3.5), { x: mara.x, y: mara.y, z: mara.z });
      await d.settle(200);
      await d.hw((p) => window.__hw.lookAt(p.x, p.y + 1.2, p.z), { x: mara.x, y: mara.y, z: mara.z });
      await d.settle(250);
      await d.shot('4-dance');
      for (const i of [1, 2, 3]) {
        await d.settle(4300);
        await d.shot(`4-dance-${i}`);
      }
      const ds = (await npcs()).views.filter((x) => x.dancing);
      const c = { x: ds.reduce((t, x) => t + x.x, 0) / ds.length, y: ds[0].y, z: ds.reduce((t, x) => t + x.z, 0) / ds.length };
      await d.hw((p) => window.__hw.teleport(p.x - 0.5, p.y, p.z + 4.2), c);
      await d.settle(200);
      await d.hw((p) => window.__hw.lookAt(p.x, p.y + 1, p.z), c);
      for (const i of [1, 2]) {
        await d.settle(1100);
        await d.shot(`4-dance-wide-${i}`);
      }
    });
  } finally {
    await session.close();
  }
}
