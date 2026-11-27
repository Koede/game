import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { LIKES, REWARDS } from './friendship';

describe('friendship data uses real items', () => {
  it('every liked item exists', () => {
    for (const [who, list] of Object.entries(LIKES)) for (const k of list) expect(itemOrNull(k), `${who} likes ${k}`).toBeTruthy();
  });
  it('every reward item exists', () => {
    for (const [who, list] of Object.entries(REWARDS)) for (const r of list) if (r) expect(itemOrNull(r.item), `${who} pays ${r.item}`).toBeTruthy();
  });
});
