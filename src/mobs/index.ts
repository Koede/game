/** src/mobs: the animals of spec 12.5 - behaviour, physics, spawning, targeting, persistence. DOM-free. */
export { MobManager, type MobManagerOptions } from './manager';
export { mobPlayerOf } from './adapter';
export { hitDamage, rollDrops } from './mob';
export { MOBS_SNAPSHOT_VERSION } from './persistence';
export { CALL_RANGE, CORPSE_FADE_S, FLASH_S, KNOCK_H, KNOCK_V, VOID_Y } from './constants';
export { TARGET_MARGIN } from './targets';
export type {
  BiomeLookup,
  DeathCause,
  FeedResult,
  HitResult,
  Mob,
  MobClock,
  MobDeath,
  MobPlayer,
  MobRayHit,
  MobState,
  MobsSnapshot,
  MobView,
  SavedMob,
} from './types';
