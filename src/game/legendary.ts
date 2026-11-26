/**
 * What the legendary weapons DO (docs/plans/legendary-weapons.md, data in src/content/legendary.ts). Every verb is a small rule
 * that reads only the held item's key (never a stack field), so the controller and the hit path call one helper each and stay
 * free of weapon rules. DOM-free; the rules that need the world take what they need as arguments.
 *
 *  - burning_marks (Emberfang): each hit marks the target; the third mark bursts, hurting it and everything beside it.
 *  - lunge (Gale Reed): Use throws the wielder forward; the next hit inside the window hits harder and shoves the target back.
 *  - lantern_burst (Lanternblade): a hit while it is dark bursts into light: more damage, a longer stun, a shove.
 *  - veinseek (Orrin's Spare Pick): the vein itself is the enchant Veinseeker (src/game/enchantEffects.ts); the hum is `oreHum`.
 */
import { legendaryEffectOf } from '../content/legendary';
import type { IWorld } from '../core/types';

/** Emberfang: marks that make a burst, how long a mark lasts, the burst's damage and reach. */
export const MARK_LIMIT = 3;
export const MARK_TTL_S = 6;
export const BURST_DAMAGE = 4;
export const BURST_RADIUS = 2.5;
/** The most marked creatures remembered at once (the oldest go first). */
export const MARK_CAP = 16;

/** Gale Reed: the lunge's speed (blocks/s), the lift that lets it carry, the wait between lunges and the window in which a hit counts. */
export const LUNGE_SPEED = 12;
export const LUNGE_LIFT = 3.5;
export const LUNGE_COOLDOWN_S = 2.5;
export const LUNGE_WINDOW_S = 0.7;
export const LUNGE_BONUS_DAMAGE = 2;
export const LUNGE_SHOVE = 9;

/** Lanternblade: below this light level (0..15) a hit bursts; the burst's bonus damage, stun and shove. */
export const DARK_LIGHT = 6;
export const LANTERN_BONUS_DAMAGE = 2;
export const LANTERN_STUN_S = 0.8;
export const LANTERN_SHOVE = 6;

/** Orrin's Spare Pick: how far (blocks) its hum reaches, and the loudest hum is at 1. */
export const ORE_HUM_RADIUS = 6;

/** Hit extras decided BEFORE the blow lands (they ride along with it). */
export interface HitExtras {
  damage: number;
  stunS: number;
  /** Horizontal speed (blocks/s) the target is shoved away from the player, on top of the normal knockback; 0 = none. */
  shove: number;
  /** A visible burst of sparks (the 'legendary:proc' event). */
  proc: boolean;
  /** The blow spent the lunge's window (a blow that does not land gives it back: `giveBackLunge`). */
  lunge: boolean;
}
const NO_EXTRAS: HitExtras = { damage: 0, stunS: 0, shove: 0, proc: false, lunge: false };

/** The outcome of the blow's mark, decided once the blow has landed. */
export interface MarkResult {
  /** Marks on the target now (0 after a burst). */
  marks: number;
  burst: boolean;
}

export interface LungeImpulse {
  vx: number;
  vy: number;
  vz: number;
}

export class LegendaryState {
  private readonly marks = new Map<number, { n: number; ttl: number }>();
  /** Seconds until the next lunge may start. */
  lungeCooldownS = 0;
  /** Seconds left in which a hit counts as the lunge's. */
  lungeWindowS = 0;

  /** Counts the cooldowns and the marks down (the controller, every frame). */
  tick(dt: number): void {
    if (!(dt > 0)) return;
    if (this.lungeCooldownS > 0) this.lungeCooldownS = Math.max(0, this.lungeCooldownS - dt);
    if (this.lungeWindowS > 0) this.lungeWindowS = Math.max(0, this.lungeWindowS - dt);
    for (const [id, m] of this.marks) {
      m.ttl -= dt;
      if (m.ttl <= 0) this.marks.delete(id);
    }
  }

  /** Marks on a creature now (0 for an unmarked one). */
  marksOn(id: number): number {
    return this.marks.get(id)?.n ?? 0;
  }

  /** Forgets every mark and the lunge (respawn, a new world). */
  reset(): void {
    this.marks.clear();
    this.lungeCooldownS = 0;
    this.lungeWindowS = 0;
  }

  /**
   * Gale Reed: Use throws the wielder forward along (dirX, dirZ) (horizontal; need not be normalised). Null when the item has no
   * lunge, the lunge is cooling down, or there is no direction. Starts the cooldown and the window a hit must land in.
   */
  tryLunge(item: string | null, dirX: number, dirZ: number): LungeImpulse | null {
    if (legendaryEffectOf(item) !== 'lunge' || this.lungeCooldownS > 0) return null;
    const len = Math.hypot(dirX, dirZ);
    if (!(len > 1e-6)) return null;
    this.lungeCooldownS = LUNGE_COOLDOWN_S;
    this.lungeWindowS = LUNGE_WINDOW_S;
    return { vx: (dirX / len) * LUNGE_SPEED, vy: LUNGE_LIFT, vz: (dirZ / len) * LUNGE_SPEED };
  }

  /**
   * What the held item adds to a blow that is about to land. `dark` is whether the light where the wielder stands is below
   * DARK_LIGHT. The lunge's window is spent by the blow.
   */
  beforeHit(item: string | null, dark: boolean): HitExtras {
    const effect = legendaryEffectOf(item);
    if (effect === 'lunge' && this.lungeWindowS > 0) {
      this.lungeWindowS = 0;
      return { damage: LUNGE_BONUS_DAMAGE, stunS: 0, shove: LUNGE_SHOVE, proc: true, lunge: true };
    }
    if (effect === 'lantern_burst' && dark) return { damage: LANTERN_BONUS_DAMAGE, stunS: LANTERN_STUN_S, shove: LANTERN_SHOVE, proc: true, lunge: false };
    return NO_EXTRAS;
  }

  /** A blow that spent the lunge's window did not land (the creature was still recovering): the window is given back, what is left of it. */
  giveBackLunge(): void {
    this.lungeWindowS = Math.max(this.lungeWindowS, LUNGE_WINDOW_S);
  }

  /** Emberfang: the blow on creature `id` landed. The third mark within MARK_TTL_S bursts and clears the marks. */
  afterHit(item: string | null, id: number): MarkResult {
    if (legendaryEffectOf(item) !== 'burning_marks') return { marks: 0, burst: false };
    const m = this.marks.get(id) ?? { n: 0, ttl: 0 };
    m.n++;
    m.ttl = MARK_TTL_S;
    if (m.n >= MARK_LIMIT) {
      this.marks.delete(id);
      return { marks: 0, burst: true };
    }
    this.marks.delete(id); // re-insert last, so the oldest mark is the first in iteration order
    this.marks.set(id, m);
    while (this.marks.size > MARK_CAP) this.marks.delete(this.marks.keys().next().value as number);
    return { marks: m.n, burst: false };
  }
}

const isOreKey = (key: string): boolean => key.endsWith('_ore');

/**
 * Orrin's Spare Pick, held: how loud its hum is (0..1) from the nearest ore within ORE_HUM_RADIUS of the wielder, seen through
 * walls (that is the point of it). 0 when it is not the Spare Pick or no ore is near. Closer is louder.
 */
export function oreHum(world: IWorld, item: string | null, x: number, y: number, z: number): number {
  if (legendaryEffectOf(item) !== 'veinseek') return 0;
  const bx = Math.floor(x);
  const by = Math.floor(y);
  const bz = Math.floor(z);
  let best = Infinity;
  for (let dy = -ORE_HUM_RADIUS; dy <= ORE_HUM_RADIUS; dy++) {
    for (let dz = -ORE_HUM_RADIUS; dz <= ORE_HUM_RADIUS; dz++) {
      for (let dx = -ORE_HUM_RADIUS; dx <= ORE_HUM_RADIUS; dx++) {
        const d = Math.hypot(dx, dy, dz);
        if (d >= best || d > ORE_HUM_RADIUS) continue;
        if (!world.isLoaded(bx + dx, bz + dz)) continue;
        if (isOreKey(world.getBlock(bx + dx, by + dy, bz + dz).key)) best = d;
      }
    }
  }
  return best === Infinity ? 0 : 1 - best / (ORE_HUM_RADIUS + 1);
}
