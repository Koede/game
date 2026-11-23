/**
 * NpcManager: the tavern's people and props. DOM-free and headless (owned by GameState, saved with `world.persist('npcs')`).
 * `buildStart` builds the tavern around the spawn point of a NEW world; `talk` is the player's Use on a person or prop under the
 * crosshair. Roles: the witch (magic), barkeep (brewing) and artificer (tech) alternate chatter with progression advice; the orc can be
 * hired for coin to fight beside you; the hermit buys what you hold; the board pays a coin bounty for every progression goal you have
 * done (you must come to the board to redeem it); the clock tells the time. Phrase banks: ./scripts.
 */
import type { GameBus } from '../core/context';
import type { IWorld } from '../core/types';
import { phaseAt } from '../game/clock';
import { Companion, HIRE_COST, HIRE_SECONDS, type CompanionHost } from './companion';
import { NPCS, type NpcDef, type NpcRole, type NpcSprite } from './data';
import { LinePicker, clockHM, clockText, type Phase } from './dialogue';
import { BOUNTIES, stackPrice } from './economy';
import { HERMIT_NOTHING, HERMIT_SALE } from './scripts/hermit';
import { ORC_HIRE } from './scripts/orc';
import { FIRE_SPOTS, TAVERN_START, buildTavern } from './tavern';

export interface NpcView {
  id: string;
  name: string;
  sprite: NpcSprite;
  role: NpcRole;
  kind: 'person' | 'prop';
  scale: number;
  x: number;
  y: number;
  z: number;
  /** The clock's minute of the day (0..1439); 0 for everything else. */
  extra: number;
  /** The hired orc is out and about. */
  hired: boolean;
}

export interface NpcSnapshot {
  v: 1;
  /** Tavern-local origin in the world (the north-west floor corner), or null in worlds without one. */
  at: [number, number, number] | null;
  greeted: boolean;
  gifted: string[];
  spoken: Record<string, number>;
  heard?: string[];
  coins?: number;
  claimed?: string[];
  hiredS?: number;
  comp?: [number, number, number];
}

/** What the manager needs from the game. */
export interface NpcHost {
  give(item: string, count: number): number;
  currentGoal(): string | null;
  completed(): ReadonlySet<string>;
  timeOfDay(): number;
  day(): number;
  /** The stack in the player's hand, or null. */
  held(): { item: string; count: number } | null;
  takeHeld(count: number): void;
  /** Progression advice for a specialist (magic, brewing, tech), or null when there is none. */
  advice(role: 'witch' | 'barkeep' | 'artificer'): string | null;
  /** Keeps a hearth in the tavern burning. */
  tendFire?(x: number, y: number, z: number): void;
  companion: CompanionHost;
}

const REACH = 3.4;
const OFFER_WINDOW_S = 10;
const GREET_AFTER_S = 90;

export class NpcManager {
  at: [number, number, number] | null = null;
  greeted = false;
  coins = 0;
  readonly companion = new Companion();
  private gifted = new Set<string>();
  private spoken: Record<string, number> = {};
  private heard = new Set<string>();
  private claimed = new Set<string>();
  private host: NpcHost | null = null;
  private cooldownS = 0;
  private offerS = 0;
  private fireS = 0;
  private clockS = 0;
  private readonly greetedAt = new Map<string, number>();
  private readonly lines: LinePicker;

  constructor(private readonly bus: GameBus, private readonly rng: () => number = Math.random) {
    this.lines = new LinePicker(rng);
  }

  bind(host: NpcHost): void {
    this.host = host;
  }

  get present(): boolean {
    return this.at !== null;
  }

  /** Builds the tavern with its start cell on x, z (the world spawn, so a respawn lands in it too), the floor at ground level y. Returns the player's start. */
  buildStart(world: IWorld, cx: number, groundY: number, cz: number): { x: number; y: number; z: number } | null {
    const ox = Math.floor(cx) - TAVERN_START[0];
    const oz = Math.floor(cz) - TAVERN_START[2];
    if (!buildTavern(world, ox, groundY, oz)) return null;
    this.at = [ox, groundY, oz];
    return { x: ox + TAVERN_START[0] + 0.5, y: groundY + TAVERN_START[1], z: oz + TAVERN_START[2] + 0.5 };
  }

  views(): NpcView[] {
    const o = this.at;
    if (!o) return [];
    const { h, m } = clockHM(this.host?.timeOfDay() ?? 0);
    return NPCS.map((n) => {
      const hired = n.role === 'orc' && this.companion.active;
      const cell = n.kind === 'person' ? 0.5 : 0;
      return {
        id: n.id, name: n.name, sprite: n.sprite, role: n.role, kind: n.kind, scale: n.scale, hired,
        x: hired ? this.companion.x : o[0] + n.at[0] + cell,
        y: hired ? this.companion.y : o[1] + n.at[1],
        z: hired ? this.companion.z : o[2] + n.at[2] + cell,
        extra: n.role === 'clock' ? h * 60 + m : 0,
      };
    });
  }

  /** The person or prop whose box the ray hits first within reach, or null. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist = REACH): { npc: NpcDef; distance: number } | null {
    let best: { npc: NpcDef; distance: number } | null = null;
    for (const v of this.views()) {
      const half = v.kind === 'prop' ? 0.55 : 0.38 * v.scale;
      const height = v.kind === 'prop' ? 1.4 : 2.0 * v.scale;
      const t = rayBox(ox, oy, oz, dx, dy, dz, v.x - half, v.y, v.z - half, v.x + half, v.y + height, v.z + half);
      if (t !== null && t <= maxDist && (!best || t < best.distance)) best = { npc: NPCS.find((n) => n.id === v.id)!, distance: t };
    }
    return best;
  }

  /** Use on a person or prop: true when something was spoken to (the Use is spent). */
  talk(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): boolean {
    const hit = this.raycast(ox, oy, oz, dx, dy, dz);
    if (!hit) return false;
    if (this.cooldownS > 0) return true;
    this.cooldownS = 0.8;
    this.speak(hit.npc);
    return true;
  }

  private say(npc: NpcDef, line: string): void {
    this.bus.emit('npc:say', { id: npc.id, role: npc.role, name: npc.name, title: npc.title, text: line });
  }

  private toast(text: string): void {
    this.bus.emit('toast', { text, kind: 'good' });
  }

  private phase(): Phase {
    const p = phaseAt(this.host?.timeOfDay() ?? 0.3);
    return p === 'dawn' ? 'morning' : p === 'dusk' ? 'evening' : p;
  }

  /** True the first time in a while this person is spoken to (they greet). */
  private greeting(npc: NpcDef): boolean {
    const last = this.greetedAt.get(npc.id) ?? -1e9;
    if (this.clockS - last <= GREET_AFTER_S) return false;
    this.greetedAt.set(npc.id, this.clockS);
    return true;
  }

  /** What the person says or does when used. Returns the main line. */
  speak(npc: NpcDef): string {
    if (npc.role === 'board') return this.useBoard(npc);
    if (npc.role === 'clock') return this.useClock(npc);
    if (npc.role === 'hermit') return this.useHermit(npc);
    if (!this.gifted.has(npc.id) && npc.gift.length > 0) {
      this.gifted.add(npc.id);
      for (const g of npc.gift) this.host?.give(g.item, g.count);
      this.say(npc, npc.giftLine);
      return npc.giftLine;
    }
    if (npc.role === 'orc') return this.useOrc(npc);
    const n = (this.spoken[npc.id] ?? 0) + 1;
    this.spoken[npc.id] = n;
    const bank = npc.bank!;
    let line: string | null = null;
    // Odd visits: a hint for the goal (once) or the specialist's advice about what to do next; even visits: talk.
    if (n % 2 === 1) line = this.hint(npc) ?? (npc.role === 'witch' || npc.role === 'barkeep' || npc.role === 'artificer' ? this.host?.advice(npc.role) ?? null : null);
    if (line === null) line = this.lines.pick(npc.id, bank, this.phase(), { greeting: this.greeting(npc) });
    this.say(npc, line);
    return line;
  }

  /** The bank's hint for the current goal, once. */
  private hint(npc: NpcDef): string | null {
    const goal = this.host?.currentGoal() ?? null;
    const text = goal ? npc.bank?.hints[goal] : undefined;
    if (!goal || !text) return null;
    const key = `${npc.id}:${goal}`;
    if (this.heard.has(key)) return null;
    this.heard.add(key);
    return text;
  }

  // ---- the orc: hire him for coin ------------------------------------------------------------------------------

  private useOrc(npc: NpcDef): string {
    const fill = (s: string): string => s.replace('{cost}', String(HIRE_COST)).replace('{minutes}', String(Math.round(HIRE_SECONDS / 60)));
    if (this.companion.active) {
      const line = this.lines.from('orc-busy', ORC_HIRE.busy);
      this.say(npc, line);
      return line;
    }
    if (this.offerS > 0) {
      this.offerS = 0;
      if (this.coins < HIRE_COST) {
        const line = fill(this.lines.from('orc-poor', ORC_HIRE.poor));
        this.say(npc, line);
        return line;
      }
      this.coins -= HIRE_COST;
      const p = this.host?.companion.player();
      this.companion.hire(p?.x ?? 0, p?.y ?? 0, p?.z ?? 0);
      if (p && this.host) this.companion.placeNear(this.host.companion.world, p);
      const line = this.lines.from('orc-yes', ORC_HIRE.yes);
      this.say(npc, line);
      this.toast(`Gruk will fight beside you for ${Math.round(HIRE_SECONDS / 60)} minutes (-${HIRE_COST} coin, ${this.coins} left)`);
      return line;
    }
    const n = (this.spoken[npc.id] ?? 0) + 1;
    this.spoken[npc.id] = n;
    const talk = (n % 2 === 1 ? this.hint(npc) : null) ?? this.lines.pick(npc.id, npc.bank!, this.phase(), { greeting: this.greeting(npc) });
    this.say(npc, talk);
    if (this.coins >= HIRE_COST) {
      this.say(npc, fill(this.lines.from('orc-offer', ORC_HIRE.offer)));
      this.offerS = OFFER_WINDOW_S;
    } else this.say(npc, fill(this.lines.from('orc-poor', ORC_HIRE.poor)));
    return talk;
  }

  // ---- the board: bounties for the progression goals ------------------------------------------------------------

  /** Bounties done and not yet redeemed, in goal order. */
  pendingBounties(): { id: string; title: string; coin: number }[] {
    const done = this.host?.completed();
    if (!done) return [];
    return BOUNTIES.filter((b) => done.has(b.id) && !this.claimed.has(b.id));
  }

  /** The next goals not done yet (what the board offers now). */
  openBounties(limit = 3): { id: string; title: string; coin: number }[] {
    const done = this.host?.completed();
    return BOUNTIES.filter((b) => !(done?.has(b.id) ?? false)).slice(0, limit);
  }

  private useBoard(npc: NpcDef): string {
    const owed = this.pendingBounties();
    if (owed.length > 0) {
      const total = owed.reduce((s, b) => s + b.coin, 0);
      for (const b of owed) this.claimed.add(b.id);
      this.coins += total;
      const names = owed.slice(0, 3).map((b) => b.title).join(', ');
      this.toast(`Bounty paid: +${total} coin for ${owed.length} task${owed.length === 1 ? '' : 's'} (${names}${owed.length > 3 ? ', ...' : ''}). You have ${this.coins} coin.`);
    } else this.toast(`Quest board: no bounty to redeem. You have ${this.coins} coin.`);
    const open = this.openBounties(3);
    if (open.length > 0) this.toast(`Open bounties: ${open.map((b) => `${b.title} (${b.coin})`).join('; ')}`);
    return npc.name;
  }

  private useClock(npc: NpcDef): string {
    const text = `It is ${clockText(this.host?.timeOfDay() ?? 0)}, day ${this.host?.day() ?? 1}.`;
    this.toast(`${npc.name}: ${text}`);
    return text;
  }

  // ---- Old Bram: buys what you hold ---------------------------------------------------------------------------

  private useHermit(npc: NpcDef): string {
    const held = this.host?.held() ?? null;
    const bank = npc.bank!;
    if (!held) {
      const line = this.rng() < 0.5 ? this.lines.from('bram-nothing', HERMIT_NOTHING) : this.lines.pick(npc.id, bank, this.phase(), { greeting: this.greeting(npc) });
      this.say(npc, line);
      return line;
    }
    const mood = 0.7 + this.rng() * 0.7;
    const coin = stackPrice(held.item, held.count, mood);
    if (coin <= 0) {
      const line = 'That is not worth the air it takes to say so. Sorry.';
      this.say(npc, line);
      return line;
    }
    this.host!.takeHeld(held.count);
    this.coins += coin;
    const line = this.lines.from('bram-sale', HERMIT_SALE).replace('{count}', String(held.count)).replace('{item}', held.item.replace(/_/g, ' ')).replace('{coin}', String(coin));
    this.say(npc, line);
    if (this.rng() < 0.08) this.say(npc, this.lines.from('bram-joke', bank.rare.slice(0, 3)));
    return line;
  }

  // ---- time -----------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.clockS += dt;
    if (this.cooldownS > 0) this.cooldownS = Math.max(0, this.cooldownS - dt);
    if (this.offerS > 0) this.offerS = Math.max(0, this.offerS - dt);
    const host = this.host;
    if (!host || !this.at) return;
    if (this.companion.active) {
      const shout = this.companion.update(dt, host.companion);
      if (shout) this.toast(`Gruk, orc smith: "${this.lines.from('orc-fight', ORC_HIRE.fight)}"`);
      if (!this.companion.active) this.toast(`Gruk, orc smith: "${this.lines.from('orc-done', ORC_HIRE.done)}"`);
    }
    this.fireS -= dt;
    if (this.fireS <= 0) {
      this.fireS = 8;
      for (const [x, y, z] of FIRE_SPOTS) host.tendFire?.(this.at[0] + x, this.at[1] + y, this.at[2] + z);
    }
  }

  /** The welcome, once, the first tick of a new world. */
  greet(): void {
    if (this.greeted || !this.at) return;
    this.greeted = true;
    this.toast('The Hearth & Anvil. Talk to Mara, Rosa, Gruk and Orrin (Use on them), check the quest board by the door, and visit Old Bram out back.');
  }

  toJSON(): NpcSnapshot {
    const r2 = (n: number): number => Math.round(n * 100) / 100;
    return {
      v: 1, at: this.at ? [...this.at] : null, greeted: this.greeted, gifted: [...this.gifted], spoken: { ...this.spoken }, heard: [...this.heard],
      coins: this.coins, claimed: [...this.claimed], hiredS: Math.max(0, Math.round(this.companion.hiredS)),
      comp: [r2(this.companion.x), r2(this.companion.y), r2(this.companion.z)],
    };
  }

  load(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<NpcSnapshot>;
    const at = r.at;
    this.at = Array.isArray(at) && at.length === 3 && at.every((n) => Number.isFinite(n)) ? ([at[0], at[1], at[2]] as [number, number, number]) : null;
    this.greeted = r.greeted === true;
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
    this.gifted = new Set(strings(r.gifted));
    this.heard = new Set(strings(r.heard));
    this.claimed = new Set(strings(r.claimed));
    this.coins = typeof r.coins === 'number' && Number.isFinite(r.coins) ? Math.max(0, Math.floor(r.coins)) : 0;
    this.spoken = {};
    if (r.spoken && typeof r.spoken === 'object') for (const [k, v] of Object.entries(r.spoken)) if (typeof v === 'number' && Number.isFinite(v)) this.spoken[k] = v;
    const c = r.comp;
    if (typeof r.hiredS === 'number' && r.hiredS > 0 && Array.isArray(c) && c.length === 3 && c.every((n) => Number.isFinite(n))) {
      this.companion.hiredS = r.hiredS;
      [this.companion.x, this.companion.y, this.companion.z] = c as [number, number, number];
    } else this.companion.hiredS = 0;
  }
}

/** Distance along a ray to an axis-aligned box, or null (slab method). */
export function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number | null {
  let tmin = 0;
  let tmax = Infinity;
  for (const [o, d, lo, hi] of [[ox, dx, x0, x1], [oy, dy, y0, y1], [oz, dz, z0, z1]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
    } else {
      let a = (lo - o) / d;
      let b = (hi - o) / d;
      if (a > b) [a, b] = [b, a];
      tmin = Math.max(tmin, a);
      tmax = Math.min(tmax, b);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
