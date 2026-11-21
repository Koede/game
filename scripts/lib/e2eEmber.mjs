// The Emberbound steps of scripts/e2e-ember.mjs (spec 19) - real input for everything under test: the maul is forged
// at the furnace screen, selected on the hotbar and swung with Mine; the difficulty is changed in the pause menu's
// settings; the death screen is read as the player sees it. window.__hw only sets things up (time of day, a level
// strip of ground, items, the automaton placed near the player, aiming, fast-forwarding the furnace) and reads state.
import { waitFor } from './browser.mjs';
import { openTab, sendFromBag } from './e2eFurnace.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
/** Clay furnace warm zone radius (spec 19.2: its warmth radius), blocks from the furnace block's centre. */
const CLAY_ZONE = 6;
/** Strip of level ground the steps play on: the furnace at 0, the fights beyond its zone. */
const STRIP = 24;

/** Records combat events with the tick they happened in (read back by the steps). */
async function recordEvents(d) {
  await d.hw(() => {
    const g = window.__hw.app.game;
    window.__ember = [];
    const names = ['hostile:windup', 'hostile:attack', 'player:attacked', 'player:damage', 'automaton:salvaged', 'mob:died', 'player:death', 'projectile:fired'];
    for (const n of names) g.bus.on(n, (e) => window.__ember.push({ n, t: g.state.ticks, e: JSON.parse(JSON.stringify(e)) }));
  });
}

const events = (d, name) => d.hw((n) => window.__ember.filter((x) => x.n === n), name);
const clearEvents = (d) => d.hw(() => { window.__ember.length = 0; });

/**
 * Set-up: a level strip of grass 5 wide and STRIP long from a spot near the player in its most open direction, cleared
 * of plants, trees and water up to 5 above (a battlefield the automatons can walk). Returns { x, y, z, dx, dz } (the
 * strip's start cell at feet height and its direction).
 */
async function levelStrip(d) {
  return d.hw((len) => {
    const hw = window.__hw;
    const p = hw.state().player;
    const groundY = (x, z) => {
      let y = hw.surfaceY(x, z);
      while (y > 0 && !hw.getBlock(x, y, z).solid) y--;
      return y;
    };
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let best = null;
    for (let r = 0; r <= 24 && !best; r += 4) {
      for (let a = 0; a < 8 && !best; a++) {
        const sx = Math.floor(p.x + Math.cos((a / 8) * Math.PI * 2) * r);
        const sz = Math.floor(p.z + Math.sin((a / 8) * Math.PI * 2) * r);
        const y0 = groundY(sx, sz);
        if (hw.getBlock(sx, y0, sz).block === 'water' || y0 < 30) continue;
        for (const [dx, dz] of dirs) {
          let rough = 0;
          let wet = false;
          for (let i = 0; i < len; i++) {
            const gy = groundY(sx + dx * i, sz + dz * i);
            rough += Math.abs(gy - y0);
            if (['water', 'lava'].includes(hw.getBlock(sx + dx * i, gy, sz + dz * i).block)) wet = true;
          }
          if (!wet && rough <= len * 0.6) {
            best = { x: sx, y: y0 + 1, z: sz, dx, dz };
            break;
          }
        }
      }
    }
    if (!best) return null;
    const { x, y, z, dx, dz } = best;
    for (let i = -3; i < len + 3; i++) {
      for (let w = -2; w <= 2; w++) {
        const cx = x + dx * i + dz * w;
        const cz = z + dz * i + dx * w;
        for (let yy = y - 3; yy < y - 1; yy++) if (!hw.getBlock(cx, yy, cz).solid) hw.setVoxel(cx, yy, cz, 'dirt');
        hw.setVoxel(cx, y - 1, cz, 'grass');
        for (let yy = y; yy <= y + 5; yy++) if (hw.getBlock(cx, yy, cz).block !== 'air') hw.setVoxel(cx, yy, cz, 'air');
      }
    }
    return best;
  }, STRIP);
}

/** Cell `i` blocks along the strip (feet height). */
const along = (s, i) => ({ x: s.x + s.dx * i, y: s.y, z: s.z + s.dz * i });

/** Points the view at an automaton's body (aiming is set-up; the swing is the real Mine control). */
async function aimAtHostile(d, id) {
  return d.hw((id) => {
    const hw = window.__hw;
    const s = hw.state();
    const m = s.hostiles.find((x) => x.id === id && !x.dying);
    if (!m) return null;
    const p = s.player;
    const dx = m.x - p.x;
    const dz = m.z - p.z;
    const dy = m.y + 0.25 - (p.y + 1.62);
    hw.look(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    return m;
  }, id);
}

/** Puts an automaton at `cell` (feet), returns its id. */
const spawn = (d, species, cell) => d.hw(({ species, c }) => window.__hw.spawnMob(species, c.x + 0.5, c.y, c.z + 0.5), { species, c: cell });

/** Stands the player at `cell` looking down the strip towards `dir` (+1 outwards, -1 back to the furnace). */
async function standAt(d, s, cell, dir = 1) {
  await d.hw(({ c, yaw }) => {
    window.__hw.teleport(c.x + 0.5, c.y, c.z + 0.5);
    window.__hw.look(yaw, -0.05);
  }, { c: cell, yaw: Math.atan2(-s.dx * dir, -s.dz * dir) });
  await d.settle(300);
}

/** Changes the difficulty through the real pause menu -> Settings -> Difficulty control. */
async function chooseDifficulty(d, value) {
  await d.pause();
  await d.press(d.page.locator('.hw-window button', { hasText: 'Settings' }).first());
  const option = d.page.locator(`.hw-window .hw-seg__opt[data-value="${value}"]`).first();
  await option.scrollIntoViewIfNeeded();
  await d.press(option);
  await waitFor(d.page, (v) => window.__hw.state().combat.difficulty === v, `difficulty ${value}`, { timeout: 5000, interval: 100, arg: value });
  await d.settle(300);
  await d.shot(`difficulty-${value}`);
  // Back to the menu, then resume.
  if (d.touch) {
    await d.press(d.page.locator('.hw-window button[aria-label="Back"], .hw-window button', { hasText: 'Back' }).first());
    await d.press(d.page.locator('.hw-window button', { hasText: 'Resume' }).first());
  } else {
    await d.page.keyboard.press('Escape');
    if ((await d.state()).ui.paused) await d.press(d.page.locator('.hw-window button', { hasText: 'Resume' }).first());
  }
  await waitFor(d.page, () => !window.__hw.state().ui.paused, 'resumed', { timeout: 5000, interval: 100 });
}

/**
 * Swings the selected weapon with the real Mine control at automaton `id` until it breaks apart (aim follows it).
 * Returns the number of swings that landed.
 */
async function fight(d, id, timeoutTicks = 900) {
  // Game ticks, not wall time (slow software rendering stretches a second): 900 ticks = 45 game seconds, wall cap 3 min.
  const started = Date.now();
  const t0 = (await d.state()).ticks;
  let landed = 0;
  let last = Infinity;
  let down = false;
  let downAt = 0;
  while (Date.now() - started < 180_000 && (await d.state()).ticks - t0 < timeoutTicks) {
    const m = await aimAtHostile(d, id);
    if (!m) break;
    if (m.health < last) {
      if (last !== Infinity) landed++;
      last = m.health;
      downAt = Date.now();
    }
    const targeted = (await d.state()).targetAnimal?.id === id;
    // A press that only captured the pointer (desktop) swings nothing: let go and press again.
    if ((targeted && !down) || (down && Date.now() - downAt > 2500)) {
      if (down) {
        await d.mineUp();
        await sleep(120);
      }
      await d.mineDown();
      down = true;
      downAt = Date.now();
    } else if (!targeted && down) {
      await d.mineUp();
      down = false;
    }
    await sleep(100);
  }
  if (down) await d.mineUp();
  const gone = !(await d.state()).hostiles.some((x) => x.id === id && !x.dying);
  return gone ? landed + 1 : -1;
}

export async function emberSteps({ d, step, assert, page }) {
  const ctx = {};

  await step('a level strip at night, a clay furnace placed with Use', async () => {
    await recordEvents(d);
    const s = await levelStrip(d);
    assert(s, 'no ground for the strip near spawn');
    ctx.s = s;
    await d.hw(() => {
      window.__hw.setTime(0.82);
      window.__hw.setWeather('clear');
      window.__hw.clearInventory();
      window.__hw.give('furnace_clay', 1);
      window.__hw.give('charcoal', 12);
      window.__hw.give('bronze_ingot', 4);
      window.__hw.give('stick', 2);
    });
    await standAt(d, s, along(s, 2), -1);
    await d.selectItem('furnace_clay');
    const ground = { ...along(s, 0), y: s.y - 1 };
    // Aim at the middle of the ground block's top face (its centre would be behind the nearer cell's top).
    await d.hw((c) => {
      const hw = window.__hw;
      const p = hw.state().player;
      const dx = c.x + 0.5 - p.x;
      const dz = c.z + 0.5 - p.z;
      hw.look(Math.atan2(-dx, -dz), Math.atan2(c.y + 0.98 - (p.y + 1.62), Math.hypot(dx, dz)));
    }, ground);
    await waitFor(page, (c) => {
      const t = window.__hw.state().target;
      return t && t.x === c.x && t.y === c.y && t.z === c.z;
    }, 'aim at the furnace spot', { timeout: 3000, interval: 100, arg: ground });
    await d.use();
    await waitFor(page, (c) => window.__hw.getBlock(c.x, c.y, c.z).block === 'furnace_clay', 'the furnace placed', { timeout: 5000, interval: 100, arg: along(s, 0) });
    ctx.furnace = along(s, 0);
    const st = await d.state();
    assert(st.time.phase === 'night', `phase ${st.time.phase}`);
  });

  await step('a bronze maul is forged at the furnace screen', async () => {
    await d.useBlock(ctx.furnace);
    await d.waitScreen('furnace');
    await sendFromBag(d, 'charcoal', 'Firebox');
    await d.press(page.locator('.hw-window .hw-fbx__btns button', { hasText: 'Light' }));
    await waitFor(page, () => window.__hw.state().furnaces[0]?.lit, 'the fire to catch', { timeout: 5000, interval: 100 });
    for (let i = 0; i < 40 && (await d.state()).furnaces[0].tempC < 720; i++) await d.hw(() => window.__hw.tick(100));
    const temp = (await d.state()).furnaces[0].tempC;
    assert(temp >= 700, `the furnace only reached ${temp} C`);
    await openTab(d, 'forge');
    await d.make('bronze_maul');
    const inv = await d.inventory();
    assert(inv.bronze_maul === 1, `pack: ${JSON.stringify(inv)}`);
    await d.shot('01-maul-forged');
    await d.closeScreen();
    const zone = await d.hw((c) => window.__hw.isSafe(c.x + 0.5, c.y, c.z + 2.5), ctx.furnace);
    assert(zone, 'the hot furnace makes no safe zone');
  });

  await step('a cinder mite spawned near the player winds up, bites, and the player loses health', async () => {
    const s = ctx.s;
    await standAt(d, s, along(s, 12), 1);
    await clearEvents(d);
    const health0 = (await d.state()).player.health;
    const id = await spawn(d, 'cinder_mite', along(s, 16));
    ctx.mite = id;
    await d.settle(200);
    const windup = await waitFor(page, (id) => window.__ember.find((x) => x.n === 'hostile:windup' && x.e.id === id), 'the mite to wind up', { timeout: 120_000, interval: 50, arg: id });
    await d.shot('02-mite-windup');
    const bite = await waitFor(page, () => window.__ember.find((x) => x.n === 'player:attacked'), 'the bite', { timeout: 60_000, interval: 50 });
    await d.settle(300);
    await d.shot('03-mite-bit');
    const st = await d.state();
    // One read of both lists: the mite keeps biting, and two reads could straddle a tick.
    const both = await d.hw(() => ({
      attacked: window.__ember.filter((x) => x.n === 'player:attacked'),
      damage: window.__ember.filter((x) => x.n === 'player:damage' && x.e.cause === 'automaton'),
    }));
    const damage = both.damage;
    assert(bite.e.species === 'cinder_mite', `attacked by ${bite.e.species}`);
    console.log(JSON.stringify(await d.hw(() => window.__ember.filter((x) => x.n !== 'player:damage').map((x) => [x.n, x.t, x.e.id ?? x.e.species, x.e.attack]))));
    // The bite lands at the end of the wind-up (0.3 s = 6 ticks), never before it.
    assert(bite.t - windup.t >= 5, `bite ${bite.t - windup.t} ticks after the wind-up`);
    assert(damage.length >= 1 && damage[0].e.amount === 1, `damage events ${JSON.stringify(damage.map((x) => x.e))}`);
    assert(st.player.health < health0, `health ${health0} -> ${st.player.health}`);
    // One damage path: every bite announced once and dealt once.
    const attacked = both.attacked;
    assert(attacked.length === damage.length, `${attacked.length} attacks announced, ${damage.length} dealt`);
    console.log(`       wind-up ${bite.t - windup.t} ticks before the bite; health ${health0} -> ${st.player.health}`);
  });

  await step('the forged maul breaks mites apart and salvages scrap', async () => {
    const s = ctx.s;
    await d.selectItem('bronze_maul');
    let kills = 0;
    let id = ctx.mite;
    for (let round = 0; round < 8; round++) {
      if (round > 0) {
        await standAt(d, s, along(s, 12), 1);
        id = await spawn(d, 'cinder_mite', along(s, 15));
        await d.settle(300);
      }
      const swings = await fight(d, id);
      assert(swings > 0, `mite #${id} was not broken apart`);
      kills++;
      if (kills === 1) {
        await d.settle(150);
        await d.shot('04-mite-broken');
      }
      if ((await d.inventory()).scrap_metal) break;
    }
    const salvaged = await events(d, 'automaton:salvaged');
    const inv = await d.inventory();
    const maul = (await d.state()).inventory.find((x) => x.item === 'bronze_maul');
    assert(salvaged.length >= kills, `${salvaged.length} salvage events for ${kills} kills`);
    assert(inv.scrap_metal >= 1, `no scrap after ${kills} mites: ${JSON.stringify(inv)}`);
    assert(maul && maul.durability !== undefined, `maul ${JSON.stringify(maul)}`);
    console.log(`       ${kills} mite(s) broken apart, scrap ${inv.scrap_metal}, maul durability ${maul.durability}`);
  });

  await step("a hot furnace keeps automatons out of its warm zone", async () => {
    const s = ctx.s;
    await standAt(d, s, along(s, 3), 1);
    await clearEvents(d);
    const f = ctx.furnace;
    const fx = f.x + 0.5;
    const fz = f.z + 0.5;
    const id = await spawn(d, 'forge_warden', along(s, 13));
    let nearest = Infinity;
    let chased = false;
    const t0 = (await d.state()).ticks;
    let shot = false;
    while ((await d.state()).ticks - t0 < 200) {
      // Keep the fire going (the furnace must stay hot for the whole check).
      const st = await d.state();
      const m = st.hostiles.find((x) => x.id === id);
      assert(m, 'the warden vanished');
      nearest = Math.min(nearest, Math.hypot(m.x - fx, m.z - fz));
      chased ||= m.mode === 'chase' || m.mode === 'roam';
      if (!shot && Math.hypot(m.x - fx, m.z - fz) < CLAY_ZONE + 2) {
        await d.shot('05-warden-at-the-edge');
        shot = true;
      }
      await sleep(200);
    }
    if (!shot) await d.shot('05-warden-at-the-edge');
    const hurt = (await events(d, 'player:damage')).filter((x) => x.e.cause === 'automaton');
    assert(chased, 'the warden never moved towards the player');
    assert(nearest > CLAY_ZONE - 0.6, `the warden came ${nearest.toFixed(2)} blocks from the furnace (zone ${CLAY_ZONE})`);
    assert(hurt.length === 0, `the player was hurt inside the warm zone: ${JSON.stringify(hurt.map((x) => x.e))}`);
    console.log(`       nearest approach ${nearest.toFixed(2)} blocks from the furnace (zone ${CLAY_ZONE})`);
    ctx.warden = id;
  });

  await step('a death by an automaton is named on the death screen', async () => {
    const s = ctx.s;
    await d.hw(() => window.__hw.clearInventory());
    await standAt(d, s, along(s, 14), -1);
    const h = (await d.state()).player.health;
    await d.hw((n) => window.__hw.damage(n, 'fall'), h - 1);
    await waitFor(page, () => window.__hw.state().player.dead, 'the player to fall', { timeout: 40_000, interval: 100 });
    const respawn = page.locator('.hw-window button', { hasText: 'Respawn' });
    await respawn.waitFor({ state: 'visible', timeout: 10_000 });
    await d.settle(500);
    await d.shot('06-death-screen');
    const st = await d.state();
    const text = await page.locator('.hw-window').first().innerText();
    const names = { forge_warden: 'Forge Warden', cinder_mite: 'Cinder Mite', bellows_hound: 'Bellows Hound', arc_drone: 'Arc Drone', kiln_sentry: 'Kiln Sentry', slag_colossus: 'Slag Colossus' };
    assert(st.combat.deathCause === 'automaton' || st.combat.deathCause === 'ember', `death cause ${st.combat.deathCause}`);
    const name = names[st.combat.killedBy];
    assert(name, `killed by ${st.combat.killedBy}`);
    assert(text.includes(name), `the death screen does not name the ${name}: "${text.replace(/\s+/g, ' ').slice(0, 200)}"`);
    console.log(`       "${text.split('\n').find((l) => l.includes(name))}"`);
    await d.press(respawn);
    await waitFor(page, () => !window.__hw.state().player.dead && !window.__hw.state().ui.uiOpen, 'respawn', { timeout: 10_000 });
  });

  await step('Peaceful (pause menu -> Settings) removes the automatons; Normal again', async () => {
    const s = ctx.s;
    await standAt(d, s, along(s, 10), 1);
    await spawn(d, 'cinder_mite', along(s, 18));
    await spawn(d, 'bellows_hound', along(s, 20));
    await d.settle(400);
    const before = (await d.state()).hostiles.filter((x) => x.role === 'natural' && !x.dying).length;
    assert(before >= 2, `${before} automatons before`);
    await chooseDifficulty(d, 'peaceful');
    await d.settle(600);
    const after = (await d.state()).hostiles.filter((x) => x.role === 'natural' && !x.dying).length;
    assert(after === 0, `${after} automatons left on Peaceful`);
    await d.shot('07-peaceful');
    await chooseDifficulty(d, 'normal');
  });
}
