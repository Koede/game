// Hearth and pipe steps of scripts/e2e-tech.mjs: a Blast hearth built block by block around a lit clay furnace, the
// STRUCTURE tab, a crate piped into the hearth's item hatch with the crate end set to Pull by the wrench, ore arriving
// in a crucible, a bucket poured into a tank and scooped back, the pipe screen opened by hand and a port switched off.
// Real input throughout (mouse / keys on desktop, taps on the phone, the real screens). window.__hw only gives items,
// teleports, aims (look), runs ticks and reads state; the toasts are read from the game's event bus.
import { waitFor } from './browser.mjs';
import { bagIndex, openTab, sendFromBag } from './e2eFurnace.mjs';

const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** Starts recording toasts and hearth events from the game's bus (read-only). */
export async function recordEvents(d) {
  await d.hw(() => {
    const bus = window.__hw.app.game.bus;
    window.__techLog = [];
    bus.on('toast', (e) => window.__techLog.push(`toast:${e.text}`));
    bus.on('hearth:formed', (e) => window.__techLog.push(`formed:${e.tier}`));
    bus.on('hearth:unformed', () => window.__techLog.push('unformed'));
  });
}

const events = (d) => d.hw(() => window.__techLog ?? []);

/**
 * Set-up: the nearest site within 40 blocks for the hearth, its pipe line and a tank (level ground, nothing above for
 * five blocks, the ground around at the same height or one higher), the player teleported to its south edge. Plants on
 * the site are mown only when no clean site exists. Returns { cx, cz, y0, mowed }.
 */
async function findSite(d) {
  return d.hw(() => {
    const hw = window.__hw;
    const p = hw.state().player;
    const groundY = (x, z) => {
      let y = hw.surfaceY(x, z);
      while (y > 0 && !hw.getBlock(x, y, z).solid) y--;
      return y;
    };
    const clearAbove = (x, y0, z, mow) => {
      for (let y = y0 + 1; y <= y0 + 5; y++) {
        const b = hw.getBlock(x, y, z);
        if (b.block === 'air') continue;
        if (mow && y <= y0 + 2 && b.replaceable && !['water', 'lava'].includes(b.block)) continue;
        return false;
      }
      return true;
    };
    const centres = [];
    for (let dx = -40; dx <= 40; dx++) for (let dz = -40; dz <= 40; dz++) if (Math.hypot(dx, dz) >= 4) centres.push([dx, dz, Math.hypot(dx, dz)]);
    centres.sort((a, b) => a[2] - b[2]);
    for (const mow of [false, true]) {
      for (const [ox, oz] of centres) {
        const cx = Math.floor(p.x) + ox;
        const cz = Math.floor(p.z) + oz;
        const y0 = groundY(cx, cz);
        const ground = hw.getBlock(cx, y0, cz).block;
        if (!['grass', 'dirt', 'sand', 'snow', 'stone', 'gravel'].includes(ground)) continue;
        // Level and clear where something is built (the hearth, the pipe line and crate east of it, the tank west);
        // the ground around may step up by one block (standing spots find their own height; lower ground would put
        // the eye below the hearth floor).
        let ok = true;
        for (let dx = -3; dx <= 4 && ok; dx++) {
          for (let dz = -3; dz <= 3 && ok; dz++) {
            const built = (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) || (dz === 0 && dx !== 0);
            const g = groundY(cx + dx, cz + dz);
            ok = hw.getBlock(cx + dx, g, cz + dz).solid && clearAbove(cx + dx, g, cz + dz, mow) && (built ? g === y0 : g === y0 || g === y0 + 1);
          }
        }
        if (!ok) continue;
        if (mow) {
          for (let dx = -3; dx <= 4; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
              const g = groundY(cx + dx, cz + dz);
              for (let y = g + 1; y <= g + 2; y++) if (hw.getBlock(cx + dx, y, cz + dz).block !== 'air') hw.setVoxel(cx + dx, y, cz + dz, 'air');
            }
          }
        }
        hw.teleport(cx + 0.5, y0 + 1, cz + 3.5);
        return { cx, cz, y0, mowed: mow };
      }
    }
    return null;
  });
}

/** Turns the view to a world point (set-up, like lookAt) and waits until the crosshair targets `cell`. */
async function aimPoint(d, point, cell, timeout = 2000) {
  await d.hw((pt) => {
    const hw = window.__hw;
    const p = hw.state().player;
    const dx = pt.x - p.x;
    const dy = pt.y - (p.y + 1.62);
    const dz = pt.z - p.z;
    hw.look(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
  }, point);
  try {
    await waitFor(d.page, (c) => {
      const t = window.__hw.state().target;
      return t && t.x === c.x && t.y === c.y && t.z === c.z;
    }, `aim at ${JSON.stringify(cell)}`, { timeout, interval: 100, arg: cell });
    return true;
  } catch {
    return false;
  }
}

/** Standing spots (feet cell centres) on the site's ground ring, nearest to `cell` first, at least 1.6 blocks away. */
async function standSpots(d, site, cell) {
  return d.hw(({ site, cell }) => {
    const hw = window.__hw;
    const out = [];
    for (let dx = -3; dx <= 4; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) < 2) continue;
        const x = site.cx + dx;
        const z = site.cz + dz;
        let y = site.y0 + 2;
        while (y > site.y0 + 1 && !hw.getBlock(x, y - 1, z).solid) y--;
        if (!hw.getBlock(x, y - 1, z).solid || hw.getBlock(x, y, z).block !== 'air' || hw.getBlock(x, y + 1, z).block !== 'air') continue;
        const h = Math.hypot(x + 0.5 - (cell.x + 0.5), z + 0.5 - (cell.z + 0.5));
        if (h < 1.6 || h > 4.2) continue;
        out.push({ x: x + 0.5, y, z: z + 0.5, h });
      }
    }
    return out.sort((a, b) => a.h - b.h);
  }, { site, cell });
}

/**
 * Places the held `item` into `cell` with the real Use control: aims at the centre of a face of a block next to it
 * (a solid one, or a pipe when a pipe is held; never a machine, whose screen would open), from wherever the player
 * stands, else from the next standing spot around the site. `where` limits the spots (e.g. for a furnace's facing).
 */
async function placeInto(d, site, item, cell, { where = null, supports = null } = {}) {
  await d.selectItem(item);
  const around = await standSpots(d, site, cell);
  const spots = where ? around.filter(where) : [null, ...around];
  for (const spot of spots.slice(0, 8)) {
    if (spot) {
      await d.hw((s) => window.__hw.teleport(s.x, s.y, s.z), spot);
      await d.settle(150);
    }
    const faces = await d.hw(({ cell, item, faces, only }) => {
      const hw = window.__hw;
      const p = hw.state().player;
      const eye = [p.x, p.y + 1.62, p.z];
      const out = [];
      for (let f = 0; f < 6; f++) {
        if (only && !only.includes(f)) continue;
        const [dx, dy, dz] = faces[f];
        const s = { x: cell.x + dx, y: cell.y + dy, z: cell.z + dz };
        const b = hw.getBlock(s.x, s.y, s.z);
        const pipe = b.block.endsWith('_pipe');
        if (!(b.solid || (pipe && item.endsWith('_pipe')))) continue;
        if (['crate', 'tank', 'item_hatch', 'fluid_hatch'].includes(b.block) || b.block.startsWith('furnace')) continue;
        // The face of the support that touches the cell, seen from the eye's side only.
        const axis = dx !== 0 ? 0 : dy !== 0 ? 1 : 2;
        const plane = [cell.x, cell.y, cell.z][axis] + (dx + dy + dz < 0 ? 0 : 1);
        if ((eye[axis] - plane) * -(dx + dy + dz) <= 0.05) continue;
        const point = { x: cell.x + 0.5 + dx * 0.52, y: cell.y + 0.5 + dy * 0.52, z: cell.z + 0.5 + dz * 0.52 };
        const dist = Math.hypot(point.x - eye[0], point.y - eye[1], point.z - eye[2]);
        if (dist > 4.8) continue;
        out.push({ s, point, dist });
      }
      return out.sort((a, b) => a.dist - b.dist);
    }, { cell, item, faces: FACES, only: supports });
    for (const f of faces) {
      if (!(await aimPoint(d, f.point, f.s, 1500))) continue;
      for (let attempt = 0; attempt < 3; attempt++) {
        await d.use();
        try {
          await waitFor(d.page, ({ c, k }) => window.__hw.getBlock(c.x, c.y, c.z).block === k, `${item} placed`, { timeout: 3000, interval: 100, arg: { c: cell, k: item } });
          return true;
        } catch {
          if ((await d.state()).ui.uiOpen) await d.closeScreen();
          if (!(await aimPoint(d, f.point, f.s, 1500))) break;
        }
      }
    }
  }
  throw new Error(`could not place ${item} at ${JSON.stringify(cell)}`);
}

/**
 * Presses Use until the held item becomes `item` (a bucket swap). A tap that spans a slow software frame reads as a
 * hold; the retry only happens while nothing changed, so a bucket is never swapped twice.
 */
async function useForHeld(d, item, aim) {
  for (let attempt = 0; ; attempt++) {
    await d.use();
    try {
      await waitFor(d.page, (k) => {
        const s = window.__hw.state();
        return s.inventory.find((x) => x.slot === s.player.selectedSlot)?.item === k;
      }, `a ${item} in hand`, { timeout: 4000, interval: 100, arg: item });
      return;
    } catch (err) {
      if (attempt >= 2 || (await d.state()).ui.uiOpen) throw err;
      console.log('       (the tap did not use the bucket; tapping again)');
      await aim();
    }
  }
}

/** Selects an empty hotbar slot with the real control (number key or tap). */
async function selectEmptySlot(d) {
  const used = new Set((await d.state()).inventory.filter((s) => s.slot < 9).map((s) => s.slot));
  const slot = [8, 7, 6, 5, 4, 3, 2, 1, 0].find((i) => !used.has(i));
  if (slot === undefined) throw new Error('no empty hotbar slot');
  if (d.touch) await d.press(d.page.locator('.hw-hotbar .hw-slot').nth(slot));
  else await d.page.keyboard.press(`Digit${slot + 1}`);
  await waitFor(d.page, (s) => window.__hw.state().player.selectedSlot === s, 'empty slot selected', { timeout: 5000, interval: 100, arg: slot });
}

/** Reads the pipe screen's data for the pipe at `cell` straight from the simulation (to check what the UI did). */
const pipeView = (d, cell) => d.hw((c) => {
  const v = window.__hw.app.game.state.sim.pipeView(c.x, c.y, c.z);
  return v && { family: v.family, ports: v.ports.map((p) => ({ x: p.x, y: p.y, z: p.z, dir: p.dir, block: p.block, mode: p.mode, status: p.status })) };
}, cell);

export async function techSteps({ d, step, assert, page }) {
  const ctx = {};

  await step('a flat building site is found and the bricks are given', async () => {
    await recordEvents(d);
    const site = await findSite(d);
    assert(site, 'no flat 8x7 site within 40 blocks');
    ctx.site = site;
    const { cx, cz, y0 } = site;
    console.log(`       site at ${cx},${y0},${cz}${site.mowed ? ' (plants mown)' : ''}`);
    await d.hw(() => {
      const hw = window.__hw;
      hw.clearInventory();
      hw.setTime(0.3);
      // The hearth check is not the combat check (that is e2e-ember). On a slow phone frame a Forge Warden
      // reaches the site and its 3-point hits kill the builder before the floor is down; the death screen
      // then has no Close button and the next place aborts. Peaceful removes natural automatons.
      hw.setDifficulty('peaceful');
      hw.give('brick', 15);
      hw.give('furnace_clay', 1);
      hw.give('item_hatch', 1);
      hw.give('charcoal', 8);
    });
    ctx.floor = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) ctx.floor.push({ x: cx + dx, y: y0 + 1, z: cz + dz });
    ctx.furnace = { x: cx, y: y0 + 2, z: cz + 1 };
    ctx.hatch = { x: cx + 1, y: y0 + 2, z: cz };
    ctx.ring = [[-1, -1], [0, -1], [1, -1], [-1, 0], [-1, 1], [1, 1]].map(([dx, dz]) => ({ x: cx + dx, y: y0 + 2, z: cz + dz }));
    ctx.inside = { x: cx, y: y0 + 2, z: cz };
  });

  await step('the hearth floor is laid brick by brick (real placing)', async () => {
    // Farthest from the south edge first, so nothing already laid stands between the eye and the next spot.
    const order = [...ctx.floor].sort((a, b) => a.z - b.z || a.x - b.x);
    for (const cell of order) await placeInto(d, ctx.site, 'brick', cell, { supports: [3] });
    await d.shot('30-floor');
  });

  await step('a clay furnace is set in the south wall, facing out, and lit through its screen', async () => {
    const f = ctx.furnace;
    // From straight south of it, so its front turns south (out of the hearth).
    await placeInto(d, ctx.site, 'furnace_clay', f, { where: (s) => Math.floor(s.x) === f.x && s.z > f.z + 1, supports: [3] });
    const facing = await d.hw((c) => window.__hw.getBlock(c.x, c.y, c.z).facing, f);
    assert(facing === 2, `the furnace faces ${facing}, not south (out of the hearth)`);
    await d.useBlock(f);
    await d.waitScreen('furnace');
    await sendFromBag(d, 'charcoal', 'Firebox');
    await d.press(page.locator('.hw-window .hw-fbx__btns button', { hasText: 'Light' }));
    await waitFor(page, () => window.__hw.state().furnaces.some((x) => x.lit), 'the fire to catch', { timeout: 5000, interval: 100 });
    await d.closeScreen();
  });

  await step('the walls and an item hatch go up and the Blast hearth forms', async () => {
    const order = [...ctx.ring].sort((a, b) => a.z - b.z || a.x - b.x);
    for (const cell of order) await placeInto(d, ctx.site, 'brick', cell, { supports: [3] });
    let log = await events(d);
    assert(!log.some((e) => e.startsWith('formed')), `formed before the hatch closed the wall: ${log.join(' | ')}`);
    await placeInto(d, ctx.site, 'item_hatch', ctx.hatch, { supports: [3] });
    log = await waitFor(page, () => {
      const l = window.__techLog;
      return l.some((e) => e.startsWith('formed')) && l.some((e) => /hearth formed/i.test(e)) ? l : null;
    }, 'the hearth to form', { timeout: 15_000, interval: 200 });
    console.log(`       ${log.filter((e) => /formed|hearth/i.test(e)).join(' | ')}`);
    assert(log.includes('formed:3'), `structural tier: ${log.join(' | ')}`);
    const active = await d.hw((c) => window.__hw.getBlock(c.x, c.y, c.z).active, ctx.ring[0]);
    assert(active, 'the formed shell does not glow (active bit off)');
    // A view of the whole hearth from outside, a little above.
    await d.hw(({ f, y0 }) => window.__hw.teleport(f.x + 2.5, y0 + 1, f.z + 3.5), { f: ctx.furnace, y0: ctx.site.y0 });
    await d.settle(200);
    await d.hw((c) => window.__hw.lookAt(c.x, c.y - 0.6, c.z), ctx.inside);
    await d.settle(900);
    await d.shot('31-hearth-formed');
  });

  await step('the hearth sheet (floating button) says the hearth is formed', async () => {
    await d.useBlock(ctx.furnace);
    await d.waitScreen('furnace');
    await openTab(d, 'structure');
    const status = await page.locator('.hw-window .hw-st__status').first().textContent();
    console.log(`       "${status.trim()}"`);
    assert(/formed/i.test(status) && !/not formed/i.test(status), `structure status "${status}"`);
    await d.settle(400);
    await d.shot('32-structure-tab');
    await openTab(d, 'smelt'); // Back from the sheet; Escape closes the sheet first, then the screen
    await d.closeScreen();
  });

  await step('a crate is piped into the item hatch (real placing)', async () => {
    const { cx, cz, y0 } = ctx.site;
    ctx.crate = { x: cx + 4, y: y0 + 1, z: cz };
    ctx.pipes = [{ x: cx + 3, y: y0 + 1, z: cz }, { x: cx + 2, y: y0 + 1, z: cz }, { x: cx + 2, y: y0 + 2, z: cz }];
    await d.hw(() => {
      window.__hw.give('crate', 1);
      window.__hw.give('item_pipe', 3);
      window.__hw.give('wrench', 1);
      window.__hw.give('copper_ore', 6);
    });
    await placeInto(d, ctx.site, 'crate', ctx.crate, { supports: [3] });
    await placeInto(d, ctx.site, 'item_pipe', ctx.pipes[0], { supports: [3] });
    await placeInto(d, ctx.site, 'item_pipe', ctx.pipes[1], { supports: [3] });
    await placeInto(d, ctx.site, 'item_pipe', ctx.pipes[2], { supports: [3] });
    const view = await pipeView(d, ctx.pipes[0]);
    assert(view && view.ports.length === 2, `ports on the line: ${JSON.stringify(view)}`);
    ctx.cratePort = view.ports.find((p) => p.block === 'crate');
    ctx.hatchPort = view.ports.find((p) => p.block === 'item_hatch');
    assert(ctx.cratePort && ctx.hatchPort, `ends: ${JSON.stringify(view.ports)}`);
    assert(ctx.cratePort.mode === 'push', `the crate end starts as ${ctx.cratePort.mode}`);
  });

  await step('copper ore goes into the crate through its screen', async () => {
    await d.useBlock(ctx.crate);
    await d.waitScreen('crate');
    const slot = (await d.state()).inventory.find((s) => s.item === 'copper_ore').slot;
    await d.press(page.locator('.hw-window .hw-bag .hw-slot').nth(bagIndex(slot)));
    await d.press(page.locator('.hw-window .hw-carry button', { hasText: 'Crate' }).first());
    await waitFor(page, () => !window.__hw.state().inventory.some((s) => s.item === 'copper_ore'), 'the ore to leave the pack', { timeout: 5000, interval: 100 });
    await d.settle(300);
    await d.shot('33-crate');
    await d.closeScreen();
  });

  await step('the wrench sets the crate end to Pull and the ore travels into a crucible', async () => {
    await d.selectItem('wrench');
    const pipe = ctx.pipes[0];
    // Stand south of the first pipe and aim at its arm reaching into the crate (east).
    await d.hw((s) => window.__hw.teleport(s.x, s.y, s.z), { x: pipe.x + 0.5, y: ctx.site.y0 + 1, z: pipe.z + 2.5 });
    await d.settle(200);
    const arm = { x: pipe.x + 0.93, y: pipe.y + 0.5, z: pipe.z + 0.5 };
    assert(await aimPoint(d, arm, pipe), 'cannot aim at the pipe arm');
    await d.shot('34-wrench-aim');
    // A tap spanning a slow software frame reads as a hold (exactly as on a stalling phone): tap again while the end
    // still pushes.
    for (let attempt = 0; ; attempt++) {
      await d.use();
      try {
        await waitFor(page, () => window.__techLog.includes('toast:Pulling from Crate'), 'the "Pulling from Crate" toast', { timeout: 4000, interval: 100 });
        break;
      } catch (err) {
        const mode = (await pipeView(d, pipe)).ports.find((p) => p.block === 'crate').mode;
        if (attempt >= 2 || mode !== 'push') throw err;
        console.log('       (the tap did not turn the end; tapping again)');
        assert(await aimPoint(d, arm, pipe), 'cannot aim at the pipe arm again');
      }
    }
    await d.settle(250);
    await d.shot('35-pulling');
    const view = await pipeView(d, pipe);
    const port = view.ports.find((p) => p.block === 'crate');
    assert(port.mode === 'pull', `the crate end is ${port.mode}`);
    // Bronze chutes send 4 items every 2 s at 4 blocks a second: in real time, the first batch drawn on its way.
    await d.hw((c) => window.__hw.lookAt(c.x, c.y, c.z), ctx.pipes[1]);
    // The renderer draws the packet (its stats count the items drawn in pipes last frame).
    const drawn = await waitFor(page, () => window.__hw.app.game.renderer.stats.tech?.packets ?? 0, 'an item drawn moving in the pipes', { timeout: 15_000, interval: 50 });
    assert(drawn > 0, 'nothing drawn moving');
    await d.settle(150);
    await d.shot('36-packets');
    for (let i = 0; i < 20; i++) {
      const f = (await d.state()).furnaces.find((x) => x.x === ctx.furnace.x && x.z === ctx.furnace.z);
      if (f.crucibleIn.some((s) => s?.item === 'copper_ore')) break;
      await d.hw(() => window.__hw.tick(20));
    }
    const f = (await d.state()).furnaces.find((x) => x.x === ctx.furnace.x && x.z === ctx.furnace.z);
    const arrived = f.crucibleIn.concat(f.crucibleOut).reduce((n, s) => n + (s && /copper/.test(s.item) ? s.count : 0), 0);
    console.log(`       crucible in ${JSON.stringify(f.crucibleIn)} out ${JSON.stringify(f.crucibleOut)}`);
    assert(arrived > 0, 'no ore reached a crucible');
  });

  await step('a water bucket pours into a tank and an empty bucket scoops it back', async () => {
    const { cx, cz, y0 } = ctx.site;
    ctx.tank = { x: cx - 3, y: y0 + 1, z: cz };
    await d.hw(() => {
      window.__hw.give('tank', 1);
      window.__hw.give('water_pail', 1);
    });
    await placeInto(d, ctx.site, 'tank', ctx.tank, { supports: [3] });
    await d.selectItem('water_pail');
    const top = { x: ctx.tank.x + 0.5, y: ctx.tank.y + 0.98, z: ctx.tank.z + 0.5 };
    if (!(await aimPoint(d, top, ctx.tank))) {
      await d.hw((s) => window.__hw.teleport(s.x, s.y, s.z), { x: ctx.tank.x + 0.5, y: y0 + 1, z: ctx.tank.z + 2.5 });
      assert(await aimPoint(d, top, ctx.tank), 'cannot aim at the tank');
    }
    await useForHeld(d, 'pail', () => aimPoint(d, top, ctx.tank));
    let s = await d.state();
    assert(!s.ui.uiOpen, `a screen opened: ${s.ui.open}`);
    const litres = await d.hw((c) => window.__hw.app.game.state.sim.machineView(c.x, c.y, c.z)?.fluids?.stack?.litres ?? null, ctx.tank);
    assert(litres === 1000, `the tank holds ${litres} L`);
    await d.shot('37-tank-filled');
    await d.selectItem('pail');
    await aimPoint(d, top, ctx.tank);
    await useForHeld(d, 'water_pail', () => aimPoint(d, top, ctx.tank));
    s = await d.state();
    assert(!s.ui.uiOpen, `a screen opened: ${s.ui.open}`);
    const after = await d.hw((c) => window.__hw.app.game.state.sim.machineView(c.x, c.y, c.z)?.fluids?.stack?.litres ?? null, ctx.tank);
    assert(after === 0, `the tank still holds ${after} L`);
  });

  await step('Use with an empty hand opens the pipe screen and a port is switched off there', async () => {
    await selectEmptySlot(d);
    const pipe = ctx.pipes[2];
    await d.hw((s) => window.__hw.teleport(s.x, s.y, s.z), { x: pipe.x + 0.5, y: ctx.site.y0 + 1, z: pipe.z + 2.5 });
    await d.settle(200);
    assert(await aimPoint(d, { x: pipe.x + 0.5, y: pipe.y + 0.5, z: pipe.z + 0.5 }, pipe), 'cannot aim at the pipe');
    for (let attempt = 0; ; attempt++) {
      await d.use();
      try {
        await d.waitScreen('pipe');
        break;
      } catch (err) {
        if (attempt >= 2) throw err;
      }
    }
    const row = page.locator('.hw-window .hw-pipe__port', { hasText: 'Item Hatch' }).first();
    await row.waitFor({ state: 'visible', timeout: 5000 });
    await d.settle(300);
    await d.shot('38-pipe-screen');
    await d.press(row.locator('.hw-seg__opt', { hasText: 'Off' }));
    await waitFor(page, (c) => {
      const v = window.__hw.app.game.state.sim.pipeView(c.x, c.y, c.z);
      return v?.ports.find((p) => p.block === 'item_hatch')?.mode === 'off';
    }, 'the hatch end to switch off', { timeout: 5000, interval: 100, arg: pipe });
    await d.settle(400);
    const status = await row.locator('.hw-pipe__status').textContent();
    assert(/off/i.test(status), `the row says "${status}"`);
    await d.shot('39-pipe-port-off');
    await d.closeScreen();
  });

  await step('glowcap light tints an animal and a pump cyan at night', async () => {
    const { cx, cz } = ctx.site;
    // Render check (set-up only): a hen and a pump beside glowcaps on a stone shelf high up, far from the hearth's
    // firelight, at night.
    const shelf = { x: cx + 24, y: 75, z: cz };
    await d.hw((p) => {
      const hw = window.__hw;
      hw.setTime(0.9);
      hw.teleport(p.x + 0.5, p.y + 1, p.z + 2.5);
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) hw.setVoxel(p.x + dx, p.y, p.z + dz, 'stone');
      for (const [dx, dz] of [[-2, -2], [0, -3], [2, -2], [-1, 0]]) hw.setVoxel(p.x + dx, p.y + 1, p.z + dz, 'glowcap');
      hw.setVoxel(p.x + 1, p.y + 1, p.z - 1, 'pump', 2);
      hw.spawnMob('hen', p.x - 0.5, p.y + 1, p.z - 0.5);
      hw.lookAt(p.x, p.y + 0.6, p.z - 1);
    }, shelf);
    await d.settle(2000);
    await d.shot('40-glowcap-night');
    const cool = await d.hw(() => {
      const scene = window.__hw.app.game.renderer.scene;
      const share = (name) => {
        const mesh = scene.getObjectByName(name);
        if (!mesh || !mesh.count) return null;
        const a = mesh.geometry.getAttribute('aCool');
        let best = 0;
        // aCool is a vec2 on mobs (x cool share, y head turn): read the x of every instance, whatever the item size.
        for (let i = 0; i < mesh.count; i++) best = Math.max(best, a.array[i * a.itemSize]);
        return best;
      };
      return { hen: share('mob-hen'), pump: share('machine-pump') };
    });
    console.log(`       cool share: hen ${cool.hen}, pump ${cool.pump}`);
    assert(cool.hen > 0.5 && cool.pump > 0.5, `the glowcaps' light does not tint them: ${JSON.stringify(cool)}`);
    const frame = await d.hw(() => window.__hw.sampleFrame());
    assert(frame.distinctColors > 20, `the night frame is flat: ${JSON.stringify(frame)}`);
  });
}
