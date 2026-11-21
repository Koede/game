// Shared helpers for browser checks (scripts/e2e.mjs and ad-hoc harnesses).
// Playwright is resolved from wherever it is installed (globally in the dev container, or as a dev dependency).
import { createRequire } from 'node:module';
import { serve } from '../build.mjs';

const require = createRequire(import.meta.url);

export function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    throw new Error('Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium');
  }
}

export const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phonePortrait: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
  phoneLandscape: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
};

/**
 * Serves a built directory (default dist/) and opens it in headless Chromium.
 * `init` (a function) runs in the page before the game's scripts.
 * Returns { page, browser, server, url, errors, close }. `errors` collects page errors and console.error output.
 */
export async function openGame({ dir, device = 'desktop', query = '', log = false, init = null } = {}) {
  const { chromium } = loadPlaywright();
  const server = await serve(0, dir);
  const url = `http://localhost:${server.address().port}/${query}`;
  const browser = await chromium.launch();
  const context = await browser.newContext(VIEWPORTS[device] ?? VIEWPORTS.desktop);
  const page = await context.newPage();
  // `init` runs in the page before any of its scripts (e.g. to make storage throw, like a sandboxed frame).
  if (init) await page.addInitScript(init);
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    if (log) console.log(`[page:${msg.type()}] ${msg.text()}`);
  });
  await page.goto(url);
  const close = async () => {
    await browser.close();
    await new Promise((done) => server.close(done));
  };
  return { page, browser, context, server, url, errors, close };
}

/** Polls `fn` (run in the page) until it returns something truthy; throws with `what` on timeout. */
export async function waitFor(page, fn, what, { timeout = 60_000, interval = 250, arg } = {}) {
  const started = Date.now();
  for (;;) {
    const value = await page.evaluate(fn, arg);
    if (value) return value;
    if (Date.now() - started > timeout) throw new Error(`timed out waiting for ${what}`);
    await page.waitForTimeout(interval);
  }
}

/** Minimal assertion + step reporter so a failing check names the step it failed in. */
export function createReporter() {
  let failures = 0;
  return {
    async step(name, run) {
      const started = Date.now();
      try {
        await run();
        console.log(`  ok   ${name} (${Date.now() - started} ms)`);
      } catch (err) {
        failures++;
        console.log(`  FAIL ${name}: ${err.message}`);
      }
    },
    assert(condition, message) {
      if (!condition) throw new Error(message);
    },
    get failures() {
      return failures;
    },
  };
}
