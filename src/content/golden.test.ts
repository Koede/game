import { describe, expect, it } from 'vitest';
import golden from '../../tests/golden/content.json';
import { contentSnapshot, type ContentGolden } from './goldenSnapshot';

/**
 * Existing content may not change or vanish unnoticed: a deliberate balance change is `npm run golden:update` and a
 * reviewed diff of tests/golden/content.json. New entries pass and are listed below.
 */
describe('content golden snapshot', () => {
  const now = contentSnapshot();
  for (const section of Object.keys(golden) as (keyof ContentGolden)[]) {
    it(`${section}: nothing existing changed or disappeared`, () => {
      const was = golden[section] as Record<string, unknown>;
      const cur = now[section];
      const gone = Object.keys(was).filter((k) => !(k in cur));
      expect(gone, `${section} deleted (keys are permanent; alias or keep them)`).toEqual([]);
      const changed = Object.keys(was).filter((k) => JSON.stringify(was[k]) !== JSON.stringify(cur[k]));
      expect(changed.map((k) => ({ key: k, was: was[k], now: cur[k] })), `${section} changed - run npm run golden:update and review the diff`).toEqual([]);
      const added = Object.keys(cur).filter((k) => !(k in was));
      if (added.length) console.info(`golden: ${added.length} new ${section}: ${added.slice(0, 12).join(', ')}${added.length > 12 ? ', ...' : ''}`);
    });
  }
});
