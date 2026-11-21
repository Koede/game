// The Ember handwork steps of scripts/e2e-handwork.mjs (docs/api/handwork.md): every hand station driven with real Use
// input - the hand quern, stone anvil (with the hot-work window after a pour), mortar, loom, clay table, the tanning
// trough and drying rack (timed: insert and take only), and the furnace pour with a fired mould and the alloy pot.
// Desktop: right click and right hold; phone portrait: a tap on the world is Use. window.__hw only SETS UP (a cleared
// level stage, items, the clock and weather, the molten metal, fast-forwarding the timed stations) and reads state.
// Every step writes diag records (`hw.*`) so a failure says which station, taps and label it stopped at.
import { waitFor } from './browser.mjs';
import { hlog } from './diag.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
/** Half the width of the cleared stage (blocks) around the player. */
const STAGE_R = 5;

/** The station's view as the sim reports it (null when the cell is not a tracked station). */
const view = (d, pos) => d.hw((p) => window.__hw.app.game.state.sim.handView(p.x, p.y, p.z), pos);
/** The text the crosshair shows for the aimed block (the aiming line of a station). */
const aimLine = (d) => d.page.evaluate(() => document.querySelector('.hw-cross__label')?.textContent ?? '');

/**
 * A level, roofless stage around the player (setup): the ground under the player is flattened to its own block, the
 * air above it cleared, so the sky is open and nothing is in the way. Returns the stage centre cell (feet height).
 */
async function stage(d) {
  const c = await d.hw((r) => {
    const hw = window.__hw;
    const p = hw.state().player;
    const cx = Math.floor(p.x);
    const cz = Math.floor(p.z);
    let gy = Math.floor(p.y) - 1;
    while (gy > 1 && !hw.getBlock(cx, gy, cz).solid) gy--;
    const floor = hw.getBlock(cx, gy, cz).block;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        hw.setVoxel(cx + dx, gy, cz + dz, floor);
        for (let dy = 1; dy <= 10; dy++) hw.setVoxel(cx + dx, gy + dy, cz + dz, 'air');
      }
    }
    hw.teleport(cx + 0.5, gy + 1.01, cz + 0.5);
    return { x: cx, y: gy + 1, z: cz };
  }, STAGE_R);
  await d.settle(500);
  hlog('hw.stage', c);
  return c;
}

/** Clears the pack, gives `items` ([key, count]...) and stages the player. */
async function prepare(d, items, { clock = 0.3 } = {}) {
  await d.hw(([list, t]) => {
    const hw = window.__hw;
    hw.clearInventory();
    hw.setTime(t);
    hw.setWeather('clear', true);
    for (const [key, n] of list) hw.give(key, n);
  }, [items, clock]);
  return stage(d);
}

/** One real Use on the station: aim, then right click / tap. */
async function tap(d, pos) {
  if (!(await d.aimAt(pos))) throw new Error(`cannot aim at ${JSON.stringify(pos)}`);
  await d.use();
  await d.settle(220);
}

/** Taps until `done()` (node side) holds; returns the taps. The hand stays whatever is selected. */
async function tapUntil(d, pos, done, what, maxTaps = 40) {
  for (let taps = 0; taps < maxTaps; taps++) {
    if (await done()) return taps;
    await tap(d, pos);
  }
  const v = await view(d, pos);
  hlog('hw.gave_up', { what, pos, view: v, aim: await aimLine(d) });
  throw new Error(`${what}: not done after ${maxTaps} taps (${v?.label ?? 'no view'})`);
}

/** Selects the empty hand, and a held tool when given. */
async function hold(d, item) {
  if (item) await d.selectItem(item);
  else await d.selectEmptyHand();
}

/** Places the station item as a real placement; returns the cell. */
async function placeStation(d, item) {
  const spot = await d.placeHeld(item);
  if (!spot) throw new Error(`${item} was not placed`);
  await d.settle(200);
  const v = await view(d, spot);
  if (!v) throw new Error(`${item} placed at ${JSON.stringify(spot)} but the simulation has no hand station there`);
  return spot;
}

/**
 * A stroke station job: load `input`, stroke bare-handed (or with `tool`) until the output waits, take it. Returns
 * { strokes, labels } so the steps can assert on what the player saw.
 */
async function strokeJob(d, assert, { station, input, inputs = [], tool = null, out, shot }) {
  const pos0 = await prepare(d, [[station, 1], [input, 4], ...inputs, ...(tool ? [[tool, 1]] : [])]);
  const spot = await placeStation(d, station);
  hlog('hw.job', { station, input, spot, pos0 });
  let v = await view(d, spot);
  assert(v.state === 'empty', `${station} starts ${v.state}`);
  assert(/empty/.test(await (async () => { await d.aimAt(spot); await d.settle(300); return aimLine(d); })()), `${station} aiming line does not say empty`);
  // Load: the held stack goes onto the station (Use with the item in hand).
  await d.selectItem(input);
  await tap(d, spot);
  v = await view(d, spot);
  assert(v.input && v.input.item === input, `${station} did not load ${input}: ${v.label}`);
  const loadedLine = await aimLine(d);
  assert(loadedLine.includes(v.name), `aiming line "${loadedLine}" does not name ${v.name}`);
  // Work.
  await hold(d, tool);
  let shotDone = false;
  const strokes = await tapUntil(d, spot, async () => {
    const now = await view(d, spot);
    if (!shotDone && now.progress > 0 && shot) {
      shotDone = true;
      await d.shot(shot);
    }
    return now.state === 'ready';
  }, `${station} work`);
  v = await view(d, spot);
  const readyLine = await aimLine(d);
  assert(/ready/.test(v.label), `${station} label when done: ${v.label}`);
  assert(v.output && v.output.item === out, `${station} output is ${v.output?.item}, not ${out}`);
  // Take with an empty hand.
  await hold(d, null);
  await tap(d, spot);
  const inv = await d.inventory();
  assert((inv[out] ?? 0) >= 1, `${station} gave no ${out} (${JSON.stringify(inv)})`);
  hlog('hw.job.done', { station, strokes, readyLine, loadedLine });
  return { strokes, spot, readyLine };
}

/** Sets a furnace at `cell` (setup) and returns after its entity exists. */
async function setFurnace(d, cell) {
  await d.hw((p) => window.__hw.setVoxel(p.x, p.y, p.z, 'furnace_clay', 2), cell);
  await waitFor(d.page, (p) => !!window.__hw.app.game.state.sim.furnaceAt(p.x, p.y, p.z), 'a furnace entity', { timeout: 5000, interval: 100, arg: cell });
}

/** The cell 3 blocks east of a station spot, flat on the stage (for a furnace next to it). */
const eastOf = (spot, dx = 3) => ({ x: spot.x + dx, y: spot.y, z: spot.z });

export async function handworkSteps({ d, step, assert }) {
  await step('hand quern grinds wheat into flour with real Use input', async () => {
    const r = await strokeJob(d, assert, { station: 'hand_quern', input: 'wheat', out: 'flour', shot: 'hw-quern' });
    assert(r.strokes >= 5, `the quern finished in ${r.strokes} taps - it should take about 6 strokes`);
    await d.shot('hw-quern-ready');
  });

  await step('mortar crushes copper ore', async () => {
    await strokeJob(d, assert, { station: 'mortar', input: 'copper_ore', out: 'crushed_copper' });
  });

  await step('loom weaves fiber into cloth', async () => {
    await strokeJob(d, assert, { station: 'loom', input: 'fiber', out: 'cloth' });
  });

  await step('clay table shapes clay into unfired cups', async () => {
    const r = await strokeJob(d, assert, { station: 'clay_table', input: 'clay', out: 'unfired_cup' });
    assert(r.strokes >= 3, `the clay table finished in ${r.strokes} taps`);
  });

  await step('stone anvil: hammer makes strokes count double', async () => {
    const cold = await strokeJob(d, assert, { station: 'stone_anvil', input: 'copper_ingot', out: 'copper_plate' });
    const hammered = await strokeJob(d, assert, { station: 'stone_anvil', input: 'copper_ingot', out: 'copper_plate', tool: 'flint_hammer' });
    hlog('hw.anvil', { cold: cold.strokes, hammered: hammered.strokes });
    assert(hammered.strokes < cold.strokes, `the hammer did not speed the anvil up (${hammered.strokes} vs ${cold.strokes} taps)`);
  });

  await step('pouring molten metal at the furnace opens the anvil hot-work window', async () => {
    await prepare(d, [['stone_anvil', 1], ['ingot_mould', 1], ['copper_ingot', 4]]);
    const anvil = await placeStation(d, 'stone_anvil');
    const furnace = eastOf(anvil);
    await setFurnace(d, furnace);
    // Setup: a finished smelt waiting in the crucible, molten.
    await d.hw((p) => {
      const e = window.__hw.app.game.state.sim.furnaceAt(p.x, p.y, p.z);
      e.crucibleMelt[0] = { item: 'copper_ingot', count: 2 };
      e.crucibleMoltenS[0] = 20;
    }, furnace);
    // Real input: the fired mould in hand, Use on the furnace.
    await d.selectItem('ingot_mould');
    const before = (await d.inventory()).copper_ingot ?? 0;
    await tap(d, furnace);
    const after = (await d.inventory()).copper_ingot ?? 0;
    hlog('hw.pour', { before, after, line: await aimLine(d) });
    assert(after - before === 2, `pouring gave ${after - before} ingots, not 2`);
    assert(!(await d.hw(() => window.__hw.state().ui.uiOpen)), 'the pour opened a screen');
    let v = await view(d, anvil);
    assert(v.hot, `the anvil is not hot after the pour: ${v.label}`);
    // Work the hot window: 2 copper ingots make a plate in 8 strokes cold, so 4 taps hot.
    await d.selectItem('copper_ingot');
    await tap(d, anvil);
    await hold(d, null);
    const taps = await tapUntil(d, anvil, async () => (await view(d, anvil)).state === 'ready', 'hot anvil work');
    hlog('hw.hotwork', { taps });
    assert(taps <= 5, `hot work took ${taps} taps (8 cold, 4 hot)`);
    await d.shot('hw-anvil-hot');
    await tap(d, anvil);
    assert(((await d.inventory()).copper_plate ?? 0) >= 1, 'no copper plate taken');
  });

  await step('alloy pot: copper and tin ingots poured in at the furnace become bronze, cast with a mould', async () => {
    await prepare(d, [['copper_ingot', 3], ['tin_ingot', 1], ['ingot_mould', 1], ['pickaxe_mould', 1]]);
    const cell = await d.hw(() => {
      const p = window.__hw.state().player;
      return { x: Math.floor(p.x) + 2, y: Math.floor(p.y), z: Math.floor(p.z) };
    });
    await setFurnace(d, cell);
    await d.hw((p) => {
      const sim = window.__hw.app.game.state.sim;
      const e = sim.furnaceAt(p.x, p.y, p.z);
      e.crucibleIn[0] = { item: 'alloy_pot', count: 1 };
      e.fuel[0] = { item: 'charcoal', count: 4 };
      sim.light(p.x, p.y, p.z);
    }, cell);
    await d.selectItem('copper_ingot');
    await tap(d, cell);
    await d.selectItem('tin_ingot');
    await tap(d, cell);
    const mix = await d.hw((p) => window.__hw.app.game.state.sim.furnaceAt(p.x, p.y, p.z).crucibleMix[0], cell);
    hlog('hw.pot', { mix });
    assert(mix[0] === 3 && mix[1] === 1, `the pot holds ${JSON.stringify(mix)}, not 3 copper and 1 tin`);
    // Fast-forward the furnace until the bronze is molten (setup), then pour it with real input.
    const molten = await d.hw((p) => {
      const g = window.__hw.app.game;
      const e = g.state.sim.furnaceAt(p.x, p.y, p.z);
      for (let i = 0; i < 400; i++) {
        window.__hw.tick(20);
        if (e.crucibleMelt[0]) return { item: e.crucibleMelt[0].item, count: e.crucibleMelt[0].count, s: e.crucibleMoltenS[0], temp: e.tempC };
      }
      return { item: null, temp: e.tempC };
    }, cell);
    hlog('hw.pot.molten', molten);
    assert(molten.item === 'bronze_ingot' && molten.count === 4, `the alloy pot made ${JSON.stringify(molten)}`);
    await d.selectItem('pickaxe_mould');
    await tap(d, cell);
    let inv = await d.inventory();
    assert((inv.bronze_pickaxe_head ?? 0) === 1, `no bronze pickaxe head cast (${JSON.stringify(inv)})`);
    await d.selectItem('ingot_mould');
    await tap(d, cell);
    inv = await d.inventory();
    assert((inv.bronze_ingot ?? 0) === 1, `the leftover bronze did not cast an ingot (${JSON.stringify(inv)})`);
    await d.shot('hw-cast');
  });

  await step('tanning trough and drying rack: timed work, insert and take only, rain resets it', async () => {
    await prepare(d, [['tanning_trough', 1], ['drying_rack', 1], ['hide', 2]]);
    const trough = await placeStation(d, 'tanning_trough');
    await d.selectItem('hide');
    await tap(d, trough);
    let v = await view(d, trough);
    assert(v.timed && v.input?.item === 'hide', `the trough did not take the hide: ${v.label}`);
    // A Use on a timed station must not stroke it.
    await hold(d, null);
    await tap(d, trough);
    const same = await view(d, trough);
    assert(same.progress === v.progress || same.progress <= 1, `a tap moved the trough from ${v.progress} to ${same.progress}`);
    await d.hw(() => window.__hw.tick(20 * 65));
    v = await view(d, trough);
    assert(v.state === 'ready', `the trough is ${v.state} (${v.label}) after 65 s`);
    await tap(d, trough);
    assert(((await d.inventory()).soaked_hide ?? 0) >= 2, 'no soaked hide taken from the trough');
    // The rack, in the open by day.
    await d.hw(() => window.__hw.setTime(0.3));
    await d.selectEmptyHand();
    const rack = await placeStation(d, 'drying_rack');
    await d.selectItem('soaked_hide');
    await tap(d, rack);
    v = await view(d, rack);
    assert(v.input?.item === 'soaked_hide', `the rack did not take the soaked hide: ${v.label}`);
    await d.hw(() => window.__hw.tick(20 * 30));
    v = await view(d, rack);
    hlog('hw.rack.dry', { label: v.label, state: v.state, progress: v.progress });
    assert(v.progress > 20 && v.state !== 'ready', `the rack did not dry by day: ${v.label}`);
    // Rain starts the drying over; the label says so.
    await d.hw(() => {
      window.__hw.setWeather('rain', true);
      window.__hw.tick(20 * 4);
    });
    const wet = await view(d, rack);
    hlog('hw.rack.rain', { label: wet.label, progress: wet.progress, reason: wet.waitReason });
    assert(wet.progress < v.progress, `rain did not reset the rack (${v.progress} -> ${wet.progress})`);
    await d.shot('hw-rack-rain');
    // Clear again, dry it out, take the leather.
    await d.hw(() => {
      window.__hw.setWeather('clear', true);
      window.__hw.tick(20 * 130);
    });
    v = await view(d, rack);
    assert(v.state === 'ready', `the rack is ${v.state} (${v.label}) after clear drying`);
    await hold(d, null);
    await tap(d, rack);
    assert(((await d.inventory()).leather ?? 0) >= 2, 'no leather taken from the rack');
  });

  await step('holding Use repeats strokes at the station pace', async () => {
    await prepare(d, [['hand_quern', 1], ['wheat', 4]]);
    const quern = await placeStation(d, 'hand_quern');
    await d.selectItem('wheat');
    await tap(d, quern);
    await hold(d, null);
    assert(await d.aimAt(quern), 'cannot aim at the quern');
    const before = (await view(d, quern)).progress;
    if (d.device === 'phonePortrait') {
      // Portrait has no Use button (a held world touch mines); taps are the stroke input there.
      for (let i = 0; i < 4; i++) await d.use();
    } else {
      await d.holdUse(1200);
    }
    await d.settle(200);
    const v = await view(d, quern);
    hlog('hw.hold', { before, after: v.progress, state: v.state, device: d.device });
    assert(v.progress > before || v.state === 'ready', `no strokes from Use (${before} -> ${v.progress})`);
  });
}
