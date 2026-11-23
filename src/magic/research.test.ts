import { describe, expect, it } from 'vitest';
import { ITEMS, BLOCKS, recipe } from '../core/registry';
import { ASPECT_LIST, linkable, type Aspect } from './aspects';
import { boardSolved, cellCount, corner, hexCell, neighbours, solveBoard, type BoardSpec } from './board';
import { RESEARCH } from './entries';
import { aspectsOf } from './fingerprint';
import { craftGateReason, RESEARCH_GATES } from './gates';
import { ageIndexOf } from './ageMap';
import { ALCHEMY, arcaneRecipe, infusionRecipe } from '../content/recipesMagic';
import { beginResearch, combineAspects, entryStatus, freshResearch, hintFor, isDone, placeToken, removeToken, sanitizeResearch, scanObject, unlockedRecipes } from './research';
import { researchEntry } from './entries';

describe('board', () => {
  // radius 2: anchors at the left and right corners, three cells between them along the middle row
  const R = 2;
  const spec: BoardSpec = { radius: R, anchors: [{ cell: corner(R, 0), aspect: 'cinder' }, { cell: corner(R, 3), aspect: 'rift' }] };
  const mid = (q: number): number => hexCell(R, q, 0);
  it('is a hexagon whose cells have up to six neighbours', () => {
    expect(cellCount(2)).toBe(19);
    expect(cellCount(3)).toBe(37);
    expect(neighbours(spec, hexCell(R, 0, 0))).toHaveLength(6);
    expect(neighbours(spec, corner(R, 0))).toHaveLength(3);
  });
  it('links only a compound and its parts, never an aspect to itself (Thaumcraft)', () => {
    expect(linkable('cinder', 'ash')).toBe(true);
    expect(linkable('ash', 'rift')).toBe(true);
    expect(linkable('cinder', 'cinder')).toBe(false);
    expect(linkable('cinder', 'brook')).toBe(false);
  });
  it('is solved only through linked neighbours', () => {
    expect(boardSolved(spec, {})).toBe(false);
    const row = { [mid(-1)]: 'ash', [mid(0)]: 'rift', [mid(1)]: 'ash' } as Record<number, Aspect>;
    expect(boardSolved(spec, row)).toBe(true);
    expect(boardSolved(spec, { ...row, [mid(0)]: 'glow' })).toBe(false);
    expect(boardSolved(spec, { [mid(-1)]: 'cinder', [mid(0)]: 'ash', [mid(1)]: 'rift' })).toBe(false); // cinder next to cinder does not link
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
    for (const id of RESEARCH_GATES.keys()) expect(recipe(id) ?? arcaneRecipe(id) ?? infusionRecipe(id) ?? ALCHEMY.find((r) => r.id === id) ?? null, id).not.toBeNull();
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
  it('starting notes costs anchor lore; writing spends lore, erasing gives none back; solving unlocks the vial recipe', () => {
    const s = freshResearch();
    scanObject(s, 'glass', aspectsOf('glass'));
    expect(craftGateReason(s, 'glass_vial')).toMatch(/Research/);
    s.known.push('rune', 'brook', 'cinder');
    s.lore = { clarity: 1, rune: 9, craft: 1, brook: 9, cinder: 9 };
    const free = researchEntry('glassware')!.board!;
    const someCell = [...Array(cellCount(free.radius)).keys()].find((c) => !free.anchors.some((a) => a.cell === c))!;
    expect(placeToken(s, 'glassware', someCell, 'rune').ok).toBe(false); // notes not started
    expect(entryStatus(s, researchEntry('glassware')!)).toBe('open');
    expect(beginResearch(s, 'glassware').ok).toBe(true);
    expect(s.lore.clarity).toBe(0);
    expect(s.lore.craft).toBe(0);
    expect(entryStatus(s, researchEntry('glassware')!)).toBe('begun');
    expect(placeToken(s, 'glassware', someCell, 'rune').ok).toBe(true);
    expect(s.lore.rune).toBe(8);
    expect(removeToken(s, 'glassware', someCell)).toBe(true);
    expect(s.lore.rune).toBe(8);
    for (let i = 0; i < 30 && !isDone(s, 'glassware'); i++) {
      const h = hintFor(s, 'glassware')!;
      s.lore[h.aspect] = (s.lore[h.aspect] ?? 0) + 1;
      expect(placeToken(s, 'glassware', h.cell, h.aspect).ok).toBe(true);
    }
    expect(isDone(s, 'glassware')).toBe(true);
    expect(unlockedRecipes(s).has('glass_vial')).toBe(true);
    expect(craftGateReason(s, 'glass_vial')).toBeNull();
    expect(craftGateReason(s, 'plank')).toBeNull();
  });
  it('starting notes needs the lore, and two aspects combine into their compound', () => {
    const s = freshResearch();
    scanObject(s, 'glass', aspectsOf('glass'));
    s.lore = { clarity: 1 };
    expect(beginResearch(s, 'glassware').reason).toMatch(/Craft/);
    s.lore = { cinder: 1, gale: 1 };
    s.known.push('cinder', 'gale');
    const r = combineAspects(s, 'cinder', 'gale');
    expect(r.made).toBe('glow');
    expect(s.lore).toEqual({ cinder: 0, gale: 0, glow: 1 });
    expect(s.known).toContain('glow');
    expect(combineAspects(s, 'cinder', 'gale').ok).toBe(false);
    expect(combineAspects(s, 'glow', 'brook').ok).toBe(false);
  });
  it('refuses unknown aspects, fixed cells and locked entries', () => {
    const s = freshResearch();
    s.lore = { rift: 5 };
    const g = researchEntry('glassware')!.board!;
    expect(placeToken(s, 'gathering_rod', hexCell(g.radius, 0, 0), 'spring').ok).toBe(false);
    scanObject(s, 'stick', aspectsOf('stick'));
    s.entries.glassware = { done: false, begun: true, tokens: {} };
    expect(placeToken(s, 'glassware', g.anchors[0].cell, 'craft').ok).toBe(false);
    expect(placeToken(s, 'glassware', hexCell(g.radius, 0, 0), 'rift').ok).toBe(false);
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
    // a v1 save: learned research stays learned, half-written 5 x 5 boards are cleared
    const old = sanitizeResearch({ v: 1, entries: { glassware: { done: true, tokens: {} }, essence_jar: { done: false, tokens: { 6: 'rune' } } } });
    expect(old.entries.glassware.done).toBe(true);
    expect(old.entries.essence_jar).toEqual({ done: false, tokens: {} });
  });
});
