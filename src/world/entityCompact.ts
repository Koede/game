/**
 * Saved block entities without the fields that hold their starting value. A crate holds 27 slots and a dozen counters
 * that are almost always empty or zero; saved in full that is ~330 bytes for a crate with two stacks. Machine entities
 * (everything with a `slots` array except furnaces) are written without the keys in MACHINE_DEFAULTS that still equal
 * their default, with the empty tail of `slots` cut off (`sn` keeps the length), and carry `_z: 1`. Loading puts the
 * defaults back, so an entity saved in full (an older save) loads as it always did. Pure data, no imports.
 */
type Rec = Record<string, unknown>;

/** What `createMachine` (src/sim/entities.ts) starts every field at; entityCompact.test.ts keeps the two equal. `depthY` defaults to `y`. */
export const MACHINE_DEFAULTS: Readonly<Rec> = {
  on: true, progress: 0, recipe: null, fuelJ: 0, storedJ: 0, coreC: 20, hotS: 0, warned: false, alarmS: 0,
  halted: '', fluidIn: null, fluidOut: null, availW: 0, outW: 0, demandW: 0, f: 0,
};

const isCompactable = (e: Rec): boolean => e.kind !== 'furnace' && Array.isArray(e.slots) && e._z === undefined;

/** A smaller copy of one entity (the entity itself when it is not a machine). */
export function compactEntity<T extends object>(entity: T): T {
  const e = entity as unknown as Rec;
  if (!isCompactable(e)) return entity;
  const out: Rec = { _z: 1 };
  for (const [k, v] of Object.entries(e)) {
    if (k === 'slots') continue;
    if (k in MACHINE_DEFAULTS ? MACHINE_DEFAULTS[k] === v : k === 'depthY' && v === e.y) continue;
    out[k] = v;
  }
  const slots = e.slots as unknown[];
  let n = slots.length;
  while (n > 0 && (slots[n - 1] === null || slots[n - 1] === undefined)) n--;
  out.slots = n === slots.length ? slots : slots.slice(0, n);
  if (n !== slots.length) out.sn = slots.length;
  return out as unknown as T;
}

/** Puts the dropped fields back (the entity itself when it was saved in full). */
export function expandEntity<T extends object>(entity: T): T {
  const e = entity as unknown as Rec;
  if (e._z !== 1) return entity;
  const { _z, sn, ...rest } = e;
  void _z;
  const slots = Array.isArray(rest.slots) ? [...(rest.slots as unknown[])] : [];
  if (typeof sn === 'number' && Number.isInteger(sn) && sn > slots.length && sn <= 4096) while (slots.length < sn) slots.push(null);
  return { ...MACHINE_DEFAULTS, depthY: rest.y, ...rest, slots } as unknown as T;
}
