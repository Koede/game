import { describe, expect, it } from 'vitest';
import { block, item } from '../core/registry';
import { useVerb, type UseAim } from './useVerb';

const aim = (over: Partial<UseAim> = {}): UseAim => ({ person: false, block: null, animal: false, held: null, placeArmed: false, ...over });

describe('the Use button caption', () => {
  it('is plain Use at the sky and on a block with empty hands', () => {
    expect(useVerb(aim())).toBe('Use');
    expect(useVerb(aim({ block: block('stone') }))).toBe('Use');
  });

  it('says Open for a station or machine with a screen, and for a door', () => {
    expect(useVerb(aim({ block: block('workbench') }))).toBe('Open');
    expect(useVerb(aim({ block: block('furnace_blast') }))).toBe('Open');
  });

  it('says Talk for a person and stays plain for an animal', () => {
    expect(useVerb(aim({ person: true }))).toBe('Talk');
    expect(useVerb(aim({ animal: true }))).toBe('Use');
  });

  it('says Eat for held food, unless a screen block is aimed at', () => {
    expect(useVerb(aim({ held: item('bread') }))).toBe('Eat');
    expect(useVerb(aim({ held: item('bread'), block: block('stone') }))).toBe('Eat');
    expect(useVerb(aim({ held: item('bread'), block: block('workbench') }))).toBe('Open');
  });

  it('says Place for a held block aimed at a block, and when the Place toggle is armed', () => {
    expect(useVerb(aim({ held: item('plank'), block: block('stone') }))).toBe('Place');
    expect(useVerb(aim({ held: item('plank') }))).toBe('Use');
    expect(useVerb(aim({ held: item('plank'), placeArmed: true }))).toBe('Place');
    expect(useVerb(aim({ held: item('plank'), placeArmed: true, block: block('workbench') }))).toBe('Place');
  });

  it('does not promise Place for a tool, or when Place is armed with nothing placeable', () => {
    expect(useVerb(aim({ held: item('bread'), placeArmed: true }))).toBe('Eat');
  });
});
