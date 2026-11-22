// Browser check of the glass distillery (docs/api/distillery.md; headless Chromium, real input):
//
//   node scripts/e2e-distill.mjs --out=<dir-with-a-build>   (build first: node scripts/build.mjs --out=<dir>)
//   node scripts/e2e-distill.mjs --device=desktop|phonePortrait --shots=<dir>
//
// Builds a pot still and a three-cut column on furnaces (set-up through window.__hw), then plays them with real input:
// pours pine sap and crude oil in from the hand, sets the still bases by tapping them, watches the flasks boil (bubbles,
// drips, the column's colour bands) and their blocks turn to the green "done" look, takes the syrup and the gasoline
// out with an empty beaker and canister, and refuels a chainsaw with the gasoline. Screenshots of each stage.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const devices = argv.includes('--no-build') || !flag('device', null) ? ['desktop', 'phonePortrait'] : [flag('device', 'desktop')];
const dir = resolve(flag('out', join(root, 'dist')));
const shots = resolve(flag('shots', join(root, 'test-results/e2e-distill')));
mkdirSync(shots, { recursive: true });

const report = createReporter();
let failed = 0;

for (const device of devices) {
  console.log(`\n== ${device} ==`);
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
  /** The module at a cell, read from the simulation (state, litres, named contents) plus the block it shows. */
  const mod = (c) => d.hw((p) => {
    const sim = window.__hw.app.game.state.sim;
    const e = sim.distill.entityAt(p.x, p.y, p.z);
    const b = window.__hw.getBlock(p.x, p.y, p.z);
    if (!e) return { block: b.block, active: b.active, state: null, litres: 0 };
    const litres = Object.values(e.mix).reduce((n, v) => n + v, 0);
    return { block: b.block, active: b.active, state: e.state, litres: Math.round(litres), setC: e.setC ?? null, band: e.band ?? 0 };
  }, c);
  /** Runs the game fast with the furnaces fed until `done` (evaluated in the page) holds. */
  const fastForward = async (done, arg, what, maxRounds = 200) => {
    for (let i = 0; i < maxRounds; i++) {
      if (await d.hw(done, arg)) return true;
      await d.hw(() => {
        const s = window.__hw.app.game.state.sim;
        for (const f of window.__distillFurnaces) {
          const e = s.furnaceAt(f.x, f.y, f.z);
          if (e && !(e.fuel[0]?.count > 4)) e.fuel[0] = { item: 'charcoal', count: 32 };
        }
        window.__hw.tick(60);
      });
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  const tapTimes = async (pos, n) => {
    for (let i = 0; i < n; i++) {
      assert(await d.approach(pos), `aims at ${JSON.stringify(pos)}`);
      await d.use();
      await d.settle(350);
    }
  };
  let P = null;
  /** Stands back from the rigs by day and looks at the column (for the screenshots). */
  const view = async (name) => {
    await d.hw((p) => {
      const hw = window.__hw;
      hw.setTime(0.3);
      hw.setWeather('clear');
      hw.teleport(p.x - 1.5, p.gy, p.z0 + 7.5);
      hw.lookAt(p.x - 1, p.gy + 3, p.z0);
    }, { x: P.col.flask.x, gy: P.gy, z0: P.z0 });
    await d.settle(900);
    await d.shot(name);
  };

  try {
    await step('a new world loads into play', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'hearth-distill');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
    });

    await step('a pot still and a three-cut column stand on lit furnaces', async () => {
      P = await d.hw(() => {
        const hw = window.__hw;
        hw.clearInventory();
        const p = hw.state().player;
        const gy = Math.floor(p.y);
        const x0 = Math.floor(p.x) + 2;
        const z0 = Math.floor(p.z) - 3;
        // A clear stone yard (set-up).
        for (let x = x0 - 2; x <= x0 + 9; x++) {
          for (let z = z0 - 2; z <= z0 + 6; z++) {
            hw.setVoxel(x, gy - 1, z, 'stone');
            for (let y = gy; y <= gy + 9; y++) hw.setVoxel(x, y, z, 'air');
          }
        }
        const put = (x, y, z, b) => hw.setVoxel(x, y, z, b);
        // Pot still: furnace, base, flask, condenser on top, receiver beside it.
        put(x0, gy, z0, 'furnace_clay');
        put(x0, gy + 1, z0, 'still_base');
        put(x0, gy + 2, z0, 'boiling_flask');
        put(x0, gy + 3, z0, 'condenser_coil');
        put(x0 + 1, gy + 3, z0, 'receiver');
        // Column: three segments, side cuts at segments 1 and 2, the head on top.
        const cx = x0 + 5;
        put(cx, gy, z0, 'furnace_clay');
        put(cx, gy + 1, z0, 'still_base');
        put(cx, gy + 2, z0, 'boiling_flask');
        for (let h = 0; h < 3; h++) put(cx, gy + 3 + h, z0, 'column_segment');
        put(cx + 1, gy + 3, z0, 'condenser_coil');
        put(cx + 2, gy + 3, z0, 'receiver');
        put(cx - 1, gy + 4, z0, 'condenser_coil');
        put(cx - 2, gy + 4, z0, 'receiver');
        put(cx, gy + 6, z0, 'condenser_coil');
        put(cx + 1, gy + 6, z0, 'receiver');
        put(cx + 1, gy + 6, z0 + 1, 'cooling_jacket');
        const sim = hw.app.game.state.sim;
        window.__distillFurnaces = [{ x: x0, y: gy, z: z0 }, { x: cx, y: gy, z: z0 }];
        for (const f of window.__distillFurnaces) {
          const e = sim.furnaceAt(f.x, f.y, f.z);
          e.fuel[0] = { item: 'charcoal', count: 32 };
          sim.light(f.x, f.y, f.z);
        }
        hw.setVoxel(cx + 1, gy + 4, z0 - 2, 'stone'); // a step to reach the column head from
        hw.teleport(x0 + 3.5, gy, z0 + 5.5);
        hw.lookAt(x0 + 3, gy + 3, z0);
        return {
          gy, z0,
          pot: { base: { x: x0, y: gy + 1, z: z0 }, flask: { x: x0, y: gy + 2, z: z0 }, recv: { x: x0 + 1, y: gy + 3, z: z0 } },
          col: {
            base: { x: cx, y: gy + 1, z: z0 }, flask: { x: cx, y: gy + 2, z: z0 }, seg: { x: cx, y: gy + 4, z: z0 },
            low: { x: cx + 2, y: gy + 3, z: z0 }, mid: { x: cx - 2, y: gy + 4, z: z0 }, head: { x: cx + 1, y: gy + 6, z: z0 },
            jacket: { x: cx + 1, y: gy + 6, z: z0 + 1 },
          },
        };
      });
      await d.settle(800);
      const f = await mod(P.pot.flask);
      assert(f.block === 'boiling_flask' && f.state === 'idle', `pot flask ${JSON.stringify(f)}`);
      await view('1-rigs-built');
    });

    await step('pine sap pours in from the hand, and a tap sets the still base to 130 C', async () => {
      await d.hw(() => window.__hw.give('pine_sap', 4));
      await d.selectItem('pine_sap');
      await tapTimes(P.pot.flask, 4);
      const f = await mod(P.pot.flask);
      assert(f.litres === 1000, `the flask holds ${f.litres} L`);
      await d.selectEmptyHand();
      await tapTimes(P.pot.base, 1);
      const b = await mod(P.pot.base);
      assert(b.setC === 130, `base set to ${b.setC}`);
    });

    await step('crude oil pours into the column flask and its base is set to 350 C', async () => {
      await d.hw(() => window.__hw.give('crude_canister', 4));
      await d.selectItem('crude_canister');
      await tapTimes(P.col.flask, 4);
      assert((await mod(P.col.flask)).litres === 4000, 'the column flask holds 4000 L');
      await d.hw(() => window.__hw.give('water_pail', 1));
      await d.selectItem('water_pail');
      await tapTimes(P.col.jacket, 1);
      await d.selectEmptyHand();
      // Setpoints gained 150 and 330 (src/core/distill.ts), so 350 is six taps from the 97 C default, not four.
      await tapTimes(P.col.base, 6);
      assert((await mod(P.col.base)).setC === 350, 'column base at 350 C');
    });

    await step('the flasks boil: lit lamps, bubbles, drips and colour bands up the column', async () => {
      await fastForward((c) => window.__hw.app.game.state.sim.distill.entityAt(c.x, c.y, c.z)?.state === 'working', P.col.flask, 'the column to boil');
      await fastForward((c) => (window.__hw.app.game.state.sim.distill.entityAt(c.x, c.y, c.z)?.band ?? 0) !== 0, P.col.seg, 'a band in the column', 40);
      const f = await mod(P.col.flask);
      assert(f.block === 'boiling_flask' && f.active, `boiling flask looks lit: ${JSON.stringify(f)}`);
      await view('2-column-boiling');
      const counts = await d.hw(() => window.__hw.app.game.renderer.distillFx?.counts ?? null);
      if (counts) assert(counts.motion > 0, `bubbles and drips drawn: ${JSON.stringify(counts)}`);
    });

    await step('each run completes on its own and the flask turns to the green done look', async () => {
      await fastForward((c) => window.__hw.app.game.state.sim.distill.entityAt(c.x, c.y, c.z)?.state === 'done', P.pot.flask, 'the syrup run');
      await fastForward((c) => window.__hw.app.game.state.sim.distill.entityAt(c.x, c.y, c.z)?.state === 'done', P.col.flask, 'the crude run', 400);
      await d.hw(() => window.__hw.tick(200));
      const pot = await mod(P.pot.flask);
      const col = await mod(P.col.flask);
      assert(pot.block === 'boiling_flask_done' && !pot.active, `pot flask ${JSON.stringify(pot)}`);
      assert(col.block === 'boiling_flask_done' && !col.active, `column flask ${JSON.stringify(col)}`);
      const head = await mod(P.col.head);
      assert(head.block === 'receiver_done' && head.litres > 500, `gasoline receiver ${JSON.stringify(head)}`);
      await view('3-runs-done');
    });

    await step('the column runs again on two more canisters of crude, adding to its cuts', async () => {
      await d.hw(() => window.__hw.give('crude_canister', 2));
      await d.selectItem('crude_canister');
      await tapTimes(P.col.flask, 2);
      await fastForward((c) => window.__hw.app.game.state.sim.distill.entityAt(c.x, c.y, c.z)?.state === 'working', P.col.flask, 'the second run');
      await fastForward((c) => window.__hw.app.game.state.sim.distill.entityAt(c.x, c.y, c.z)?.state === 'done', P.col.flask, 'the second run to end', 400);
      await d.hw(() => window.__hw.tick(200));
      const head = await mod(P.col.head);
      assert(head.litres >= 1000, `gasoline receiver holds ${head.litres} L`);
    });

    await step('an empty beaker takes the syrup and an empty canister the gasoline', async () => {
      await d.hw(() => {
        window.__hw.give('glass_beaker', 1);
        window.__hw.give('empty_canister', 1);
      });
      await d.selectItem('glass_beaker');
      await tapTimes(P.pot.flask, 1);
      const inv = await d.inventory();
      assert((inv.syrup_beaker ?? 0) === 1, `syrup beakers: ${inv.syrup_beaker ?? 0}`);
      await d.selectItem('empty_canister');
      await d.hw((c) => window.__hw.teleport(c.x + 0.5, c.y - 1, c.z - 1.5), P.col.head);
      await d.settle(300);
      await tapTimes(P.col.head, 1);
      assert(((await d.inventory()).gasoline_canister ?? 0) === 1, 'a gasoline canister');
    });

    await step('the gasoline refuels a chainsaw and the canister comes back empty', async () => {
      const before = await d.hw(() => {
        const inv = window.__hw.app.game.state.player.inventory;
        const at = inv.slots.findIndex((s, i) => i >= 9 && !s);
        inv.set(at, { item: 'chainsaw', count: 1, durability: 2 });
        return 2;
      });
      await d.selectItem('gasoline_canister');
      await d.hw(() => window.__hw.look(0, -1.4));
      await d.settle(300);
      await d.use();
      await d.settle(500);
      const st = await d.state();
      const saw = st.inventory.find((s) => s.item === 'chainsaw');
      assert(saw && saw.durability > before + 400, `chainsaw fuel ${saw?.durability}`);
      assert(st.inventory.some((s) => s.item === 'empty_canister'), 'the empty canister came back');
    });

    await step('no console errors during the run', async () => {
      assert(errors.length === 0, `console errors: ${errors.slice(0, 5).join(' | ')}`);
    });
  } finally {
    await session.close();
  }
  failed += report.failures;
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
