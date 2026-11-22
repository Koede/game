/**
 * Ages by NAME (docs/OVERHAUL_PLAN.md C / B.11). Magic and workshop content name their age; this one table turns a name
 * into the index used by `ItemSpec.age` today. BRONZE_PLAN W0 (the six-age renumbering) edited AGE_INDEX: the six ages are ember 0, bronze 1, forge 2, current 3,
 * atomic 4, star 5 (the index is also the furnace tier minus one).
 */
export type AgeName = 'ember' | 'bronze' | 'forge' | 'current' | 'atomic' | 'star';

export const AGE_INDEX: Record<AgeName, number> = { ember: 0, bronze: 1, forge: 2, current: 3, atomic: 4, star: 5 };

export const ageIndexOf = (name: AgeName): number => AGE_INDEX[name];
