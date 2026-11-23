/**
 * Items a living animal gives without dying (milk to a pail or beaker, wool to shears: src/mobs/yields.ts, src/player/animals.ts).
 * The progression solver counts them as sources next to the animal's drops. Data only.
 */
export const ANIMAL_YIELDS: Readonly<Record<string, readonly string[]>> = {
  goat: ['milk_pail', 'milk_beaker', 'wool'],
};
