// Food, farming, animals, buckets, flowing water and weather steps of scripts/e2e-features.mjs - real input throughout.
// window.__hw only sets things up (give, teleport, aim, set the time / weather / food bar, run ticks) and reads state.
import { waitFor } from './browser.mjs';
import { bagIndex, openTab, sendFromBag, showBag } from './e2eFurnace.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const MEATS = { hen: 'raw_fowl', goat: 'raw_mutton', boar: 'raw_chop' };
const COOKED = { raw_fowl: 'cooked_fowl', raw_mutton: 'cooked_mutton', raw_chop: 'cooked_chop' };

/** Points the view at a living animal's body centre (aiming is set-up, like lookAt for blocks). */
async function aimAtMob(d, id) {
  return d.hw((id) => {
    const hw = window.__hw;
    const s = hw.state();
    const m = s.mobs.find((x) => x.id === id);
    if (!m) return null;
    const p = s.player;
    const body = { hen: 0.35, goat: 0.65, boar: 0.5 }[m.species] ?? 0.5;
    const dx = m.x - p.x;
    const dz = m.z - p.z;
    const dy = m.y + body - (p.y + 1.62);
    hw.look(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    return m;
  }, id);
}

/** Puts the player on open ground about 2.2 blocks from the animal, at its height (set-up). */
async function standNearMob(d, id) {
  return d.hw((id) => {
    const hw = window.__hw;
    const m = hw.state().mobs.find((x) => x.id === id);
    if (!m) return false;
    const free = (x, y, z) => !hw.getBlock(x, y, z).solid && !['water', 'lava'].includes(hw.getBlock(x, y, z).block);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = Math.floor(m.x + Math.cos(a) * 2.2);
      const z = Math.floor(m.z + Math.sin(a) * 2.2);
      for (let y = Math.floor(m.y) + 1; y >= Math.floor(m.y) - 1; y--) {
        if (hw.getBlock(x, y - 1, z).solid && free(x, y, z) && free(x, y + 1, z)) {
          hw.teleport(x + 0.5, y, z + 0.5);
          return true;
        }
      }
    }
    return false;
  }, id);
}

/**
 * Aims at the top of a block of `key` with open air above, 1.6-3.6 blocks away and below the eye: the first
 * candidate the crosshair really reaches (nothing in the way). Returns the cell, or null.
 */
async function aimAtTop(d, key) {
  const near = await aimAtTopInReach(d, key);
  if (near) return near;
  // Nothing suitable in reach here: walk-free set-up, stand beside the nearest such block within 24 and try again.
  const far = await d.hw((key) => {
    const hw = window.__hw;
    return hw.findBlocks(key, 24, 400).find((c) => hw.getBlock(c.x, c.y + 1, c.z).block === 'air' && hw.getBlock(c.x, c.y + 2, c.z).block === 'air') ?? null;
  }, key);
  if (!far) return null;
  const stand = await d.standBeside({ x: far.x, y: far.y + 1, z: far.z });
  if (!stand) return null;
  await d.hw((s) => window.__hw.teleport(s.x, s.y, s.z), stand);
  await d.settle(300);
  return aimAtTopInReach(d, key);
}

async function aimAtTopInReach(d, key) {
  const cells = await d.hw((key) => {
    const hw = window.__hw;
    const p = hw.state().player;
    return hw.findBlocks(key, 5, 64).filter((c) => {
      const h = Math.hypot(c.x + 0.5 - p.x, c.z + 0.5 - p.z);
      return h >= 1.6 && h <= 3.6 && c.y < p.y && hw.getBlock(c.x, c.y + 1, c.z).block === 'air';
    }).slice(0, 10);
  }, key);
  for (const cell of cells) {
    await d.hw((c) => {
      const hw = window.__hw;
      const p = hw.state().player;
      const dx = c.x + 0.5 - p.x;
      const dz = c.z + 0.5 - p.z;
      const dy = c.y + 0.97 - (p.y + 1.62);
      hw.look(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    }, cell);
    try {
      await waitFor(d.page, (c) => {
        const t = window.__hw.state().target;
        return t && t.x === c.x && t.y === c.y && t.z === c.z;
      }, `aim at the top of ${key}`, { timeout: 1500, interval: 100, arg: cell });
      return cell;
    } catch {
      // Something stands in the way: the next candidate.
    }
  }
  return null;
}

/**
 * Set-up: teleports to open, level ground near the player (no canopy or walls a few blocks around). Returns the
 * spot and the yaw of the most open view from it, or null.
 */
async function goToOpenGround(d) {
  const spot = await d.hw(() => {
    const hw = window.__hw;
    const p = hw.state().player;
    const canopy = ['oak_leaves', 'pine_leaves', 'oak_log', 'pine_log', 'water', 'lava'];
    const groundY = (x, z) => {
      let y = hw.surfaceY(x, z);
      while (y > 0 && !hw.getBlock(x, y, z).solid) y--;
      return y;
    };
    for (let r = 0; r <= 32; r += 2) {
      for (let a = 0; a < 16; a++) {
        const x = Math.floor(p.x + Math.cos((a / 16) * Math.PI * 2) * r);
        const z = Math.floor(p.z + Math.sin((a / 16) * Math.PI * 2) * r);
        const y0 = groundY(x, z);
        let ok = true;
        for (let dx = -2; dx <= 2 && ok; dx++) {
          for (let dz = -2; dz <= 2 && ok; dz++) {
            ok = !canopy.includes(hw.getBlock(x + dx, hw.surfaceY(x + dx, z + dz), z + dz).block) && Math.abs(groundY(x + dx, z + dz) - y0) <= 1;
          }
        }
        if (!ok) continue;
        hw.teleport(x + 0.5, y0 + 1, z + 0.5);
        // Mow the grass tufts and flowers around (they are targeted through their whole cell and would catch the
        // crosshair). Flowers are not `replaceable`, so test for any non-solid plant, not only replaceable ones.
        for (let dx = -4; dx <= 4; dx++) {
          for (let dz = -4; dz <= 4; dz++) {
            const gy = groundY(x + dx, z + dz) + 1;
            const b = hw.getBlock(x + dx, gy, z + dz);
            if (b.block !== 'air' && !b.solid && !['water', 'lava'].includes(b.block)) hw.setVoxel(x + dx, gy, z + dz, 'air');
          }
        }
        let best = 0;
        let bestScore = Infinity;
        for (let i = 0; i < 8; i++) {
          const yaw = (i * Math.PI) / 4;
          let score = 0;
          for (let dd = 2; dd <= 14; dd += 2) {
            const cx = Math.floor(x + 0.5 - Math.sin(yaw) * dd);
            const cz = Math.floor(z + 0.5 - Math.cos(yaw) * dd);
            score += Math.max(0, hw.surfaceY(cx, cz) - (y0 + 2));
          }
          if (score < bestScore) {
            bestScore = score;
            best = yaw;
          }
        }
        return { x, z, yaw: best };
      }
    }
    return null;
  });
  await d.settle(300);
  return spot;
}

/** Uses the real Use control until `done()` holds (a tap spanning a slow frame reads as a hold on phones). */
async function useUntil(d, done, what) {
  for (let i = 0; i < 3; i++) {
    await d.use();
    try {
      await waitFor(d.page, done.fn, what, { timeout: 4000, interval: 100, arg: done.arg });
      return;
    } catch (err) {
      if (i === 2) throw err;
    }
  }
}

/** Smelts `input` into `output` in the crucible (fast-forwarded) and collects it onto the hotbar. */
async function smeltAndCollect(d, page, input, output) {
  await openTab(d, 'smelt');
  await sendFromBag(d, input, 'Crucible');
  let f = (await d.state()).furnaces[0];
  if (f.crucibleIn[0]?.item !== input) throw new Error(`the crucible holds ${JSON.stringify(f.crucibleIn[0])}`);
  for (let i = 0; i < 30; i++) {
    f = (await d.state()).furnaces[0];
    if (f.crucibleOut[0]?.item === output && !f.crucibleIn[0]) break;
    await d.hw(() => window.__hw.tick(60));
  }
  if (f.crucibleOut[0]?.item !== output) throw new Error(`no ${output}: ${JSON.stringify(f.crucibleOut)} at ${f.tempC} C`);
  await d.settle(400);
  await showBag(d, false);
  // Pick the output stack, then tap a free hotbar slot in the bag (where the next step selects it).
  const used = new Set((await d.state()).inventory.map((s) => s.slot));
  const free = [...Array(9).keys()].find((i) => !used.has(i));
  if (free === undefined) throw new Error('the hotbar is full');
  await d.press(page.locator('.hw-window .hw-cru .hw-slot').nth(1));
  await showBag(d, true);
  await d.press(page.locator('.hw-window .hw-drawer .hw-slot').nth(bagIndex(free)));
  await showBag(d, false);
  await waitFor(page, (o) => window.__hw.state().inventory.some((s) => s.item === o && s.slot < 9), `${output} on the hotbar`, { timeout: 5000, interval: 100, arg: output });
}

export async function featureSteps({ d, step, assert, page }) {
  const ctx = {};

  await step('an animal near spawn is hit with Mine until it drops meat', async () => {
    await d.hw(() => {
      window.__hw.clearInventory();
      window.__hw.give('flint_axe', 1);
      window.__hw.setTime(0.15);
    });
    await d.selectItem('flint_axe');
    const mobs = await waitFor(page, () => {
      const list = window.__hw.state().mobs.filter((m) => !m.baby && m.d < 64);
      return list.length ? list : null;
    }, 'an animal near spawn', { timeout: 20_000 });
    const mob = mobs[0];
    ctx.meat = MEATS[mob.species];
    console.log(`       ${mob.species} #${mob.id} ${mob.d} blocks from spawn`);
    let shot = false;
    let hits = 0;
    const misses = [];
    for (let attempt = 0; attempt < 24; attempt++) {
      // Let a hurt animal stop fleeing, then stand beside it and aim (set-up); the hit itself is the real Mine control.
      // Flight lasts 5 s of GAME time; at a few frames a second the 20 Hz steps fall behind real time (at most 5 per
      // frame), so the wait is measured in ticks: still fleeing after 7 s of game time would be a real fault.
      const t0 = (await d.state()).ticks;
      try {
        await waitFor(page, ({ id, t0 }) => {
          const s = window.__hw.state();
          const m = s.mobs.find((x) => x.id === id);
          return !m || m.state !== 'flee' || s.ticks - t0 > 140;
        }, 'the animal to calm down', { timeout: 40_000, interval: 200, arg: { id: mob.id, t0 } });
        const s = await d.state();
        if (s.mobs.find((m) => m.id === mob.id)?.state === 'flee') misses.push(`still fleeing after ${s.ticks - t0} ticks`);
      } catch {
        misses.push('still fleeing (no ticks ran)');
      }
      const alive = (await d.state()).mobs.find((m) => m.id === mob.id);
      if (!alive) break;
      if (!(await standNearMob(d, mob.id))) {
        misses.push('no ground');
        await sleep(1000);
        continue;
      }
      await d.settle(250);
      await aimAtMob(d, mob.id);
      try {
        await waitFor(page, (id) => window.__hw.state().targetAnimal?.id === id, 'the animal under the crosshair', { timeout: 2500, interval: 100, arg: mob.id });
      } catch {
        misses.push('not targeted');
        continue;
      }
      if (!shot) {
        const label = await page.locator('.hw-cross__name').textContent();
        assert(label.includes(' - ') && label.toLowerCase().includes(mob.species), `crosshair label "${label}"`);
        await d.shot('20-animal-target');
        shot = true;
      }
      const health = alive.health;
      await d.mineDown();
      for (let t = 0; t < 8; t++) {
        await aimAtMob(d, mob.id);
        await sleep(120);
        const now = (await d.state()).mobs.find((m) => m.id === mob.id);
        if (!now || now.health < health) break;
      }
      await d.mineUp();
      const after = (await d.state()).mobs.find((m) => m.id === mob.id);
      if (!after || after.health < health) hits++;
      else misses.push('press did not hit');
    }
    if (misses.length) console.log(`       misses: ${misses.join(', ')}`);
    assert(hits >= 1, 'the animal was never hit');
    await waitFor(page, (meat) => window.__hw.state().inventory.some((s) => s.item === meat), `${ctx.meat} in the pack`, { timeout: 8000, interval: 200, arg: ctx.meat });
    const axe = (await d.state()).inventory.find((s) => s.item === 'flint_axe');
    assert(axe && axe.durability < 64, `the axe did not wear: ${JSON.stringify(axe)}`);
    console.log(`       ${hits} hit(s), ${JSON.stringify((await d.state()).inventory.find((s) => s.item === ctx.meat))}`);
    await d.settle(300);
    await d.shot('21-animal-meat');
  });

  await step('raw meat cooks in the furnace crucible', async () => {
    // The base for the rest of the run: open, level ground (wherever the chase ended).
    assert(await goToOpenGround(d), 'no open ground near the player');
    await d.hw(() => {
      window.__hw.give('furnace_clay', 1);
      window.__hw.give('charcoal', 6);
    });
    ctx.furnace = await d.placeHeld('furnace_clay');
    assert(ctx.furnace, 'the furnace could not be placed');
    await d.useBlock(ctx.furnace);
    await d.waitScreen('furnace');
    await sendFromBag(d, 'charcoal', 'Firebox');
    await d.press(page.locator('.hw-window .hw-fbx__btns button', { hasText: 'Light' }));
    await waitFor(page, () => window.__hw.state().furnaces[0]?.lit, 'the fire to catch', { timeout: 5000, interval: 100 });
    ctx.cooked = COOKED[ctx.meat];
    await smeltAndCollect(d, page, ctx.meat, ctx.cooked);
    await d.shot('22-cooked');
    await d.closeScreen();
  });

  await step('eating the cooked meat restores food', async () => {
    await d.hw(() => {
      window.__hw.setFood(6);
      window.__hw.look(0.4, 0.6);
    });
    await d.selectItem(ctx.cooked);
    const before = (await d.state()).player.food;
    await useUntil(d, { fn: (b) => window.__hw.state().player.food > b, arg: before }, 'the food bar to fill');
    const after = (await d.state()).player.food;
    assert(after >= before + 5, `food ${before} -> ${after}`);
    await d.shot('23-ate');
  });

  await step('a hoe tills grass into farmland', async () => {
    await d.hw(() => {
      window.__hw.clearInventory();
      window.__hw.give('flint_hoe', 1);
      window.__hw.give('wheat_seeds', 4);
    });
    await d.selectItem('flint_hoe');
    const cell = await aimAtTop(d, 'grass');
    assert(cell, 'no grass with open air above near the player');
    await useUntil(d, { fn: (c) => window.__hw.getBlock(c.x, c.y, c.z).block === 'farmland', arg: cell }, 'farmland');
    ctx.farmland = cell;
    const hoe = (await d.state()).inventory.find((s) => s.item === 'flint_hoe');
    assert(hoe.durability === 63, `hoe durability ${hoe.durability}`);
  });

  await step('wheat seeds plant on the farmland', async () => {
    await d.selectItem('wheat_seeds');
    const c = ctx.farmland;
    await d.hw((c) => {
      const hw = window.__hw;
      const p = hw.state().player;
      const dx = c.x + 0.5 - p.x;
      const dz = c.z + 0.5 - p.z;
      hw.look(Math.atan2(-dx, -dz), Math.atan2(c.y + 0.97 - (p.y + 1.62), Math.hypot(dx, dz)));
    }, c);
    await useUntil(d, { fn: (c) => window.__hw.getBlock(c.x, c.y + 1, c.z).block === 'wheat_0', arg: c }, 'wheat planted');
    const seeds = (await d.inventory()).wheat_seeds;
    assert(seeds === 3, `seeds left ${seeds}`);
    await d.settle(300);
    await d.shot('24-planted');
  });

  await step('dough is made at the workbench from flour and a water bucket', async () => {
    await d.hw(() => {
      window.__hw.clearInventory();
      window.__hw.give('workbench', 1);
      window.__hw.give('flour', 2);
      window.__hw.give('water_pail', 1);
    });
    await d.hw((f) => window.__hw.teleport(f.x + 0.5, f.y, f.z + 2.5), ctx.furnace);
    await d.settle(300);
    ctx.workbench = await d.placeHeld('workbench', ctx.furnace);
    assert(ctx.workbench, 'the workbench could not be placed');
    await d.useBlock(ctx.workbench);
    await d.waitScreen('workbench');
    await d.make('dough');
    const inv = await d.inventory();
    assert(inv.dough === 1, `dough ${inv.dough}`);
    assert(inv.pail === 1 && !inv.water_pail && !inv.flour, `bucket back, flour used: ${JSON.stringify(inv)}`);
    await d.shot('25-dough');
    await d.closeScreen();
  });

  await step('the dough bakes into bread in the furnace', async () => {
    await d.useBlock(ctx.furnace);
    await d.waitScreen('furnace');
    await smeltAndCollect(d, page, 'dough', 'bread');
    await d.shot('26-bread');
    await d.closeScreen();
  });

  await step('a bronze bucket scoops lava (the block goes) and pours it back', async () => {
    assert(await goToOpenGround(d), 'no open ground near the player');
    const spots = await d.hw(() => {
      const hw = window.__hw;
      hw.clearInventory();
      hw.give('bronze_bucket', 1);
      const p = hw.state().player;
      const out = [];
      for (const [dx, dz] of [[0, -3], [3, 0], [0, 3], [-3, 0], [2, -2], [-2, 2], [2, 2], [-2, -2]]) {
        const x = Math.floor(p.x) + dx;
        const z = Math.floor(p.z) + dz;
        let y = hw.surfaceY(x, z);
        while (y > 0 && !hw.getBlock(x, y, z).solid) y--;
        if (y < Math.floor(p.y) - 2 || y > Math.floor(p.y)) continue;
        const ground = hw.getBlock(x, y, z).block;
        if (!['grass', 'dirt', 'sand', 'stone', 'gravel', 'snow'].includes(ground)) continue;
        const above = hw.getBlock(x, y + 1, z);
        if (above.block !== 'air' && !above.replaceable) continue;
        out.push({ x, y, z, ground, plant: above.block });
      }
      return out;
    });
    await d.selectItem('bronze_bucket');
    // A small lava pool (set-up) in plain sight: the first candidate the crosshair reaches without anything in the way.
    let pool = null;
    for (const c of spots) {
      await d.hw((c) => {
        window.__hw.setVoxel(c.x, c.y + 1, c.z, 'air');
        window.__hw.setVoxel(c.x, c.y, c.z, 'lava');
        window.__hw.lookAt(c.x, c.y, c.z);
      }, c);
      try {
        await waitFor(page, (c) => {
          const t = window.__hw.state().target;
          return t && t.block === 'lava' && t.x === c.x && t.y === c.y && t.z === c.z;
        }, 'aim at the lava', { timeout: 2000, interval: 100, arg: c });
        pool = c;
        break;
      } catch {
        await d.hw((c) => {
          window.__hw.setVoxel(c.x, c.y, c.z, c.ground);
          window.__hw.setVoxel(c.x, c.y + 1, c.z, c.plant);
        }, c);
      }
    }
    assert(pool, 'no spot in plain sight for a lava pool');
    await d.shot('27-lava-aim');
    await useUntil(d, { fn: () => window.__hw.state().inventory.some((s) => s.item === 'lava_bucket'), arg: null }, 'a lava bucket');
    assert((await d.hw((c) => window.__hw.getBlock(c.x, c.y, c.z).block, pool)) === 'air', 'the lava block is still there');
    // Pour onto open ground in reach: the kind the player stands on first, then any common ground.
    const under = await d.hw(() => {
      const p = window.__hw.state().player;
      return window.__hw.getBlock(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z)).block;
    });
    let spot = null;
    for (const key of [...new Set([under, 'grass', 'dirt', 'sand', 'stone', 'snow', 'gravel'])]) {
      spot = await aimAtTopInReach(d, key);
      if (spot) break;
    }
    spot ??= await aimAtTop(d, under);
    assert(spot, `no ground to pour on (standing on ${under})`);
    await useUntil(d, { fn: (c) => window.__hw.getBlock(c.x, c.y + 1, c.z).block === 'lava', arg: spot }, 'lava poured');
    const inv = await d.inventory();
    assert(inv.bronze_bucket === 1 && !inv.lava_bucket, `buckets after pouring: ${JSON.stringify(inv)}`);
    await d.settle(300);
    await d.shot('28-lava-poured');
  });

  await step('poured water flows out, and the empty bucket takes its source back so the puddle drains', async () => {
    assert(await goToOpenGround(d), 'no open ground near the player');
    await d.hw(() => {
      window.__hw.clearInventory();
      window.__hw.give('water_pail', 1);
    });
    await d.selectItem('water_pail');
    const under = await d.hw(() => {
      const p = window.__hw.state().player;
      return window.__hw.getBlock(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z)).block;
    });
    let spot = null;
    for (const key of [...new Set([under, 'grass', 'dirt', 'sand', 'stone', 'snow', 'gravel'])]) {
      spot = await aimAtTopInReach(d, key);
      if (spot) break;
    }
    assert(spot, `no ground to pour on (standing on ${under})`);
    const source = { x: spot.x, y: spot.y + 1, z: spot.z };
    await useUntil(d, { fn: (c) => window.__hw.getBlock(c.x, c.y, c.z).block === 'water', arg: source }, 'water poured');
    // Water levels (spec 18.1): 0 = source, 1..7 flowing, read from the voxel's variant bits; null = no water.
    const levels = (c) => d.hw((c) => {
      const w = window.__hw.app.game.state.world;
      const at = (x, y, z) => (window.__hw.getBlock(x, y, z).block === 'water' ? (w.getVoxel(x, y, z) >> 13) & 7 : null);
      return [at(c.x, c.y, c.z), at(c.x + 1, c.y, c.z), at(c.x - 1, c.y, c.z), at(c.x, c.y, c.z + 1), at(c.x, c.y, c.z - 1)];
    }, c);
    await d.hw(() => window.__hw.tick(40));
    const spread = await levels(source);
    assert(spread[0] === 0, `the poured block is a source: ${JSON.stringify(spread)}`);
    assert(spread.slice(1).some((l) => l !== null && l > 0), `the water flowed out: ${JSON.stringify(spread)}`);
    await d.settle(600);
    await d.shot('29-water-flows');
    // The empty bucket aims through the flowing water at the source and takes it.
    await d.selectItem('pail');
    await d.hw((c) => window.__hw.lookAt(c.x, c.y, c.z), source);
    await waitFor(page, (c) => {
      const t = window.__hw.state().target;
      return t && t.x === c.x && t.y === c.y && t.z === c.z;
    }, 'aim at the source', { timeout: 3000, interval: 100, arg: source });
    await useUntil(d, { fn: () => window.__hw.state().inventory.some((s) => s.item === 'water_pail'), arg: null }, 'the source taken');
    await d.hw(() => window.__hw.tick(80));
    const dry = await levels(source);
    assert(dry.every((l) => l === null), `the puddle drained: ${JSON.stringify(dry)}`);
    await d.settle(600);
    await d.shot('30-water-drained');
  });

  await step('weather switched to rain shows rain falling', async () => {
    const open = await goToOpenGround(d);
    assert(open, 'no open ground near the player');
    await d.hw((o) => {
      const hw = window.__hw;
      hw.setTime(0.3);
      hw.setWeather('rain');
      hw.look(o.yaw, 0.08);
    }, open);
    const w = await waitFor(page, () => {
      const s = window.__hw.state();
      return s.weather.kind === 'rain' && s.weather.intensity > 0.3 && s.render.precipitation > 50 ? s : null;
    }, 'rain to fall', { timeout: 15_000, interval: 250 });
    assert(w.weather.precipitation === 'rain', `precipitation ${w.weather.precipitation}`);
    await d.settle(800);
    await d.shot('29-rain');
    const frame = await d.hw(() => window.__hw.sampleFrame());
    assert(frame.distinctColors > 40, `the rainy frame is flat: ${JSON.stringify(frame)}`);
  });
}
