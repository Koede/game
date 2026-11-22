// The Ember handwork steps of scripts/e2e-handwork.mjs (EMBER_PLAN 2 and 5) - real input for everything under test: a tap
// (right click on desktop) is one stroke at a station, a held Use button repeats at the station's rate, a fired mould is
// poured at a furnace, the crosshair line and work ring are read from the page. window.__hw only sets things up (a level
// yard, the stations placed, items given, the furnace's molten metal, aiming) and reads state back.
import { hlog } from './diag.mjs';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const STATIONS = ['chopping_block', 'hand_quern', 'stone_anvil', 'mortar', 'clay_table', 'loom', 'drying_rack', 'tanning_trough'];

// The crosshair line is refreshed on the next frame after a tap or a look, so wait (up to 1.5 s) for it to hold text instead of reading it at once.
const label = async (d) => {
  for (let i = 0; i < 30; i++) {
    const t = await d.page.evaluate(() => document.querySelector('.hw-cross__label')?.textContent ?? '');
    if (t) return t;
    await new Promise((r) => setTimeout(r, 50));
  }
  return '';
};
const inventory = async (d) => JSON.stringify(await d.inventory());

/** Taps Use (the first taps can be eaten by a coach mark) until `changed()` is true; returns how many taps it took. */
async function tapUntil(d, changed, tries = 5) {
  for (let n = 1; n <= tries; n++) {
    await d.use();
    for (let w = 0; w < 8; w++) {
      await d.settle(100);
      if (await changed()) return n;
    }
  }
  throw new Error('the tap changed nothing');
}

/** Taps until the crosshair line or the pack changes. */
async function tapStep(d) {
  const l = await label(d);
  const i = await inventory(d);
  const st0 = await d.state();
  hlog('hand.tap', { label: l, target: st0.target, held: st0.player.selectedSlot, inv: st0.inventory, ground: await d.hw(() => window.__hw.groundItems()).catch(() => null) });
  await tapUntil(d, async () => (await label(d)) !== l || (await inventory(d)) !== i);
  return label(d);
}

export async function handworkSteps({ d, step, assert, page }) {
  let yard = null;
  const cell = (i) => ({ x: yard.bx - 4 + i, y: yard.y0, z: yard.bz - 3 });
  const stand = async (pos, dist = 2.4) => {
    await d.centerMouse();
    await d.hw((a) => { const hw = window.__hw; hw.teleport(a.x, a.y, a.z); hw.lookAt(a.tx, a.ty, a.tz); }, { x: pos.x + 0.5, y: pos.y, z: pos.z + dist, tx: pos.x + 0.5, ty: pos.y + 0.45, tz: pos.z + 0.5 });
    await d.settle(500);
    assert(await d.aimAt(pos), `cannot aim at ${JSON.stringify(pos)}`);
  };

  await step('a yard of hand stations is set up and the crosshair names them', async () => {
    yard = await d.hw(() => {
      const hw = window.__hw;
      hw.setTime(0.35);
      const p = hw.state().player;
      const bx = Math.floor(p.x);
      const bz = Math.floor(p.z);
      const gy = hw.surfaceY(bx, bz);
      // Level, cleared ground with as few edits as possible (every edit re-meshes a chunk).
      for (let dx = -5; dx <= 7; dx++) {
        for (let dz = -5; dz <= 8; dz++) {
          const x = bx + dx;
          const z = bz + dz;
          const here = hw.surfaceY(x, z);
          for (let y = here; y > gy; y--) hw.setVoxel(x, y, z, 'air');
          for (let y = here + 1; y <= gy; y++) hw.setVoxel(x, y, z, 'dirt');
          for (let y = gy + 1; y < gy + 4; y++) if (hw.getBlock(x, y, z).block !== 'air') hw.setVoxel(x, y, z, 'air');
        }
      }
      return { bx, bz, y0: gy + 1 };
    });
    for (let i = 0; i < STATIONS.length; i++) {
      const c = cell(i);
      await d.hw((a) => window.__hw.setVoxel(a.x, a.y, a.z, a.key, 2), { ...c, key: STATIONS[i] });
    }
    await d.settle(800);
    await stand(cell(1));
    assert((await label(d)) === 'Hand Quern - empty', `the quern line is "${await label(d)}"`);
    await d.shot('hand-01-quern');
    await stand(cell(6));
    assert((await label(d)) === 'Drying Rack - empty', `the rack line is "${await label(d)}"`);
    await d.shot('hand-01-rack');
  });

  await step('taps chop a log at the block: load, three strokes with a counting line, take four planks', async () => {
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('oak_log', 2); window.__hw.setFood(20); });
    await stand(cell(0));
    const first = await tapStep(d);
    hlog('hand.after_first_tap', { player: (await d.state()).player, logs: await d.hw((a) => { const o = []; for (let x = a.x - 3; x <= a.x + 4; x++) for (let y = a.y; y <= a.y + 2; y++) for (let z = a.z - 1; z <= a.z + 1; z++) { const b = window.__hw.getBlock(x, y, z).block; if (b === 'oak_log' || b === 'chopping_block') o.push([x, y, z, b]); } return o; }, cell(0)) });
    assert(first === 'Chopping Block - oak log 0/3 strokes', `the log was not loaded: line "${first}", target ${JSON.stringify((await d.state()).target)}`);
    assert((await tapStep(d)).endsWith('1/3 strokes'), 'the first stroke did not count');
    await d.shot('hand-02-chop');
    assert((await tapStep(d)).endsWith('2/3 strokes'), 'the second stroke did not count');
    assert((await tapStep(d)) === 'Chopping Block - planks ready', 'the third stroke did not finish');
    await tapStep(d);
    const inv = await d.inventory();
    assert(inv.plank === 4, `planks: ${JSON.stringify(inv)}`);
  });

  await step('holding Use repeats strokes at the station rate (4 a second at the chopping block)', async () => {
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('oak_log', 3); });
    await stand(cell(0));
    // The first block is still loaded from the last step (one log): top it up so a held Use has work to do.
    await tapStep(d);
    // Stroke times are read in game ticks (20 a second): a slow software-rendered frame must not look like a slow stroke rate.
    await d.hw(() => { const g = window.__hw.app.game; window.__strokes = []; g.bus.on('hand:stroke', () => window.__strokes.push(g.state.ticks)); });
    const hold = async (ms) => {
      if (d.touch) {
        const c = await d.centerOf('[data-hw-touch="use"]');
        await d.fingerDown(5, c.x, c.y);
        await d.settle(ms);
        await d.fingerUp(5);
      } else {
        await d.page.mouse.move(d.size.width / 2, d.size.height / 2);
        await d.page.mouse.down({ button: 'right' });
        await d.settle(ms);
        await d.page.mouse.up({ button: 'right' });
      }
    };
    for (let tries = 0; tries < 3 && (await d.hw(() => window.__strokes.length)) < 3; tries++) await hold(2500);
    const ticks = await d.hw(() => window.__strokes);
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]).filter((g) => g < 12);
    assert(ticks.length >= 3, `only ${ticks.length} strokes while held`);
    // 0.25 s between repeats is 5 ticks; a stroke that lands on a take (no stroke event) leaves a longer gap, filtered out.
    assert(gaps.length > 0 && Math.min(...gaps) >= 4 && Math.min(...gaps) <= 8, `stroke gaps ${gaps} ticks: want about 5`);
    const l = await label(d);
    assert(l.startsWith('Chopping Block'), l);
  });

  await step('a quern turns wheat into flour: six strokes, take with an empty hand', async () => {
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('wheat', 6); });
    await stand(cell(1));
    assert((await tapStep(d)) === 'Hand Quern - wheat 0/6 strokes', 'the wheat was not loaded');
    for (let i = 1; i <= 5; i++) {
      assert((await tapStep(d)) === `Hand Quern - wheat ${i}/6 strokes`, `stroke ${i} did not count`);
      if (i === 3) await d.shot('hand-03-quern-mid');
    }
    assert((await tapStep(d)) === 'Hand Quern - flour ready', 'the sixth stroke did not finish');
    await tapStep(d);
    const inv = await d.inventory();
    assert(inv.flour === 1, `flour: ${JSON.stringify(inv)}`);
  });

  await step('the anvil takes two ingots to a plate with a hammer; its line says the work', async () => {
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('copper_ingot', 2); window.__hw.give('flint_hammer', 1); window.__hw.selectSlot(0); });
    await stand(cell(2));
    // Two Uses with the ingots load one each (two recipes share the ingot), then the hammer strikes double.
    assert((await tapStep(d)).startsWith('Stone Anvil - copper ingot'), 'the first ingot was not loaded');
    await tapStep(d);
    await d.selectItem('flint_hammer');
    let l = await label(d);
    for (let i = 0; i < 8 && !l.endsWith('ready'); i++) {
      l = await tapStep(d);
      if (i === 1) await d.shot('hand-04-anvil');
    }
    assert(l === 'Stone Anvil - copper plate ready', `the anvil line is "${l}"`);
    await d.hw(() => window.__hw.selectSlot(8));
    await tapStep(d);
    const inv = await d.inventory();
    assert(inv.copper_plate === 1, `plate: ${JSON.stringify(inv)}`);
  });

  await step('a fired mould held at a furnace with molten bronze pours a cast head without the screen', async () => {
    const c = { x: yard.bx + 5, y: yard.y0, z: yard.bz - 3 };
    await d.hw((a) => window.__hw.setVoxel(a.x, a.y, a.z, 'furnace_clay', 2), c);
    await d.settle(400);
    const setup = await d.hw((a) => {
      const e = window.__hw.app.game.state.sim.furnaceAt(a.x, a.y, a.z);
      if (!e) return false;
      e.crucibleMelt[0] = { item: 'bronze_ingot', count: 3 };
      e.crucibleMoltenS[0] = 20;
      return true;
    }, c);
    assert(setup, 'no furnace entity');
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('pickaxe_mould', 1); window.__hw.selectSlot(0); });
    await stand(c);
    await tapUntil(d, async () => (await d.inventory()).bronze_pickaxe_head === 1);
    const state = await d.state();
    assert(!state.ui.uiOpen, 'the furnace screen opened instead of pouring');
    await d.shot('hand-05-pour');
    await sleep(100);
  });

  /** Selects an empty hotbar slot (a finished output is taken into the selected slot, so the hand is not empty after a take). */
  const bareHand = async () => {
    const st = await d.state();
    if (st.inventory.some((i) => i.slot === st.player.selectedSlot)) await d.selectEmptyHand();
  };
  /** Takes whatever waits at the station with an empty hand. */
  const takeOut = async () => {
    await bareHand();
    return tapStep(d);
  };
  const ticks = async (n, keep) => {
    for (let done = 0; done < n; done += 100) {
      if (keep) await d.hw(keep);
      await d.hw((k) => window.__hw.tick(k), Math.min(100, n - done));
    }
  };

  await step('the mortar crushes copper ore in eight strokes; the clay table turns four clay into an unfired pot', async () => {
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('copper_ore', 1); });
    await stand(cell(3));
    assert((await tapStep(d)) === 'Mortar - copper ore 0/8 strokes', `the mortar line is "${await label(d)}"`);
    await bareHand();
    for (let i = 1; i <= 7; i++) assert((await tapStep(d)).endsWith(`${i}/8 strokes`), `mortar stroke ${i}`);
    await d.shot('hand-06-mortar');
    assert((await tapStep(d)).endsWith('ready'), 'the mortar did not finish');
    await takeOut();
    let inv = await d.inventory();
    assert((inv.crushed_copper ?? 0) >= 1, `crushed copper: ${JSON.stringify(inv)}`);
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('clay', 4); });
    await stand(cell(4));
    // Every Use loads one clay (the amount loaded picks the piece: 4 clay is the alloy pot).
    for (let i = 0; i < 4; i++) await tapStep(d);
    assert((await label(d)).startsWith('Clay Table - clay'), `the clay was not loaded: "${await label(d)}"`);
    await bareHand();
    for (let i = 0; i < 6 && !(await label(d)).endsWith('ready'); i++) {
      await tapStep(d);
      if (i === 1) await d.shot('hand-07-clay');
    }
    assert((await label(d)) === 'Clay Table - unfired alloy pot ready', `the clay table line is "${await label(d)}"`);
    await takeOut();
    inv = await d.inventory();
    assert(inv.unfired_alloy_pot === 1, `pot: ${JSON.stringify(inv)}`);
  });

  await step('the loom weaves four fibre into cloth in ten strokes (held Use)', async () => {
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('fiber', 4); });
    await stand(cell(5));
    assert((await tapStep(d)).startsWith('Loom - fiber'), 'the fibre was not loaded');
    await bareHand();
    await d.shot('hand-08-loom');
    // A held Use strokes ten times, and with the cloth ready its next repeat takes it into the (empty) hand: stop on either.
    for (let tries = 0; tries < 12 && !(await label(d)).endsWith("ready") && !(await d.inventory()).cloth; tries++) {
      await d.holdUse(800);
      await d.settle(200);
    }
    await d.shot('hand-08-loom-done');
    if (!(await d.inventory()).cloth) await takeOut();
    assert((await d.inventory()).cloth === 1, `no cloth: ${JSON.stringify(await d.inventory())}, line "${await label(d)}"`);
  });

  await step('the trough soaks hides and the rack dries them to leather: timed work, the line counts seconds', async () => {
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('hide', 2); window.__hw.setWeather('clear'); window.__hw.setTime(0.35); });
    await stand(cell(7));
    let l = await tapStep(d);
    assert(l.startsWith('Tanning Trough - hide'), `the trough line is "${l}"`);
    await ticks(400);
    l = await label(d);
    assert(/\d+\/60 s/.test(l) && !l.includes(' 0/60'), `the trough does not count seconds: "${l}"`);
    await d.shot('hand-09-trough');
    await ticks(1000);
    assert((await label(d)).endsWith('ready'), `the trough line is "${await label(d)}"`);
    await takeOut();
    assert((await d.inventory()).soaked_hide === 2, `soaked: ${JSON.stringify(await d.inventory())}`);
    await d.selectItem('soaked_hide');
    await stand(cell(6));
    l = await tapStep(d);
    assert(l.startsWith('Drying Rack - soaked hide'), `the rack line is "${l}"`);
    await ticks(600);
    await d.hw(() => window.__hw.setTime(0.35));
    l = await label(d);
    assert(/\d+\/120 s/.test(l) && !l.includes(' 0/120'), `the rack does not count seconds: "${l}"`);
    await d.shot('hand-10-rack');
    await ticks(2000, () => window.__hw.setTime(0.35));
    assert((await label(d)).endsWith('ready'), `the rack line is "${await label(d)}"`);
    await takeOut();
    assert((await d.inventory()).leather === 2, `leather: ${JSON.stringify(await d.inventory())}`);
  });

  await step('a pour opens the anvil hot window: its line says (hot) and strokes count double', async () => {
    const furnace = { x: yard.bx + 5, y: yard.y0, z: yard.bz - 3 };
    const anvil = { x: yard.bx + 4, y: yard.y0, z: yard.bz - 1 };
    await d.hw((a) => window.__hw.setVoxel(a.x, a.y, a.z, 'stone_anvil', 2), anvil);
    await d.settle(400);
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('bronze_ingot', 2); window.__hw.give('pickaxe_mould', 1); });
    await stand(anvil);
    await tapStep(d);
    await tapStep(d);
    await d.hw((a) => {
      const e = window.__hw.app.game.state.sim.furnaceAt(a.x, a.y, a.z);
      e.crucibleMelt[0] = { item: 'bronze_ingot', count: 3 };
      e.crucibleMoltenS[0] = 20;
    }, furnace);
    await d.selectItem('pickaxe_mould');
    await stand(furnace);
    await tapUntil(d, async () => (await d.inventory()).bronze_pickaxe_head >= 1);
    await stand(anvil);
    await bareHand();
    const hot = await label(d);
    assert(hot.endsWith('(hot)'), `the anvil line is "${hot}", no hot window after the pour`);
    await d.shot('hand-11-anvil-hot');
    let taps = 0;
    while (!(await label(d)).includes('ready') && taps < 8) { await tapStep(d); taps++; }
    assert(taps <= 5, `a hot plate took ${taps} strokes (8 cold, 4 hot)`);
    assert((await label(d)).includes('bronze plate ready'), `the anvil line is "${await label(d)}"`);
    await takeOut();
  });

  await step('an alloy pot in a hot crucible takes copper and tin by hand and a mould casts the bronze, all at the furnace', async () => {
    const f = { x: yard.bx + 5, y: yard.y0, z: yard.bz - 3 };
    await d.hw((a) => {
      const e = window.__hw.app.game.state.sim.furnaceAt(a.x, a.y, a.z);
      e.crucibleIn[0] = { item: 'alloy_pot', count: 1 };
      e.crucibleOut[0] = null;
      e.crucibleMelt[0] = null;
      e.crucibleMoltenS[0] = 0;
    }, f);
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('copper_ingot', 3); window.__hw.give('tin_ingot', 1); window.__hw.give('ingot_mould', 1); });
    await stand(f);
    await d.selectItem('copper_ingot');
    await tapUntil(d, async () => (await d.inventory()).copper_ingot === undefined);
    await d.selectItem('tin_ingot');
    await tapUntil(d, async () => (await d.inventory()).tin_ingot === undefined);
    await d.shot('hand-12-pot');
    const keep = (a) => {
      const e = window.__hw.app.game.state.sim.furnaceAt(a.x, a.y, a.z);
      e.tempC = Math.max(e.tempC, 900);
      e.lit = true;
    };
    for (let i = 0; i < 12; i++) {
      await d.hw(keep, f);
      await d.hw(() => window.__hw.tick(40));
      const m = await d.hw((a) => window.__hw.app.game.state.sim.furnaceAt(a.x, a.y, a.z).crucibleMelt[0], f);
      if (m) break;
    }
    const melt = await d.hw((a) => window.__hw.app.game.state.sim.furnaceAt(a.x, a.y, a.z).crucibleMelt[0], f);
    assert(melt?.item === 'bronze_ingot' && melt.count === 4, `the pot made ${JSON.stringify(melt)}`);
    await d.selectItem('ingot_mould');
    await tapUntil(d, async () => (await d.inventory()).bronze_ingot >= 1);
    await d.shot('hand-13-pot-poured');
  });
}
