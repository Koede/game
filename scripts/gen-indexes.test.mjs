import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from './gen-indexes.mjs';

describe('gen-indexes', () => {
  it('lists the files of an area folder alphabetically, ignores tests and _files, and reports staleness in --check', () => {
    const root = mkdtempSync(join(tmpdir(), 'hw-gen-'));
    try {
      const dir = join(root, 'src/content/areas');
      mkdirSync(dir, { recursive: true });
      for (const f of ['zeta.ts', 'alpha.ts', 'alpha.test.ts', '_draft.ts']) writeFileSync(join(dir, f), 'export default {};\n');
      expect(generate({ root, check: true }).length).toBe(2);
      expect(generate({ root })).toEqual([]);
      const out = readFileSync(join(root, 'src/content/_generated/areas.ts'), 'utf8');
      expect(out).toContain("import area_alpha from '../areas/alpha'");
      expect(out).toContain('= [area_alpha, area_zeta]');
      expect(out).not.toContain('_draft');
      expect(generate({ root, check: true })).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
