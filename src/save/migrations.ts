/**
 * World-save migrations, keyed on `WorldSave.rev` (the content/format revision of the world, independent of the
 * envelope version `SAVE_VERSION`, which stays put so an additive change never makes a save "unusable").
 *
 * Rules (docs/lanes/FOUNDATION.md):
 *  - additive change (a new optional key, a new module under `extras`) needs NO migration and NO rev bump;
 *  - a renumbering or reshaping change bumps `SAVE_REV` and appends ONE entry to `MIGRATIONS` (key = the rev it upgrades FROM),
 *    a pure in-place function over the raw world save, with a golden pair in tests/fixtures/saves;
 *  - never edit or remove an old entry: a v1 save must still walk the whole chain.
 * No imports: this file is data and pure functions, safe from anywhere.
 */
type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The revision this build writes. */
export const SAVE_REV = 3;
/** What a world without `rev` is: only builds that wrote envelope v1 (five ages) lacked it, and `migrateSave` stamps those rev 1. */
export const DEFAULT_REV = 2;

/**
 * rev 1 -> 2, the six-age renumbering (BRONZE_PLAN W0): the Bronze Furnace is tier 2 and the age after Ember, so
 * furnace tiers 2-5 become 3-6 and ages 1-4 become 2-5. Block ids do not change (the new furnace block was appended
 * after every older block), research and the pack are untouched, and objectives keep their ids. A save that had
 * already built the Blast Furnace is given the new goal before it (`bronze_furnace`) so its place in the list is the
 * same, and a formed Blast hearth stays formed (its summary moves to tier 3 with its furnace).
 */
export function sixAges(world: Rec): void {
  const bump = (n: unknown): unknown => (isNum(n) && n >= 2 ? n + 1 : n);
  const inner = world.world;
  if (isRecord(inner) && Array.isArray(inner.entities)) {
    for (const e of inner.entities) {
      if (!isRecord(e) || e.kind !== 'furnace') continue;
      e.tier = bump(e.tier);
      e.effTier = bump(e.effTier);
      if (isRecord(e.hearth)) e.hearth.tier = bump(e.hearth.tier);
    }
  }
  const o = world.objectives;
  if (isRecord(o)) {
    const reachedBlast = isRecord(o.peaks) && isNum(o.peaks.tier) && o.peaks.tier >= 2;
    if (isRecord(o.peaks)) o.peaks.tier = bump(o.peaks.tier);
    if (isNum(o.age) && o.age >= 1) o.age += 1; // the ages 1-4 become 2-5; Ember stays 0
    if (Array.isArray(o.completed) && (reachedBlast || o.completed.includes('blast_furnace')) && !o.completed.includes('bronze_furnace')) {
      o.completed.push('bronze_furnace');
    }
  }
}

/**
 * rev 2 -> 3, Forge heavy industry: the Forge Age gained goals before the crusher (iron axles, rolling mill, drop forge,
 * dynamo), and the thermopile, the lamp and their goals (`first_power`, `place_lamp`) moved out of Ember into the Forge Age.
 * Block ids and items did not change, so placed thermopiles and lamps keep working. A save that had already built the
 * crusher is past all of that: the new goals are marked done so its tracker does not walk backwards, and the two moved
 * goals are kept done (they were Ember goals, so anyone that far had finished them).
 */
export function heavyIndustry(world: Rec): void {
  const o = world.objectives;
  if (!isRecord(o) || !Array.isArray(o.completed) || !o.completed.includes('place_crusher')) return;
  for (const id of ['make_iron_axle', 'place_rolling_mill', 'place_drop_forge', 'place_dynamo', 'first_power', 'place_lamp']) {
    if (!o.completed.includes(id)) o.completed.push(id);
  }
}

/** `MIGRATIONS[n]` upgrades a world of rev n to rev n + 1, in place. */
export const MIGRATIONS: Readonly<Record<number, (world: Rec) => void>> = {
  1: sixAges,
  2: heavyIndustry,
};

/** The revision a raw world save claims (see DEFAULT_REV). */
export const revOf = (world: Rec): number => (isNum(world.rev) && world.rev >= 1 ? Math.floor(world.rev) : DEFAULT_REV);

/**
 * Brings a raw world save to SAVE_REV in place (every step in order) and stamps `rev`. Returns 'newer' when the save
 * is from a later build (left untouched), 'ok' otherwise. A throwing step propagates: the caller holds the save.
 */
export function migrateWorld(world: Rec): 'ok' | 'newer' {
  let rev = revOf(world);
  if (rev > SAVE_REV) return 'newer';
  while (rev < SAVE_REV) {
    const step = MIGRATIONS[rev];
    if (!step) throw new Error(`no migration from save rev ${rev}`);
    step(world);
    rev++;
  }
  world.rev = SAVE_REV;
  return 'ok';
}
