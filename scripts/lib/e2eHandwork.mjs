// The Ember handwork steps of scripts/e2e-handwork.mjs (EMBER_PLAN 2 and 5) - real input for everything under test: a tap
// (right click on desktop) is one stroke at a station, a held Use button repeats at the station's rate, a fired mould is
// poured at a furnace, the crosshair line and work ring are read from the page. window.__hw only sets things up (a level
// yard, the stations placed, items given, the furnace's molten metal, aiming) and reads state back.
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const STATIONS = ['chopping_block', 'hand_quern', 'stone_anvil', 'mortar', 'clay_table', 'loom', 'drying_rack', 'tanning_trough'];

const label = (d) => d.page.evaluate(() => document.querySelector('.hw-cross__name')?.textContent ?? '');
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
  await tapUntil(d, async () => (await label(d)) !== l || (await inventory(d)) !== i);
  return label(d);
}

export async function handworkSteps({ d, step, assert, page }) {
  let yard = null;
  const cell = (i) => ({ x: yard.bx - 4 + i, y: yard.y0, z: yard.bz - 3 });
  const stand = async (pos, dist = 2.4) => {
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
    assert((await tapStep(d)) === 'Chopping Block - oak log 0/3 strokes', 'the log was not loaded');
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
    let l = await label(d);
    // The first block is still loaded from the last step (one log): top it up so a held Use has work to do.
    await tapStep(d);
    await d.hw(() => { const bus = window.__hw.app.game.bus; window.__strokes = []; bus.on('hand:stroke', () => window.__strokes.push(performance.now())); });
    if (d.touch) {
      const c = await d.centerOf('[data-hw-touch="use"]');
      await d.fingerDown(5, c.x, c.y);
      await d.settle(1500);
      await d.fingerUp(5);
    } else {
      await d.page.mouse.move(d.size.width / 2, d.size.height / 2);
      await d.page.mouse.down({ button: 'right' });
      await d.settle(1500);
      await d.page.mouse.up({ button: 'right' });
    }
    const times = await d.hw(() => window.__strokes);
    const gaps = times.slice(1).map((t, i) => t - times[i]).filter((g) => g < 600);
    assert(times.length >= 3, `only ${times.length} strokes while held`);
    assert(gaps.length > 0 && Math.min(...gaps) > 150 && Math.min(...gaps) < 450, `stroke gaps ${gaps.map(Math.round)} ms: want about 250`);
    l = await label(d);
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
}
