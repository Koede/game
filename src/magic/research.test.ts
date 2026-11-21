import { describe, expect, it } from 'vitest';
import { ITEMS, BLOCKS, recipe } from '../core/registry';
import { ASPECT_LIST, type Aspect } from './aspects';
import { boardSolved, cellAt, solveBoard, type BoardSpec } from './board';
import { RESEARCH } from './entries';
import { aspectsOf } from './fingerprint';
import { craftGateReason, RESEARCH_GATES } from './gates';
import { ageIndexOf } from './ageMap';
import { arcaneRecipe, infusionRecipe } from '../content/recipesMagic';
import { freshResearch, hintFor, isDone, placeToken, removeToken, sanitizeResearch, scanObject, unlockedRecipes } from './research';

describe('board', () => {
  const spec: BoardSpec = { anchors: [{ cell: cellAt(0, 2), aspect: 'cinder' }, { cell: cellAt(4, 2), aspect: 'rift' }] };
  it('is solved only through kin links', () => {
    expect(boardSolved(spec, {})).toBe(false);
    const row = { [cellAt(1, 2)]: 'cinder', [cellAt(2, 2)]: 'ash', [cellAt(3, 2)]: 'rift' } as Record<number, Aspect>;
    expect(boardSolved(spec, row)).toBe(true);
    expect(boardSolved(spec, { ...row, [cellAt(2, 2)]: 'glow' })).toBe(false);
  });
  it('the solver finds a valid answer or proves there is none', () => {
    const sol = solveBoard(spec, ASPECT_LIST)!;
    expect(boardSolved(spec, sol)).toBe(true);
    expect(solveBoard(spec, ['cinder', 'rift'])).toBeNull();
  });
});

describe('research entries', () => {
  const objectsUpTo = (age: number): string[] =>
    [...new Set([...ITEMS.filter((i) => i.age <= age).map((i) => i.key), ...BLOCKS.map((b) => b.key)])];
  it('every board can be solved with aspects of objects from its own age', () => {
    for (const e of RESEARCH) {
      if (!e.board) continue;
      const aspects = new Set<Aspect>();
      for (const k of objectsUpTo(ageIndexOf(e.age))) for (const a of Object.keys(aspectsOf(k))) aspects.add(a as Aspect);
      expect(solveBoard(e.board, [...aspects]), e.key).not.toBeNull();
    }
  });
  it('requires only earlier entries, and every gated recipe exists', () => {
    const seen = new Set<string>();
    for (const e of RESEARCH) {
      for (const r of e.requires) expect(seen.has(r), `${e.key} needs ${r}`).toBe(true);
      seen.add(e.key);
    }
    for (const id of RESEARCH_GATES.keys()) expect(recipe(id) ?? arcaneRecipe(id) ?? infusionRecipe(id), id).not.toBeNull();
  });
});

describe('research state', () => {
  it('scanning teaches aspects, gives lore once, and finishes the opening note', () => {
    const s = freshResearch();
    const r = scanObject(s, 'glass', aspectsOf('glass'));
    expect(r.first).toBe(true);
    expect(s.known).toContain('clarity');
    expect(s.lore.clarity).toBeGreaterThan(0);
    expect(r.finished).toContain('field_notes');
    expect(scanObject(s, 'glass', aspectsOf('glass')).first).toBe(false);
  });
  it('placing tokens spends lore, removing refunds, solving unlocks the vial recipe', () => {
    const s = freshResearch();
    scanObject(s, 'glass', aspectsOf('glass'));
    expect(craftGateReason(s, 'glass_vial')).toMatch(/Research/);
    s.known.push('rune');
    s.lore = { clarity: 3, rune: 3, craft: 3 };
    expect(placeToken(s, 'glassware', cellAt(1, 2), 'clarity').ok).toBe(true);
    expect(s.lore.clarity).toBe(2);
    expect(removeToken(s, 'glassware', cellAt(1, 2))).toBe(true);
    expect(s.lore.clarity).toBe(3);
    // Follow the hints to the end.
    for (let i = 0; i < 10 && !isDone(s, 'glassware'); i++) {
      const h = hintFor(s, 'glassware')!;
      expect(placeToken(s, 'glassware', h.cell, h.aspect).ok).toBe(true);
    }
    expect(isDone(s, 'glassware')).toBe(true);
    expect(unlockedRecipes(s).has('glass_vial')).toBe(true);
    expect(craftGateReason(s, 'glass_vial')).toBeNull();
    expect(craftGateReason(s, 'plank')).toBeNull();
  });
  it('refuses unknown aspects, fixed cells and locked entries', () => {
    const s = freshResearch();
    s.lore = { rift: 5 };
    expect(placeToken(s, 'gathering_rod', cellAt(1, 2), 'spring').ok).toBe(false);
    scanObject(s, 'stick', aspectsOf('stick'));
    expect(placeToken(s, 'glassware', cellAt(0, 2), 'craft').ok).toBe(false);
    expect(placeToken(s, 'glassware', cellAt(1, 2), 'rift').ok).toBe(false);
  });
  it('round-trips through JSON and repairs junk', () => {
    const s = freshResearch();
    scanObject(s, 'copper_ore', aspectsOf('copper_ore'));
    s.entries.glassware = { done: true, tokens: { 6: 'rune' } };
    expect(sanitizeResearch(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const junk = sanitizeResearch({ known: ['nope', 'cinder'], lore: { cinder: -3, rune: 2.7 }, entries: { bogus: {}, glassware: { tokens: { 3: 'x' } } } });
    expect(junk.known).toContain('cinder');
    expect(junk.lore).toEqual({ rune: 2 });
    expect(Object.keys(junk.entries)).toEqual(['glassware']);
    expect(sanitizeResearch(null)).toEqual(freshResearch());
  });
});
