// Real-input driver for scripts/e2e.mjs: keyboard and mouse on desktop, CDP multi-touch and taps on phones.
// window.__hw is used to aim (look at a block), to find things in the world and to read state back.
import { waitFor } from './browser.mjs';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export class Driver {
  constructor(page, device, shot) {
    this.page = page;
    this.device = device;
    this.touch = device !== 'desktop';
    this.shot = shot;
    this.places = {};
    this.points = new Map();
    this.cdp = null;
  }

  get size() {
    return this.page.viewportSize();
  }

  hw(fn, arg) {
    return this.page.evaluate(fn, arg);
  }

  state() {
    return this.hw(() => window.__hw.state());
  }

  async inventory() {
    const counts = {};
    for (const s of (await this.state()).inventory) counts[s.item] = (counts[s.item] ?? 0) + s.count;
    return counts;
  }

  /** Lets a few frames render (software WebGL is slow). */
  async settle(ms = 400) {
    await this.page.waitForTimeout(ms);
  }

  /** A click on desktop, a tap on phones. */
  async press(locator) {
    await locator.waitFor({ state: 'visible', timeout: 10_000 });
    if (this.touch) await locator.tap();
    else await locator.click();
  }

  // ---- raw multi-touch (CDP), like real fingers ------------------------------------------------------------------

  async touchEvent(type) {
    this.cdp ??= await this.page.context().newCDPSession(this.page);
    await this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...this.points.values()] });
  }

  async fingerDown(id, x, y) {
    this.points.set(id, { x, y, id, radiusX: 8, radiusY: 8, force: 1 });
    await this.touchEvent('touchStart');
  }

  async fingerMove(id, x, y) {
    this.points.set(id, { ...this.points.get(id), x, y });
    await this.touchEvent('touchMove');
  }

  async fingerUp(id) {
    this.points.delete(id);
    await this.touchEvent('touchEnd');
  }

  /** Centre of an element, for fingers. */
  async centerOf(selector) {
    const box = await this.page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`${selector} is not on screen`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  /** A point on the open world (not on a control or the HUD): taps there use, holds there mine. */
  worldPoint() {
    const { width, height } = this.size;
    return { x: Math.round(width * 0.62), y: Math.round(height * 0.42) };
  }

  // ---- movement --------------------------------------------------------------------------------------------------

  async walk(seconds) {
    if (!this.touch) {
      await this.page.keyboard.down('KeyW');
      await this.settle(seconds * 1000);
      await this.page.keyboard.up('KeyW');
      return;
    }
    const { height } = this.size;
    // Lower-left thumb zone, clear of the hotbar (full width at the bottom in portrait).
    const x = 90;
    const y = this.device === 'phonePortrait' ? height - 170 : height - 70;
    await this.fingerDown(1, x, y);
    for (let i = 1; i <= 6; i++) {
      await this.fingerMove(1, x, y - i * 12);
      await sleep(30);
    }
    await this.shot('02b-joystick');
    await this.settle(seconds * 1000);
    await this.fingerUp(1);
  }

  // ---- mining ----------------------------------------------------------------------------------------------------

  /** Holds the mine control until `done()` (run in node) is true, or the timeout. Returns whether it finished. */
  async holdMine(done, timeoutMs = 20_000) {
    const started = Date.now();
    let attempts = 0;
    while (Date.now() - started < timeoutMs) {
      attempts++;
      await this.mineDown();
      const pressStarted = Date.now();
      let progressed = false;
      while (Date.now() - started < timeoutMs) {
        if (await done()) {
          await this.mineUp();
          return true;
        }
        const s = await this.state();
        if (s.target && s.target.mining > 0) progressed = true;
        // A press that captured the pointer (desktop) does not mine: let go and hold again.
        if (!progressed && Date.now() - pressStarted > 2500 && attempts < 3) break;
        await sleep(150);
      }
      await this.mineUp();
      await sleep(150);
    }
    return false;
  }

  async mineDown() {
    if (!this.touch) {
      const { width, height } = this.size;
      await this.page.mouse.move(width / 2, height / 2);
      await this.page.mouse.down({ button: 'left' });
    } else if (this.device === 'phoneLandscape') {
      const c = await this.centerOf('[data-hw-touch="mine"]');
      await this.fingerDown(2, c.x, c.y);
    } else {
      const p = this.worldPoint();
      await this.fingerDown(2, p.x, p.y);
    }
  }

  async mineUp() {
    if (!this.touch) await this.page.mouse.up({ button: 'left' });
    else if (this.points.has(2)) await this.fingerUp(2);
  }

  /** Use / place at the crosshair: right click, a tap on the world (portrait) or the Use button (landscape). */
  async use() {
    if (!this.touch) {
      const { width, height } = this.size;
      await this.page.mouse.click(width / 2, height / 2, { button: 'right' });
    } else if (this.device === 'phoneLandscape') {
      await this.press(this.page.locator('[data-hw-touch="use"]'));
    } else {
      const p = this.worldPoint();
      await this.fingerDown(3, p.x, p.y);
      await sleep(60);
      await this.fingerUp(3);
    }
  }

  /** Aims at a block and waits until the controller targets exactly it. False when something else is in the way. */
  async aimAt(pos) {
    await this.hw((p) => window.__hw.lookAt(p.x, p.y, p.z), pos);
    try {
      await waitFor(this.page, (p) => {
        const t = window.__hw.state().target;
        return t && t.x === p.x && t.y === p.y && t.z === p.z;
      }, `aim at ${JSON.stringify(pos)}`, { timeout: 3000, interval: 100, arg: pos });
      return true;
    } catch {
      return false;
    }
  }

  /** A spot to stand on next to `pos`: solid ground, two free cells. Nearest offsets first. */
  async standBeside(pos) {
    return this.hw((p) => {
      const hw = window.__hw;
      const free = (x, y, z) => !hw.getBlock(x, y, z).solid && hw.getBlock(x, y, z).block !== 'water';
      const offsets = [];
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (dx || dz) offsets.push([dx, dz, Math.hypot(dx, dz)]);
      offsets.sort((a, b) => Math.abs(a[2] - 1.6) - Math.abs(b[2] - 1.6));
      for (const [dx, dz] of offsets) {
        for (let y = p.y + 1; y >= p.y - 2; y--) {
          const x = p.x + dx;
          const z = p.z + dz;
          if (hw.getBlock(x, y - 1, z).solid && free(x, y, z) && free(x, y + 1, z)) return { x: x + 0.5, y, z: z + 0.5 };
        }
      }
      return null;
    }, pos);
  }

  /** Mines `count` oak logs with the real mine control. Returns how many broke. */
  async mineLogs(count) {
    let mined = 0;
    const skipped = new Set();
    for (let tries = 0; mined < count && tries < count * 4; tries++) {
      const logs = await this.hw(() => window.__hw.findBlocks('oak_log', 40, 64));
      const candidates = logs.filter((l) => !skipped.has(`${l.x},${l.y},${l.z}`));
      if (!candidates.length) throw new Error('no reachable oak logs near spawn');
      let target = candidates.find((l) => l.d <= 4.2);
      if (!target) {
        // Walk-free setup: stand beside the lowest log of the nearest tree.
        const nearest = candidates[0];
        const trunk = candidates.filter((l) => l.x === nearest.x && l.z === nearest.z).sort((a, b) => a.y - b.y)[0];
        const stand = await this.standBeside(trunk);
        if (!stand) {
          skipped.add(`${trunk.x},${trunk.y},${trunk.z}`);
          continue;
        }
        await this.hw((s) => window.__hw.teleport(s.x, s.y, s.z), stand);
        await this.settle(300);
        target = trunk;
      }
      if (!(await this.aimAt(target))) {
        skipped.add(`${target.x},${target.y},${target.z}`);
        continue;
      }
      if (mined === 0) await this.shot('03a-aim-log');
      const broke = await this.holdMine(async () => (await this.hw((p) => window.__hw.getBlock(p.x, p.y, p.z).block, target)) !== 'oak_log');
      if (broke) mined++;
      else skipped.add(`${target.x},${target.y},${target.z}`);
    }
    return mined;
  }

  // ---- screens ---------------------------------------------------------------------------------------------------

  async waitScreen(type) {
    await waitFor(this.page, (t) => window.__hw.state().ui.open === t, `${type} screen`, { timeout: 10_000, interval: 100, arg: type });
    await this.settle(250);
  }

  async openInventory() {
    if (this.touch) await this.press(this.page.locator('[data-hw-touch="bag"]'));
    else await this.page.keyboard.press('KeyE');
    await this.waitScreen('inventory');
  }

  async closeScreen() {
    if (this.touch) await this.press(this.page.locator('.hw-window button[aria-label="Close"]').first());
    else await this.page.keyboard.press('Escape');
    await waitFor(this.page, () => !window.__hw.state().ui.uiOpen, 'screen closed', { timeout: 10_000, interval: 100 });
    await this.settle(200);
  }

  async pause() {
    if (this.touch) await this.press(this.page.locator('[data-hw-touch="pause"]'));
    else await this.page.keyboard.press('Escape');
    await waitFor(this.page, () => window.__hw.state().ui.paused, 'pause menu', { timeout: 10_000, interval: 100 });
  }

  /** Presses Make on a recipe row of the open screen and waits for the pack to change. */
  async make(recipeId) {
    const before = JSON.stringify((await this.state()).inventory);
    const button = this.page.locator(`.hw-window .hw-recipe[data-id="${recipeId}"] .hw-recipe__actions button`).last();
    await button.scrollIntoViewIfNeeded();
    await this.press(button);
    await waitFor(this.page, (b) => JSON.stringify(window.__hw.state().inventory) !== b, `Make ${recipeId}`, { timeout: 5000, interval: 100, arg: before });
  }

  /** Opens the screen of a station / machine block by aiming at it and pressing Use. */
  async useBlock(pos) {
    if (!(await this.aimAt(pos))) {
      const stand = await this.standBeside(pos);
      if (stand) await this.hw((s) => window.__hw.teleport(s.x, s.y, s.z), stand);
      if (!(await this.aimAt(pos))) throw new Error(`cannot aim at ${JSON.stringify(pos)}`);
    }
    // Software-rendered frames can take a few hundred ms; a tap that spans such a hitch reads as a press-and-hold
    // (exactly as it would on a stalling phone). Tap once more in that case.
    for (let attempt = 0; ; attempt++) {
      await this.use();
      try {
        await waitFor(this.page, () => window.__hw.state().ui.uiOpen, 'a screen to open', { timeout: 5000, interval: 100 });
        break;
      } catch (err) {
        if (attempt >= 1) throw err;
        console.log('       (use did not open a screen; tapping again)');
        await this.aimAt(pos);
      }
    }
    await this.settle(300);
  }

  /** Selects the hotbar slot holding `item` with the real control (number key or tap). */
  async selectItem(item) {
    const slot = (await this.state()).inventory.find((s) => s.item === item && s.slot < 9)?.slot;
    if (slot === undefined) throw new Error(`${item} is not on the hotbar`);
    if (this.touch) await this.press(this.page.locator('.hw-hotbar .hw-slot').nth(slot));
    else await this.page.keyboard.press(`Digit${slot + 1}`);
    await waitFor(this.page, (s) => window.__hw.state().player.selectedSlot === s, 'hotbar selection', { timeout: 5000, interval: 100, arg: slot });
  }

  /**
   * Places the held block item on flat ground 2-3 blocks from the player, away from `avoid`.
   * Returns the placed cell or null.
   */
  async placeHeld(item, avoid = null) {
    await this.selectItem(item);
    const spots = await this.hw(({ avoid }) => {
      const hw = window.__hw;
      const p = hw.state().player;
      const fx = Math.floor(p.x);
      const fy = Math.floor(p.y);
      const fz = Math.floor(p.z);
      const out = [];
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const r = Math.hypot(dx, dz);
          if (r < 1.9 || r > 3.2) continue;
          const x = fx + dx;
          const z = fz + dz;
          if (avoid && Math.max(Math.abs(x - avoid.x), Math.abs(z - avoid.z)) < 2) continue;
          for (let y = fy; y >= fy - 1; y--) {
            const ground = hw.getBlock(x, y - 1, z);
            const cell = hw.getBlock(x, y, z);
            const above = hw.getBlock(x, y + 1, z);
            const open = (b) => b.block === 'air' || (b.replaceable && b.block !== 'water' && b.block !== 'lava');
            if (ground.solid && !ground.replaceable && open(cell) && open(above)) {
              out.push({ ground: { x, y: y - 1, z }, cell: { x, y, z }, r, replace: cell.block !== 'air' });
              break;
            }
          }
        }
      }
      return out.sort((a, b) => a.r - b.r);
    }, { avoid });
    const blockKey = item;
    for (const spot of spots) {
      const aimAt = spot.replace ? spot.cell : spot.ground;
      if (!(await this.aimAt(aimAt))) continue;
      await this.use();
      try {
        await waitFor(this.page, ({ c, k }) => window.__hw.getBlock(c.x, c.y, c.z).block === k, `${item} placed`, { timeout: 4000, interval: 100, arg: { c: spot.cell, k: blockKey } });
        await this.settle(300);
        return spot.cell;
      } catch {
        // Something refused (a plant in the way, the player's box): try the next spot.
      }
    }
    return null;
  }
}
