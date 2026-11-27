/**
 * The player's hands on the animals (spec 12.5): which animal is under the crosshair (its box must be hit before
 * any block), Mine on it hits it (damage by the held tool, tool wear 1, the manager's cooldown, knockback and
 * flash), and Use with an item it likes feeds it - decided BEFORE eating and planting, because potatoes and carrots
 * are food too. Any other Use goes on as if no animal were there.
 *
 * The animals are reached through the small AnimalTargets interface (src/mobs' MobManager fits it), so the player
 * module keeps no reference to the manager's internals.
 */
import { legendaryEffectOf } from '../content/legendary';
import { REACH } from '../core/constants';
import { CREATURES } from '../core/registry';
import { ARC_COS, ARC_MAX_TARGETS, stunOf, type PlayerState } from '../game';
import { enchantLevel } from '../core/enchant';
import { hitDamage, type YieldKind } from '../mobs';
import type { HitExtras } from '../game/legendary';
import { swapHeldItem } from './buckets';
import type { SwingTarget } from './interaction';

/** What the controller needs from the animals. */
export interface AnimalTargets {
  /** Nearest living animal whose box the ray hits within maxDist, or null (the result may be a reused object). */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): { id: number; distance: number } | null;
  /**
   * Hits a creature for `damage` from (fromX, fromZ); refused (`ok: false`) during its hit cooldown. `stunS` > 0
   * (the arc maul) stuns an automaton for that long; animals ignore it.
   */
  hit(id: number, damage: number, fromX: number, fromZ: number, stunS?: number): { ok: boolean; killed?: boolean };
  /** A legendary weapon's extras (src/game/legendary.ts), all optional: damage with no hit cooldown, a shove away from a point, the creatures near a point. */
  hurtExtra?(id: number, damage: number, fromX: number, fromZ: number): boolean;
  shove?(id: number, fromX: number, fromZ: number, speed: number): void;
  root?(id: number, seconds: number): void;
  near?(x: number, z: number, radius: number, exceptId?: number): { id: number; x: number; y: number; z: number }[];
  /** Milks or shears (optional: not every stand-in has it). Refused with a reason while the animal is not ready. */
  harvest?(id: number, kind: YieldKind): { ok: true } | { ok: false; reason: string };
  /** Feeds a liked item (the caller takes the item); refused with a reason the player can read. */
  feed(id: number, itemKey: string): { ok: true } | { ok: false; reason: string };
  /** A tame pet under Use with something it does not eat (pack): null when the animal is not a tame pet. */
  pet?(id: number, held: { item: string; count: number; durability?: number } | null): 'worked' | 'refused' | null;
}

/** Advisory toasts, at most once per subject in a while (Interaction.advise). */
export interface Advisor {
  advise(key: string, text: string): void;
}

/** Items some animal likes: Use with one of these on an animal is meant for the animal. */
const LIKED: ReadonlySet<string> = new Set(CREATURES.flatMap((c) => c.likes));
export const likedByAnimals = (itemKey: string): boolean => LIKED.has(itemKey);

/** Empty containers that take milk, and the full item each becomes (the container returns when the milk is used up). */
export const MILK_CONTAINERS: Readonly<Record<string, string>> = { pail: 'milk_pail', glass_beaker: 'milk_beaker' };
/** Shearing tools: shears, or a flint or bronze axe blade. Wool per shearing, and the wear it costs. */
export const SHEARS: ReadonlySet<string> = new Set(['shears', 'flint_axe', 'bronze_axe']);
export const WOOL_PER_SHEARING = 2;

export type AnimalUse = 'fed' | 'refused' | 'pass' | 'milked' | 'sheared' | 'gathered';

export class AnimalHands {
  /** Id of the animal under the crosshair after the last aim(), or null. */
  target: number | null = null;
  /** Whether it is dark where the player stands (the Lanternblade's burst); set by the controller. Default: never. */
  dark: () => boolean = () => false;

  constructor(
    private readonly animals: AnimalTargets,
    private readonly player: PlayerState,
    private readonly swing: SwingTarget,
    private readonly advisor: Advisor,
  ) {}

  /**
   * Casts from the eye along `dir` and keeps the animal only when it is nearer than the block the block ray hit
   * (`blockDistance`, Infinity for none). Returns the target id or null.
   */
  aim(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, blockDistance: number): number | null {
    const hit = this.animals.raycast(ox, oy, oz, dx, dy, dz, REACH);
    this.target = hit !== null && hit.distance < blockDistance ? hit.id : null;
    return this.target;
  }

  /** Distance to the nearest animal on the ray within reach, or Infinity (so a person behind an animal is not talked to). */
  distanceAlong(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
    return this.animals.raycast(ox, oy, oz, dx, dy, dz, REACH)?.distance ?? Infinity;
  }

  /**
   * Mine held on the target: one hit whenever both the player's swing (0.5 s with a maul, 0.4 s otherwise) and the
   * creature's own cooldown allow. A weapon with `stunS` passes it along; the held tool or weapon wears by 1.
   */
  strike(): boolean {
    const combat = this.player.combat;
    if (this.target === null || this.player.dead || !combat.strikeReady) return false;
    const item = this.player.heldStack()?.item ?? null;
    const p = this.player.position;
    const leg = combat.legendary;
    const level = enchantLevel(this.player.heldStack() ?? undefined, 'attunement');
    const extra = leg.beforeHit(item, this.dark(), level);
    const id = this.target;
    const r = this.animals.hit(id, hitDamage(item, this.player.buffs.strength) + extra.damage, p.x, p.z, stunOf(item) + extra.stunS);
    if (!r.ok) {
      // The blow did not land (the creature's own cooldown): a spent lunge window is given back.
      if (extra.lunge) leg.giveBackLunge();
      return false;
    }
    combat.startStrikeCooldown(item);
    this.swing.triggerSwing();
    this.player.wearHeldTool(1);
    this.legendaryAfter(item, id, extra, level, p.x, p.z, r.killed === true);
    return true;
  }

  /** The legendary weapon's part of a landed blow: the shove, the Emberfang's marks and burst, and the spark event for the renderer. */
  private legendaryAfter(item: string | null, id: number, extra: HitExtras, level: number, px: number, pz: number, killed: boolean): void {
    const a = this.animals;
    const at = a.near?.(px, pz, REACH + 1, -1).find((m) => m.id === id);
    if (extra.shove !== 0 && !killed) a.shove?.(id, px, pz, extra.shove);
    if (extra.rootS > 0 && !killed) a.root?.(id, extra.rootS);
    const mark = this.player.combat.legendary.afterHit(item, id, level);
    if (mark.burst && a.hurtExtra) {
      a.hurtExtra(id, mark.damage, px, pz);
      for (const m of a.near?.(at?.x ?? px, at?.z ?? pz, mark.radius, id) ?? []) a.hurtExtra(m.id, mark.damage, px, pz);
    }
    if (extra.arc && a.hurtExtra) this.shockArc(id, extra.arc.damage, extra.arc.reach, px, pz);
    if (at && (extra.proc || mark.burst || mark.marks > 0)) {
      const effect = legendaryEffectOf(item);
      if (effect) this.player.bus.emit('legendary:proc', { effect, x: at.x, y: at.y + 0.8, z: at.z });
    }
  }

  /** Starcleaver: the arc hurts up to ARC_MAX_TARGETS other creatures in front of the wielder within `reach`, nearest first. */
  private shockArc(skipId: number, damage: number, reach: number, px: number, pz: number): void {
    const a = this.animals;
    const dir = this.player.viewDir({ x: 0, y: 0, z: 0 });
    const flat = Math.hypot(dir.x, dir.z) || 1;
    let hit = 0;
    for (const m of a.near?.(px, pz, reach, skipId) ?? []) {
      const dx = m.x - px;
      const dz = m.z - pz;
      const d = Math.hypot(dx, dz) || 1;
      if ((dx * dir.x + dz * dir.z) / (d * flat) < ARC_COS) continue;
      a.hurtExtra?.(m.id, damage, px, pz);
      if (++hit >= ARC_MAX_TARGETS) break;
    }
  }

  /**
   * Use on the target. 'fed' (one item taken), 'refused' (an animal food it will not take now: the reason is
   * toasted), or 'pass' when the held item means nothing to animals and Use should act as if none were there.
   */
  use(): AnimalUse {
    if (this.target === null || this.player.dead) return 'pass';
    const held = this.player.heldStack();
    if (held && this.animals.harvest && (held.item in MILK_CONTAINERS || SHEARS.has(held.item))) return this.harvest(held.item);
    // An empty hand gathers a hen's egg (so does a hand already holding eggs, but only while she has one: otherwise Use eats it);
    // for any other animal the refusal says it gives none and Use goes on.
    if ((!held || held.item === 'egg') && this.animals.harvest) {
      const r = this.animals.harvest(this.target, 'egg');
      if (r.ok) {
        const left = this.player.give('egg', 1);
        if (left > 0) this.player.drop('egg', left);
        this.swing.triggerSwing();
        return 'gathered';
      }
      if (held) return 'pass';
      if (!/ gives no /.test(r.reason)) {
        this.advisor.advise(`yield:${r.reason.replace(/\d+/g, '')}`, r.reason);
        return 'refused';
      }
    }
    if (this.animals.pet && !(held && likedByAnimals(held.item))) {
      const pet = this.animals.pet(this.target, held);
      if (pet !== null) {
        this.swing.triggerSwing();
        return pet === 'worked' ? 'fed' : 'refused';
      }
    }
    if (!held || !likedByAnimals(held.item)) return 'pass';
    const r = this.animals.feed(this.target, held.item);
    if (r.ok) {
      this.player.consumeHeld(1);
      this.swing.triggerSwing();
      return 'fed';
    }
    // Keyed without numbers: "not ready yet (212 s)" counts down every second.
    this.advisor.advise(`feed:${r.reason.replace(/\d+/g, '')}`, r.reason);
    return 'refused';
  }

  /** Use with an empty pail or beaker milks, with shears or a blade shears; a refusal that is not about this animal passes. */
  private harvest(item: string): AnimalUse {
    const milking = item in MILK_CONTAINERS;
    const r = this.animals.harvest!(this.target as number, milking ? 'milk' : 'wool');
    if (!r.ok) {
      // An animal that gives nothing of that kind lets Use go on as if it were not there (a pail on a boar scoops water).
      if (/ gives no /.test(r.reason)) return 'pass';
      this.advisor.advise(`yield:${r.reason.replace(/\d+/g, '')}`, r.reason);
      return 'refused';
    }
    if (milking) swapHeldItem(this.player, MILK_CONTAINERS[item]);
    else {
      // A full pack drops the wool at the player's feet instead of losing it (the goat's timer has already started).
      const left = this.player.give('wool', WOOL_PER_SHEARING);
      if (left > 0) this.player.drop('wool', left);
      this.player.wearHeldTool(1);
    }
    this.player.bus.emit('act:done', { kind: 'harvested' });
    this.swing.triggerSwing();
    return milking ? 'milked' : 'sheared';
  }
}
