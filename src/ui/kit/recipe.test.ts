import { describe, expect, it } from 'vitest';
import { batchNote } from './recipe';

describe('batch button note', () => {
  const planks = { name: 'Plank', count: 4, ingredients: [{ item: 'oak_log', name: 'Oak Log', have: 4, need: 1 }] };

  it('says what a batch makes and uses', () => {
    expect(batchNote(planks, 4).full).toBe('Make 4 times: 16 Plank, uses 4 Oak Log');
  });

  it('warns inside the button only when the batch uses up an ingredient', () => {
    expect(batchNote(planks, 4).hint).toBe('all 4 Oak Log');
    expect(batchNote({ ...planks, ingredients: [{ ...planks.ingredients[0], have: 9 }] }, 4).hint).toBe('');
  });
});
