/**
 * The player's timed buffs: the two older ones (Well-Warmed from a fire, Well-Fed from a forged meal) and the six
 * drink buffs of brewing (BREWING_PLAN 11.1). Well-Warmed and Well-Fed keep their plain `...S` fields so every
 * older reader and save keeps working; the drinks live in one slot per family (tea, coffee), so a new drink of a
 * family replaces the old one. A drink's number is applied at the one place its base rule lives, through the
 * multiplier getters below. DOM-free.
 */
import {
  GRAVITY,
  HEARTHKEPT_DRAIN_MULT,
  JUMP_VELOCITY,
  LASTING_DRAIN_MULT,
  MENDING_REGEN_MULT,
  SPRING_JUMP_MULT,
  SWIFT_SPEED_MULT,
  VIGOR_MINING_MULT,
} from '../core/constants';
import { DRINK_BUFF_KEYS, DRINK_BUFFS } from '../core/brewing';
import type { BuffName } from '../core/gameEvents';
import type { DrinkBuff, DrinkFamily } from '../core/types';

/** One active buff, for the HUD. */
export interface ActiveBuff {
  buff: BuffName;
  /** Seconds left (> 0). */
  timeLeftS: number;
}

export interface BuffsSnapshot {
  wellWarmedS: number;
  /** Missing in saves made before hunger existed. */
  wellFedS?: number;
  /** Seconds left per active drink buff. Missing in saves made before brewing. */
  drinks?: Partial<Record<DrinkBuff, number>>;
}

/** What `Buffs.grant` did with a drink buff. */
export interface DrinkGrant {
  /** The buff of the same family it pushed out (null when the slot was free or held the same buff). */
  replaced: DrinkBuff | null;
  /** The same buff was already running: only its time was refreshed. */
  refreshed: boolean;
}

interface DrinkSlot {
  buff: DrinkBuff | null;
  s: number;
}

/**
 * Extra safe fall height while a jump is boosted by `jumpMult`: the boosted apex is mult^2 times the normal jump
 * height, so (mult^2 - 1) x the normal height is added to SAFE_FALL and a boosted jump never hurts.
 */
export const springFallAllowance = (jumpMult: number): number =>
  jumpMult > 1 ? (jumpMult * jumpMult - 1) * ((JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY)) : 0;

const FAMILIES: readonly DrinkFamily[] = ['tea', 'coffee'];
const familyOf = (buff: DrinkBuff): DrinkFamily => DRINK_BUFFS[buff].family;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export class Buffs {
  /** Seconds of Well-Warmed left (0 = not active). */
  wellWarmedS = 0;
  /** Seconds of Well-Fed left (0 = not active; spec 12.1). */
  wellFedS = 0;
  private readonly slots: Record<DrinkFamily, DrinkSlot> = { tea: { buff: null, s: 0 }, coffee: { buff: null, s: 0 } };

  /** Seconds left of a drink buff (0 = not active). */
  timeLeftS(buff: DrinkBuff): number {
    const slot = this.slots[familyOf(buff)];
    return slot.buff === buff ? slot.s : 0;
  }

  has(buff: DrinkBuff): boolean {
    return this.timeLeftS(buff) > 0;
  }

  /** The drink buff running in a family, or null. */
  drinkOf(family: DrinkFamily): DrinkBuff | null {
    const slot = this.slots[family];
    return slot.s > 0 ? slot.buff : null;
  }

  /**
   * Starts a drink buff for `seconds`. The same buff again is refreshed (never shortened); another buff of the same
   * family replaces the running one.
   */
  grant(buff: DrinkBuff, seconds: number): DrinkGrant {
    const slot = this.slots[familyOf(buff)];
    const running = slot.s > 0 ? slot.buff : null;
    if (running === buff) {
      slot.s = Math.max(slot.s, seconds);
      return { replaced: null, refreshed: true };
    }
    slot.buff = buff;
    slot.s = Math.max(0, seconds);
    return { replaced: running, refreshed: false };
  }

  /** Counts every timer down. */
  tick(dt: number): void {
    if (!(dt > 0)) return;
    if (this.wellFedS > 0) this.wellFedS = Math.max(0, this.wellFedS - dt);
    for (const f of FAMILIES) {
      const slot = this.slots[f];
      if (slot.s <= 0) continue;
      slot.s = Math.max(0, slot.s - dt);
      if (slot.s === 0) slot.buff = null;
    }
  }

  /** Ends every buff (respawn). */
  clear(): void {
    this.wellWarmedS = 0;
    this.wellFedS = 0;
    for (const f of FAMILIES) this.slots[f] = { buff: null, s: 0 };
  }

  /** Every buff running now, drinks first by family; for the HUD chips. Allocates: call it on HUD refresh only. */
  active(): ActiveBuff[] {
    const out: ActiveBuff[] = [];
    if (this.wellWarmedS > 0) out.push({ buff: 'well_warmed', timeLeftS: this.wellWarmedS });
    if (this.wellFedS > 0) out.push({ buff: 'well_fed', timeLeftS: this.wellFedS });
    for (const f of FAMILIES) {
      const slot = this.slots[f];
      if (slot.buff && slot.s > 0) out.push({ buff: slot.buff, timeLeftS: slot.s });
    }
    return out;
  }

  /** Factor on jump velocity (Spring). */
  get jumpMult(): number {
    return this.has('spring') ? SPRING_JUMP_MULT : 1;
  }

  /** Factor on walk, sprint and swim speed (Swift). */
  get speedMult(): number {
    return this.has('swift') ? SWIFT_SPEED_MULT : 1;
  }

  /** Factor on mining speed (Vigor). */
  get miningMult(): number {
    return this.has('vigor') ? VIGOR_MINING_MULT : 1;
  }

  /** Factor on warmth drain (Hearthkept). */
  get warmthDrainMult(): number {
    return this.has('hearthkept') ? HEARTHKEPT_DRAIN_MULT : 1;
  }

  /** Factor on how fast health regenerates (Mending). */
  get regenMult(): number {
    return this.has('mending') ? MENDING_REGEN_MULT : 1;
  }

  /** Factor on food drain (Lasting). */
  get foodDrainMult(): number {
    return this.has('lasting') ? LASTING_DRAIN_MULT : 1;
  }

  toJSON(): BuffsSnapshot {
    const drinks: Partial<Record<DrinkBuff, number>> = {};
    for (const b of DRINK_BUFF_KEYS) {
      const s = this.timeLeftS(b);
      if (s > 0) drinks[b] = s;
    }
    return { wellWarmedS: this.wellWarmedS, wellFedS: this.wellFedS, drinks };
  }

  load(s: BuffsSnapshot): void {
    this.clear();
    this.wellWarmedS = finite(s.wellWarmedS) ? Math.max(0, s.wellWarmedS) : 0;
    this.wellFedS = finite(s.wellFedS) ? Math.max(0, s.wellFedS) : 0;
    const drinks = s.drinks;
    if (typeof drinks !== 'object' || drinks === null) return;
    for (const b of DRINK_BUFF_KEYS) {
      const left = drinks[b];
      if (finite(left) && left > 0) this.grant(b, left);
    }
  }
}
