/**
 * What the legendary weapons DO (docs/plans/legendary-weapons.md, data in src/content/legendary.ts). Every verb is a small rule
 * that reads only the held item's key (never a stack field), so the controller and the hit path call one helper each and stay
 * free of weapon rules. DOM-free; the rules that need the world take what they need as arguments.
 *
 *  - burning_marks (Emberfang): each hit marks the target; the third mark bursts, hurting it and everything beside it.
 *  - lunge (Gale Reed): Use throws the wielder forward; the next hit inside the window hits harder and shoves the target back.
 *  - lantern_burst (Lanternblade): a hit while it is dark bursts into light: more damage, a longer stun, a shove.
 *  - still_blow (Quiet Hammer): the first blow after standing still for a second is heavy.
 *  - pull (Tidebrand): a hit pulls the target a step toward you.
 *  - root (Rootsong): a hit roots the target in place for a moment.
 *  - shock_arc (Starcleaver): hold Mine to charge; the charged blow releases an arc in front of you.
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
export const LUNGE_SPEED = 16;
export const LUNGE_LIFT = 4.5;
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
  /** Horizontal speed (blocks/s) the target is shoved away from the player, on top of the normal knockback; negative pulls it toward the player; 0 = none. */
  shove: number;
  /** Seconds the target is rooted in place after the blow (Rootsong); 0 = none. */
  rootS: number;
  /** A shock arc to release along the look direction after the blow (Starcleaver): damage and reach; null = none. */
  arc: { damage: number; reach: number } | null;
  /** A visible burst of sparks (the 'legendary:proc' event). */
  proc: boolean;
  /** The blow spent the lunge's window (a blow that does not land gives it back: `giveBackLunge`). */
  lunge: boolean;
}
const noExtras = (): HitExtras => ({ damage: 0, stunS: 0, shove: 0, rootS: 0, arc: null, proc: false, lunge: false });

/** The outcome of the blow's mark, decided once the blow has landed. */
export interface MarkResult {
  /** Marks on the target now (0 after a burst). */
  marks: number;
  burst: boolean;
  /** The burst's damage and reach (0 when there is none). */
  damage: number;
  radius: number;
}

export interface LungeImpulse {
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Attunement (src/core/enchant.ts, 0..2): the altar deepens a legendary's verb. Every number below that has a "per level" grows with it, never
 * past about a third more at II, so a deepened weapon is still near a normal one.
 */
export const MAX_ATTUNEMENT = 2;
const lv = (level: number): number => Math.max(0, Math.min(MAX_ATTUNEMENT, Math.floor(level) || 0));

/** Quiet Hammer: stand still this long and the next blow is heavy (extra damage, a short stun). */
export const STILL_S = 1;
export const STILL_BONUS_DAMAGE = 3;
export const STILL_STUN_S = 0.4;
/** Tidebrand: how fast a hit target is pulled a step toward the wielder. */
export const PULL_SPEED = 5;
/** Rootsong: seconds a hit target is held in place. */
export const ROOT_S = 1.5;
/** Starcleaver: seconds of holding Mine to charge a swing; the arc's damage, reach and half-angle (cosine). */
export const CHARGE_S = 1;
export const ARC_DAMAGE = 3;
export const ARC_REACH = 4;
export const ARC_COS = 0.77;
export const ARC_MAX_TARGETS = 3;

export class LegendaryState {
  private readonly marks = new Map<number, { n: number; ttl: number }>();
  /** Seconds until the next lunge may start. */
  lungeCooldownS = 0;
  /** Seconds left in which a hit counts as the lunge's. */
  lungeWindowS = 0;
  /** Seconds the wielder has stood still (Quiet Hammer). */
  stillS = 0;
  /** Seconds Mine has been held with a charging weapon (Starcleaver). */
  chargeS = 0;

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

  /** The controller, every frame: whether the wielder moved, and whether Mine is held. Feeds the Quiet Hammer's stillness and the Starcleaver's charge. */
  observe(dt: number, moving: boolean, mineHeld: boolean): void {
    if (!(dt > 0)) return;
    this.stillS = moving ? 0 : Math.min(STILL_S + 1, this.stillS + dt);
    this.chargeS = mineHeld ? Math.min(CHARGE_S + 1, this.chargeS + dt) : 0;
  }

  /** Marks on a creature now (0 for an unmarked one). */
  marksOn(id: number): number {
    return this.marks.get(id)?.n ?? 0;
  }

  /** Forgets every mark, the lunge, the stillness and the charge (respawn, a new world). */
  reset(): void {
    this.marks.clear();
    this.lungeCooldownS = 0;
    this.lungeWindowS = 0;
    this.stillS = 0;
    this.chargeS = 0;
  }

  /**
   * Gale Reed: Use throws the wielder forward along (dirX, dirZ) (horizontal; need not be normalised). Null when the item has no
   * lunge, the lunge is cooling down, or there is no direction. Starts the cooldown and the window a hit must land in.
   */
  tryLunge(item: string | null, dirX: number, dirZ: number, level = 0): LungeImpulse | null {
    if (legendaryEffectOf(item) !== 'lunge' || this.lungeCooldownS > 0) return null;
    const len = Math.hypot(dirX, dirZ);
    if (!(len > 1e-6)) return null;
    this.lungeCooldownS = LUNGE_COOLDOWN_S;
    this.lungeWindowS = LUNGE_WINDOW_S;
    const speed = LUNGE_SPEED + 1.5 * lv(level);
    return { vx: (dirX / len) * speed, vy: LUNGE_LIFT, vz: (dirZ / len) * speed };
  }

  /**
   * What the held item adds to a blow that is about to land. `dark` is whether the light where the wielder stands is below
   * DARK_LIGHT; `level` is the weapon's Attunement. The lunge's window, the stillness and the charge are spent by the blow.
   */
  beforeHit(item: string | null, dark: boolean, level = 0): HitExtras {
    const effect = legendaryEffectOf(item);
    const a = lv(level);
    const x = noExtras();
    switch (effect) {
      case 'lunge':
        if (this.lungeWindowS > 0) {
          this.lungeWindowS = 0;
          Object.assign(x, { damage: LUNGE_BONUS_DAMAGE + a, shove: LUNGE_SHOVE + 2 * a, proc: true, lunge: true });
        }
        break;
      case 'lantern_burst':
        if (dark) Object.assign(x, { damage: LANTERN_BONUS_DAMAGE + a, stunS: LANTERN_STUN_S + 0.3 * a, shove: LANTERN_SHOVE, proc: true });
        break;
      case 'still_blow':
        if (this.stillS >= STILL_S) {
          this.stillS = 0;
          Object.assign(x, { damage: STILL_BONUS_DAMAGE + a, stunS: STILL_STUN_S, proc: true });
        }
        break;
      case 'pull':
        Object.assign(x, { shove: -(PULL_SPEED + 2 * a), proc: true });
        break;
      case 'root':
        Object.assign(x, { rootS: ROOT_S + 0.7 * a, proc: true });
        break;
      case 'shock_arc':
        if (this.chargeS >= CHARGE_S) {
          this.chargeS = 0;
          Object.assign(x, { arc: { damage: ARC_DAMAGE + a, reach: ARC_REACH + a }, proc: true });
        }
        break;
      default:
        break;
    }
    return x;
  }

  /** A blow that spent the lunge's window did not land (the creature was still recovering): the window is given back, what is left of it. */
  giveBackLunge(): void {
    this.lungeWindowS = Math.max(this.lungeWindowS, LUNGE_WINDOW_S);
  }

  /** Emberfang: the blow on creature `id` landed. The third mark within MARK_TTL_S bursts and clears the marks. */
  afterHit(item: string | null, id: number, level = 0): MarkResult {
    if (legendaryEffectOf(item) !== 'burning_marks') return { marks: 0, burst: false, damage: 0, radius: 0 };
    const a = lv(level);
    const m = this.marks.get(id) ?? { n: 0, ttl: 0 };
    m.n++;
    m.ttl = MARK_TTL_S;
    if (m.n >= MARK_LIMIT) {
      this.marks.delete(id);
      return { marks: 0, burst: true, damage: BURST_DAMAGE + 2 * a, radius: BURST_RADIUS + 0.5 * a };
    }
    this.marks.delete(id); // re-insert last, so the oldest mark is the first in iteration order
    this.marks.set(id, m);
    while (this.marks.size > MARK_CAP) this.marks.delete(this.marks.keys().next().value as number);
    return { marks: m.n, burst: false, damage: 0, radius: 0 };
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

/** The glow a held legendary gives itself (RGB 0..1): a floor under the held item's light, so it reads across a dark room. Null for any other item. */
export const HELD_GLOW: Readonly<Record<string, readonly [number, number, number]>> = {
  burning_marks: [0.62, 0.26, 0.1],
  lunge: [0.3, 0.45, 0.5],
  lantern_burst: [0.7, 0.55, 0.25],
  still_blow: [0.28, 0.28, 0.3],
  pull: [0.2, 0.42, 0.55],
  root: [0.22, 0.5, 0.25],
  shock_arc: [0.55, 0.6, 0.8],
  veinseek: [0.5, 0.4, 0.2],
};
export const heldGlowOf = (item: string | null | undefined): readonly [number, number, number] | null => {
  const e = legendaryEffectOf(item);
  return e ? HELD_GLOW[e] ?? null : null;
};

/** Sparks of a swing trail: none under reduced motion, a thin trail on low graphics, a full one otherwise. */
export const swingTrailSparks = (reduceMotion: boolean, graphics: 'low' | 'normal' | 'high' | undefined): number => (reduceMotion ? 0 : graphics === 'low' ? 4 : 8);
