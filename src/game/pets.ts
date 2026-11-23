/**
 * Companion animals (docs/api/pets.md), the game layer over the dog and cat creatures (src/content/pets.ts):
 *  - strays: now and then, at dusk or dawn, while the player has no pet, one wanders in 18-30 blocks away;
 *  - the follow brain is in src/mobs/brain.ts (a tame pet always follows);
 *  - pack: Use on your pet with something that is not its food hands the stack to it (PACK_SLOTS stacks); an empty hand takes it all back;
 *  - warning: a hostile within WARN_RANGE of the player makes each pet growl (a toast), at most every WARN_EVERY_S.
 * Packs persist by mob id through World.persist('pets').
 */
import type { GameBus } from '../core/context';
import { creature } from '../core/registry';
import type { ItemStack, Slot } from '../core/types';
import type { Mob } from '../mobs/types';
import type { PlayerState } from './playerState';

export const PACK_SLOTS = 4;
export const WARN_RANGE = 18;
export const WARN_EVERY_S = 25;
/** Seconds between stray attempts while the player has no pet, and the chance each attempt succeeds. */
export const STRAY_EVERY_S = 120;
export const STRAY_CHANCE = 0.35;

/** What Pets needs from the mob manager (MobManager fits). */
export interface PetMobs {
  readonly all: readonly Mob[];
  readonly hostiles: { readonly active: readonly Mob[] };
  get(id: number): Mob | undefined;
  add(spec: ReturnType<typeof creature>, spot: { x: number; y: number; z: number; yaw: number }): Mob;
}

export interface PetsHost {
  readonly bus: GameBus;
  readonly player: PlayerState;
  readonly mobs: PetMobs;
  isDusk(): boolean;
  /** A feet position with a floor and room to stand at (x, z), or null. */
  standAt(x: number, z: number): number | null;
  rng(): number;
}

export class Pets {
  private packs = new Map<number, Slot[]>();
  private warnS = 0;
  private strayS = 0;

  constructor(private readonly host: PetsHost) {}

  /** Living tame pets. */
  pets(): Mob[] {
    return this.host.mobs.all.filter((m) => m.tame && m.spec.pet === true && m.state !== 'dying');
  }

  packOf(id: number): Slot[] {
    let p = this.packs.get(id);
    if (!p) { p = Array.from({ length: PACK_SLOTS }, () => null); this.packs.set(id, p); }
    return p;
  }

  /** Use on a pet (id) with `held` (null = empty hand). Returns a message for a toast, or null when it is not a tame pet. */
  useOn(id: number, held: ItemStack | null): 'worked' | 'refused' | null {
    const m = this.host.mobs.get(id);
    if (!m || !m.tame || !m.spec.pet) return null;
    const name = m.spec.name;
    const pack = this.packOf(id);
    const toast = (text: string, kind: 'info' | 'good' | 'warn' = 'info'): void => this.host.bus.emit('toast', { text, kind });
    if (!held) {
      let n = 0;
      for (let i = 0; i < pack.length; i++) {
        const s = pack[i];
        if (!s) continue;
        const left = this.host.player.give(s.item, s.count);
        n += s.count - left;
        pack[i] = left > 0 ? { ...s, count: left } : null;
      }
      toast(n > 0 ? `${name} drops ${n} ${n === 1 ? 'thing' : 'things'} into your pack.` : `${name} is carrying nothing.`);
      return 'worked';
    }
    if (m.spec.likes.includes(held.item)) return null;
    const slot = pack.findIndex((s) => s !== null && s.item === held.item && s.durability === held.durability);
    const free = slot >= 0 ? slot : pack.findIndex((s) => s === null);
    if (free < 0) { toast(`${name} cannot carry any more.`, 'warn'); return 'refused'; }
    const taken = this.host.player.consumeHeld(held.count);
    if (!taken) return 'refused';
    const cur = pack[free];
    pack[free] = cur ? { ...cur, count: cur.count + taken.count } : { ...taken };
    toast(`${name} takes the ${taken.item.replace(/_/g, ' ')}.`);
    return 'worked';
  }

  tick(dt: number): void {
    const { mobs, player } = this.host;
    const mine = this.pets();
    if (this.warnS > 0) this.warnS -= dt;
    if (mine.length > 0 && this.warnS <= 0) {
      const p = player.position;
      const near = mobs.hostiles.active.some((h) => h.state !== 'dying' && Math.hypot(h.x - p.x, h.z - p.z) <= WARN_RANGE);
      if (near) {
        this.warnS = WARN_EVERY_S;
        const m = mine[0];
        this.host.bus.emit('toast', { text: `${m.spec.name} ${m.spec.key === 'cat' ? 'hisses' : 'growls'}: something dangerous is near.`, kind: 'warn' });
      }
    }
    if (mine.length > 0) { this.strayS = 0; return; }
    this.strayS += dt;
    if (this.strayS < STRAY_EVERY_S) return;
    this.strayS = 0;
    if (!this.host.isDusk() || this.host.rng() >= STRAY_CHANCE) return;
    const strays = mobs.all.filter((m) => m.spec.pet === true);
    if (strays.length >= 2) return;
    const a = this.host.rng() * Math.PI * 2;
    const r = 18 + this.host.rng() * 12;
    const x = Math.floor(player.position.x + Math.cos(a) * r);
    const z = Math.floor(player.position.z + Math.sin(a) * r);
    const y = this.host.standAt(x, z);
    if (y === null) return;
    mobs.add(creature(this.host.rng() < 0.5 ? 'dog' : 'cat'), { x: x + 0.5, y, z: z + 0.5, yaw: this.host.rng() * Math.PI * 2 });
    this.host.bus.emit('toast', { text: 'A stray animal wanders in at the edge of the light. Offer it food.', kind: 'info' });
  }

  toJSON(): Record<string, Slot[]> {
    const out: Record<string, Slot[]> = {};
    for (const [id, pack] of this.packs) if (this.host.mobs.get(id) && pack.some((s) => s)) out[String(id)] = pack;
    return out;
  }

  load(raw: unknown): void {
    this.packs.clear();
    if (!raw || typeof raw !== 'object') return;
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      const pack = Array.from({ length: PACK_SLOTS }, (_, i) => {
        const s = v[i] as ItemStack | null | undefined;
        return s && typeof s.item === 'string' && s.count > 0 ? { item: s.item, count: Math.floor(s.count), ...(s.durability !== undefined ? { durability: s.durability } : {}) } : null;
      });
      this.packs.set(Number(k), pack);
    }
  }
}
