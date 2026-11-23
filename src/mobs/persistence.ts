/** The animals' save document (spec 12.5 persistence): every animal plus the spawning state, plain JSON. */
import { MOB_DEATH_S, MOB_STORED_CAP } from '../core/constants';
import { creatureOrNull, itemOrNull } from '../core/registry';
import type { ItemAmount } from '../core/types';
import { createMob } from './mob';
import { columnKey, type Spawner } from './spawner';
import type { Mob, MobsSnapshot, SavedMob } from './types';

export const MOBS_SNAPSHOT_VERSION = 1;

const OFFSET = 0x100000;
const ROW = 0x200000;

/**
 * Snapshot of the animals. A corpse whose drops were already handed out is left out; one still tipping over
 * (drops not yet given) is saved with its drops, so a save taken right after a kill does not lose them.
 */
export function saveMobs(mobs: readonly Mob[], nextId: number, spawner: Spawner): MobsSnapshot {
  const saved: SavedMob[] = [];
  for (const m of mobs) {
    if (m.state === 'dying' && m.pendingDrops === null) continue;
    const r: SavedMob = {
      id: m.id,
      species: m.spec.key,
      x: round(m.x),
      y: round(m.y),
      z: round(m.z),
      yaw: round(m.yaw),
      health: m.health,
      baby: m.baby,
      ageS: round(m.ageS),
      eagerS: round(m.eagerS),
      cooldownS: round(m.cooldownS),
      tame: m.tame,
    };
    if (m.milkS > 0) r.milkS = round(m.milkS);
    if (m.woolS > 0) r.woolS = round(m.woolS);
    if (m.state === 'dying' && m.pendingDrops !== null) {
      r.deadS = round(m.deadS);
      r.drops = m.pendingDrops.map((d) => ({ item: d.item, count: d.count }));
      r.cause = m.deathCause;
    }
    saved.push(r);
  }
  const rolled: number[] = [];
  for (const key of spawner.rolled) rolled.push(Math.floor(key / ROW) - OFFSET, (key % ROW) - OFFSET);
  return { version: MOBS_SNAPSHOT_VERSION, nextId, rolled, guaranteed: spawner.guaranteed, keepAliveS: spawner.keepAliveS, mobs: saved };
}

/** Drops of a saved corpse, keeping only known items with positive whole counts; null when not a corpse. */
function savedDrops(v: unknown): ItemAmount[] | null {
  if (!Array.isArray(v)) return null;
  const out: ItemAmount[] = [];
  for (const d of v as Partial<ItemAmount>[]) {
    if (typeof d?.item !== 'string' || !itemOrNull(d.item) || !Number.isInteger(d.count) || (d.count as number) <= 0) continue;
    out.push({ item: d.item, count: d.count as number });
  }
  return out;
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Animals and rolled columns from a snapshot. Throws on a malformed or newer snapshot; skips animals of
 * species that no longer exist and keeps at most MOB_STORED_CAP.
 */
export function restoreMobs(s: MobsSnapshot, rng: () => number): { mobs: Mob[]; nextId: number; rolled: number[] } {
  if (!s || typeof s !== 'object' || s.version !== MOBS_SNAPSHOT_VERSION) throw new Error('mobs: unsupported snapshot');
  if (!Array.isArray(s.mobs) || !Array.isArray(s.rolled) || s.rolled.length % 2 !== 0 || !finite(s.nextId)) {
    throw new Error('mobs: malformed snapshot');
  }
  const mobs: Mob[] = [];
  let maxId = 0;
  const seen = new Set<number>();
  for (const r of s.mobs) {
    const spec = creatureOrNull(r?.species);
    if (!spec || !finite(r.id) || seen.has(r.id) || ![r.x, r.y, r.z, r.yaw, r.health, r.ageS].every(finite)) continue;
    if (mobs.length >= MOB_STORED_CAP) break;
    seen.add(r.id);
    const m = createMob(r.id, spec, r.x, r.y, r.z, r.yaw, r.baby === true, rng);
    m.health = Math.min(spec.health, Math.max(0.5, r.health));
    m.ageS = Math.max(0, r.ageS);
    m.eagerS = finite(r.eagerS) ? Math.max(0, r.eagerS) : 0;
    m.cooldownS = finite(r.cooldownS) ? Math.max(0, r.cooldownS) : 0;
    m.milkS = finite(r.milkS) ? Math.max(0, r.milkS as number) : 0;
    m.woolS = finite(r.woolS) ? Math.max(0, r.woolS as number) : 0;
    m.tame = typeof r.tame === 'boolean' ? r.tame : m.eagerS > 0 || m.cooldownS > 0;
    const drops = savedDrops(r.drops);
    if (drops !== null && finite(r.deadS)) {
      m.state = 'dying';
      m.health = 0;
      m.deadS = Math.min(Math.max(0, r.deadS), MOB_DEATH_S - 0.01);
      m.pendingDrops = drops;
      m.deathCause = r.cause === 'player' ? 'player' : 'world';
    }
    mobs.push(m);
    maxId = Math.max(maxId, r.id);
  }
  const rolled: number[] = [];
  for (let i = 0; i < s.rolled.length; i += 2) {
    const cx = s.rolled[i];
    const cz = s.rolled[i + 1];
    if (Number.isInteger(cx) && Number.isInteger(cz)) rolled.push(columnKey(cx, cz));
  }
  return { mobs, nextId: Math.max(s.nextId, maxId + 1), rolled };
}
