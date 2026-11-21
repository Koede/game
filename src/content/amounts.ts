import type { ItemAmount } from '../core/types';

/**
 * Ingredient lists are written the way the design document writes them: "3 copper_ingot, 1 tin_ingot".
 * A bare key means one. Unknown keys are caught by `validateContent()`, malformed text throws right here.
 */
export function amounts(text: string): ItemAmount[] {
  return text.split(',').map((part) => {
    const match = /^\s*(?:(\d+)\s+)?([a-z][a-z0-9_]*)\s*$/.exec(part);
    if (!match) throw new Error(`content: cannot read ingredient "${part.trim()}" in "${text}"`);
    return { item: match[2], count: match[1] ? Number(match[1]) : 1 };
  });
}

/** A single stack, e.g. `amount('4 plank')`. */
export function amount(text: string): ItemAmount {
  const list = amounts(text);
  if (list.length !== 1) throw new Error(`content: expected one item in "${text}"`);
  return list[0];
}
