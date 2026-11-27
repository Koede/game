import { describe, expect, it } from 'vitest';
import { NOTEBOOK_CSS } from './notebookScreen';

describe('Field Notebook styles', () => {
  it('scale text with the text-size setting', () => {
    expect(NOTEBOOK_CSS).not.toMatch(/font-size:\d/);
    expect(NOTEBOOK_CSS).toContain('var(--hw-text-scale,1)');
  });
  it('take the done and warning colours from the colour-blind-aware tokens', () => {
    expect(NOTEBOOK_CSS).toContain('var(--hw-good,');
    expect(NOTEBOOK_CSS).not.toContain('#5cc060;');
  });
});
