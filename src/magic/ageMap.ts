/**
 * Ages by NAME (docs/OVERHAUL_PLAN.md C / B.11). Magic and workshop content name their age; this one table turns a name
 * into the index used by `ItemSpec.age` today. BRONZE_PLAN W0 (the six-age renumbering) only edits AGE_INDEX.
 * Today the code has five ages: ember, forge, current, atomic, star; 'bronze' maps to the Ember index until W0 runs.
 */
export type AgeName = 'ember' | 'bronze' | 'forge' | 'current' | 'atomic' | 'star';

export const AGE_INDEX: Record<AgeName, number> = { ember: 0, bronze: 0, forge: 1, current: 2, atomic: 3, star: 4 };

export const ageIndexOf = (name: AgeName): number => AGE_INDEX[name];
