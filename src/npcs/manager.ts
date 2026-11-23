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
import { BEAT_S, DANCES, notesAt } from './jukebox';
import { LinePicker, clockHM, clockText, type Phase } from './dialogue';
import { BOUNTIES, stackPrice } from './economy';
import { HERMIT_NOTHING, HERMIT_SALE } from './scripts/hermit';
import { ORC_HIRE } from './scripts/orc';
import { FIRE_SPOTS, TAVERN_START, buildTavern } from './tavern';
import { FRIEND_LINES, GIFT_TRUST, REWARDS, TIERS, TRUST_MAX, likes, tierOf } from './friendship';
import { findPath, nearestCell, type Cell } from './nav';
import { DANCE_SPOTS, WALK_SPEED, spotFor, walk } from './routines';

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
  /** The jukebox is playing and this person dances to it. */
  dancing: boolean;
  /** Seconds since the jukebox started (the dance is a pure function of this). */
  danceS: number;
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
  juke?: boolean;
  /** Trust 0..100 per person, and the day of each person's last gift. */
  trust?: Record<string, number>;
  /** What Old Bram has bought, newest last: item, count, coin he paid. */
  shelf?: [string, number, number][];
  giftDay?: Record<string, number>;
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
const SHELF_MAX = 6;
const GREET_AFTER_S = 90;

export class NpcManager {
  at: [number, number, number] | null = null;
  greeted = false;
  coins = 0;
  /** The tavern jukebox is playing. */
  jukeboxOn = false;
  private beatS = 0;
  private danceS = 0;
  private beat = 0;
  readonly companion = new Companion();
  private gifted = new Set<string>();
  private spoken: Record<string, number> = {};
  private heard = new Set<string>();
  private claimed = new Set<string>();
  private trust: Record<string, number> = {};
  /** Sales Bram still holds and will sell back at the price he paid (newest last). */
  private shelf: { item: string; count: number; coin: number }[] = [];
  private buybackS = 0;
  private giftDay: Record<string, number> = {};
  /** Where each walking person is now (tavern-local x, z); filled from the routine on first use. */
  private readonly pos = new Map<string, [number, number]>();
  /** The route each walking person follows: the goal it was planned for and the cells still to cross. */
  private readonly routes = new Map<string, { goal: string; cells: Cell[] }>();
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

  /** Tavern-local x, z of a person or prop right now: walking their routine, or fixed. */
  private where(n: NpcDef): [number, number] {
    if (n.kind !== 'person') return [n.at[0], n.at[2]];
    const have = this.pos.get(n.id);
    if (have) return have;
    const s = spotFor(n.id, this.phase());
    const start: [number, number] = s ? [s[0], s[2]] : [n.at[0], n.at[2]];
    this.pos.set(n.id, start);
    return start;
  }

  /** Where a person is heading now (their routine spot for this part of the day). */
  target(n: NpcDef): [number, number] {
    const d = this.jukeboxOn ? DANCE_SPOTS[n.id] : undefined;
    if (d) return [d[0], d[2]];
    const s = spotFor(n.id, this.phase());
    return s ? [s[0], s[2]] : [n.at[0], n.at[2]];
  }

  /** One walking step along the planned route (replanned when the goal changes); straight when no route exists. */
  private step(n: NpcDef, dt: number): [number, number] {
    const here = this.where(n);
    const goal = this.target(n);
    const gk = `${goal[0]},${goal[1]}`;
    let route = this.routes.get(n.id);
    if (!route || route.goal !== gk) {
      const from = nearestCell(here[0], here[1]);
      const path = from ? findPath(from, goal) : null;
      route = { goal: gk, cells: path ? [...path] : [[goal[0], goal[1]]] };
      if (from && path && (Math.abs(from[0] - here[0]) > 0.01 || Math.abs(from[1] - here[1]) > 0.01)) route.cells.unshift(from);
      this.routes.set(n.id, route);
    }
    let budget = WALK_SPEED * dt;
    let p: [number, number] = here;
    while (budget > 1e-9 && route.cells.length) {
      const wp = route.cells[0];
      const d = Math.hypot(wp[0] - p[0], wp[1] - p[1]);
      p = walk(p, [wp[0], wp[1]], budget);
      if (d <= budget) {
        route.cells.shift();
        budget -= d;
      } else budget = 0;
    }
    return p;
  }

  /** Current trust of a person 0..100. */
  trustOf(id: string): number {
    return this.trust[id] ?? 0;
  }

  /** Where the hire fee stands: a close friend of Gruk pays a quarter less. */
  hireCost(): number {
    return this.trustOf('gruk') >= TIERS[1] ? Math.round(HIRE_COST * 0.75) : HIRE_COST;
  }

  views(): NpcView[] {
    const o = this.at;
    if (!o) return [];
    const { h, m } = clockHM(this.host?.timeOfDay() ?? 0);
    return NPCS.map((n) => {
      const hired = n.role === 'orc' && this.companion.active;
      const cell = n.kind === 'person' ? 0.5 : 0;
      const here = this.where(n);
      return {
        id: n.id, name: n.name, sprite: n.sprite, role: n.role, kind: n.kind, scale: n.scale, hired, dancing: this.jukeboxOn && n.kind === 'person' && DANCES(n.role) && !hired, danceS: this.danceS,
        x: hired ? this.companion.x : o[0] + here[0] + cell,
        y: hired ? this.companion.y : o[1] + n.at[1],
        z: hired ? this.companion.z : o[2] + here[1] + cell,
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
      // t = 0: the eye is inside them (someone walking through the player) - they are not what the player aims at.
      if (t !== null && t > 1e-6 && t <= maxDist && (!best || t < best.distance)) best = { npc: NPCS.find((n) => n.id === v.id)!, distance: t };
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
    if (npc.role === 'jukebox') return this.useJukebox(npc);
    const gift = npc.kind === 'person' ? this.giveGift(npc) : null;
    if (gift !== null) return gift;
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
    if (line === null) line = this.friendLine(npc) ?? this.lines.pick(npc.id, bank, this.phase(), { greeting: this.greeting(npc) });
    this.say(npc, line);
    return line;
  }

  /** A warmer line when you are friends (one visit in three), or null. */
  private friendLine(npc: NpcDef): string | null {
    const tier = tierOf(this.trustOf(npc.id));
    if (tier === 0 || this.rng() > 0.34) return null;
    const lines = FRIEND_LINES[npc.id]?.[tier - 1];
    return lines?.length ? lines[Math.floor(this.rng() * lines.length) % lines.length] : null;
  }

  /** Using a person with something they like in hand: one gift a day. Null when it is not a gift. */
  private giveGift(npc: NpcDef): string | null {
    const held = this.host?.held();
    if (!held || !likes(npc.id, held.item)) return null;
    const day = this.host?.day() ?? 1;
    if (this.giftDay[npc.id] === day) {
      if (npc.role === 'hermit') return null; // sell to him as usual
      const line = 'You are kind, but one gift a day is plenty. Thank you.';
      this.say(npc, line);
      return line;
    }
    this.giftDay[npc.id] = day;
    this.host?.takeHeld(1);
    const before = this.trustOf(npc.id);
    const after = Math.min(TRUST_MAX, before + GIFT_TRUST);
    this.trust[npc.id] = after;
    const line = 'Oh, that is just what I wanted. Thank you.';
    this.say(npc, line);
    this.toast(`${npc.name} likes it (trust ${after}/${TRUST_MAX})`);
    TIERS.forEach((t, i) => {
      if (before >= t || after < t) return;
      const r = REWARDS[npc.id]?.[i];
      if (!r) return;
      this.host?.give(r.item, r.count);
      this.say(npc, r.line);
      this.toast(`${npc.name} gives you ${r.count} ${r.item.replace(/_/g, ' ')}`);
    });
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
    const fill = (s: string): string => s.replace('{cost}', String(this.hireCost())).replace('{minutes}', String(Math.round(HIRE_SECONDS / 60)));
    if (this.companion.active) {
      const line = this.lines.from('orc-busy', ORC_HIRE.busy);
      this.say(npc, line);
      return line;
    }
    if (this.offerS > 0) {
      this.offerS = 0;
      if (this.coins < this.hireCost()) {
        const line = fill(this.lines.from('orc-poor', ORC_HIRE.poor));
        this.say(npc, line);
        return line;
      }
      this.coins -= this.hireCost();
      const p = this.host?.companion.player();
      this.companion.hire(p?.x ?? 0, p?.y ?? 0, p?.z ?? 0);
      if (p && this.host) this.companion.placeNear(this.host.companion.world, p);
      const line = this.lines.from('orc-yes', ORC_HIRE.yes);
      this.say(npc, line);
      this.toast(`Gruk will fight beside you for ${Math.round(HIRE_SECONDS / 60)} minutes (-${this.hireCost()} coin, ${this.coins} left)`);
      return line;
    }
    const n = (this.spoken[npc.id] ?? 0) + 1;
    this.spoken[npc.id] = n;
    const talk = (n % 2 === 1 ? this.hint(npc) : null) ?? this.lines.pick(npc.id, npc.bank!, this.phase(), { greeting: this.greeting(npc) });
    this.say(npc, talk);
    if (this.coins >= this.hireCost()) {
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

  /** Switches the jukebox: the girls and the other guys dance to it, Gruk does not. */
  private useJukebox(npc: NpcDef): string {
    this.jukeboxOn = !this.jukeboxOn;
    this.beatS = 0;
    this.beat = 0;
    this.danceS = 0;
    const text = this.jukeboxOn ? 'The jukebox starts up. Everyone but Gruk is on their feet.' : 'The jukebox winds down.';
    this.toast(`${npc.name}: ${text}`);
    return text;
  }

  private playJukebox(dt: number): void {
    const o = this.at;
    const j = NPCS.find((n) => n.role === 'jukebox');
    if (!o || !j) return;
    this.danceS += dt;
    this.beatS -= dt;
    let guard = 4;
    while (this.beatS <= 0 && guard-- > 0) {
      this.beatS += BEAT_S;
      for (const n of notesAt(this.beat)) this.bus.emit('sfx', { name: 'jukebox_note', x: o[0] + j.at[0], y: o[1] + j.at[1] + 0.8, z: o[2] + j.at[2], pitch: n.pitch, volume: n.bass ? 0.7 : 1 });
      this.beat++;
    }
    if (guard <= 0) this.beatS = 0;
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
    if (!held && this.shelf.length > 0) return this.buyBack(npc);
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
    this.shelf.push({ item: held.item, count: held.count, coin });
    if (this.shelf.length > SHELF_MAX) this.shelf.shift();
    this.buybackS = 0;
    const line = this.lines.from('bram-sale', HERMIT_SALE).replace('{count}', String(held.count)).replace('{item}', held.item.replace(/_/g, ' ')).replace('{coin}', String(coin));
    this.say(npc, line);
    if (this.rng() < 0.08) this.say(npc, this.lines.from('bram-joke', bank.rare.slice(0, 3)));
    return line;
  }

  /** Empty hand with something on his shelf: the first Use names the last sale and its price, the second buys it back. */
  private buyBack(npc: NpcDef): string {
    const top = this.shelf[this.shelf.length - 1];
    const name = top.item.replace(/_/g, ' ');
    if (this.buybackS <= 0) {
      this.buybackS = OFFER_WINDOW_S;
      const line = `I still have your ${top.count} ${name}. ${top.coin} coin and it is yours again. Use me once more to say yes.`;
      this.say(npc, line);
      return line;
    }
    this.buybackS = 0;
    if (this.coins < top.coin) {
      const line = `${top.coin} coin, friend, and you carry ${this.coins}. Come back when you have it.`;
      this.say(npc, line);
      return line;
    }
    const left = this.host?.give(top.item, top.count) ?? top.count;
    const took = top.count - left;
    if (took <= 0) {
      const line = 'Your hands are full. Make room and ask me again.';
      this.say(npc, line);
      return line;
    }
    const paid = Math.round((top.coin * took) / top.count);
    this.coins -= paid;
    if (left > 0) {
      top.count = left;
      top.coin -= paid;
    } else this.shelf.pop();
    const line = `There. Back where it belongs. Do not let me catch you selling it twice.`;
    this.say(npc, line);
    this.toast(`Bought back ${took} ${name} for ${paid} coin (${this.coins} left)`);
    return line;
  }

  // ---- time -----------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.clockS += dt;
    if (this.cooldownS > 0) this.cooldownS = Math.max(0, this.cooldownS - dt);
    if (this.offerS > 0) this.offerS = Math.max(0, this.offerS - dt);
    if (this.buybackS > 0) this.buybackS = Math.max(0, this.buybackS - dt);
    const host = this.host;
    if (!host || !this.at) return;
    if (this.jukeboxOn) this.playJukebox(dt);
    for (const n of NPCS) {
      if (n.kind !== 'person' || (n.role === 'orc' && this.companion.active)) continue;
      this.pos.set(n.id, this.step(n, dt));
    }
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
      comp: [r2(this.companion.x), r2(this.companion.y), r2(this.companion.z)], juke: this.jukeboxOn,
      trust: { ...this.trust }, giftDay: { ...this.giftDay }, shelf: this.shelf.map((s) => [s.item, s.count, s.coin] as [string, number, number]),
    };
  }

  load(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<NpcSnapshot>;
    const at = r.at;
    this.at = Array.isArray(at) && at.length === 3 && at.every((n) => Number.isFinite(n)) ? ([at[0], at[1], at[2]] as [number, number, number]) : null;
    this.greeted = r.greeted === true;
    this.jukeboxOn = r.juke === true;
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
    this.gifted = new Set(strings(r.gifted));
    this.heard = new Set(strings(r.heard));
    this.claimed = new Set(strings(r.claimed));
    this.coins = typeof r.coins === 'number' && Number.isFinite(r.coins) ? Math.max(0, Math.floor(r.coins)) : 0;
    this.trust = {};
    this.giftDay = {};
    for (const [src, dst] of [[r.trust, this.trust], [r.giftDay, this.giftDay]] as const) {
      if (src && typeof src === 'object') for (const [k, v] of Object.entries(src)) if (typeof v === 'number' && Number.isFinite(v)) dst[k] = Math.max(0, Math.min(src === r.trust ? TRUST_MAX : 1e6, v));
    }
    this.pos.clear();
    this.routes.clear();
    this.shelf = [];
    for (const e of Array.isArray(r.shelf) ? r.shelf : []) {
      if (Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1]) && Number.isFinite(e[2]) && e[1] > 0 && e[2] >= 0) this.shelf.push({ item: e[0], count: Math.floor(e[1]), coin: Math.floor(e[2]) });
    }
    this.shelf = this.shelf.slice(-SHELF_MAX);
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
