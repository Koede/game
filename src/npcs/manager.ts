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
import { FIXTURES, NPCS, VISITORS, type NpcDef, type NpcRole, type NpcSprite } from './data';
import { BEAT_S, DANCES, notesAt } from './jukebox';
import { LinePicker, clockHM, clockText, type Phase } from './dialogue';
import { BOUNTIES, stackPrice } from './economy';
import { HERMIT_NOTHING, HERMIT_SALE } from './scripts/hermit';
import { ORC_HIRE } from './scripts/orc';
import { TRADER_FULL, TRADER_WANT_SHORT, TRADER_WANT_THANKS } from './scripts/trader';
import type { PhraseBank } from './scripts/types';
import { traderBank, traderHere, traderStock, traderVisitOn, traderWant, type TraderLine, type TraderVisit, type TraderWant } from './trader';
import { FIRE_SPOTS, GUEST_BEDS, PARTY_BUTTON, TAVERN_D, TAVERN_START, TAVERN_W, buildTavern } from './tavern';
import { BUILDER_ID, MOVABLE, TownBuilder, movable, type StockCrate, type TownHost, type TownSnapshot } from './townBuilder';
import { LODGE_FIRES, LODGE_NAMES, LODGE_PATH, LODGE_ROUTINE, LODGE_SPAWN, lodgeItems, type LodgeKey } from './lodge';
import { BuildBoard, bayBoardSpot, describeBounty, lockNote, reputationStep, unlockedAt } from './buildBoard';
import { CAMP_D, CAMP_FIRES, CAMP_ROUTINES, CAMP_START, CAMP_W, buildCamp, pickCampSite } from './camp';
import type { SurfaceFn } from './townPlan';
import type { Spot } from './routines';
import { FRIEND_LINES, GIFT_TRUST, REWARDS, TIERS, TRUST_MAX, likes, tierOf } from './friendship';
import { findPath, nearestCell, type Cell } from './nav';
import { warmerSpot } from './warmth';
import { ROUTINES } from './routines';
import { DANCE_SPOTS, TRADER_GATE, TRADER_SETTLE, WALK_SPEED, spotFor, walk } from './routines';
import { SWIM_SPOTS, chooseOutfit, coolOffAt, inPool, type Outfit } from './outfits';
import { ServiceMenu, type Service, type TavernPort } from './services';
import { ROOM_SERVICE } from './rooms';
import { FavourBoard, type Favour } from './favours';
import { festivalOn, festivalServices, newFestivalState, type FestivalState } from './festival';
import { Upkeep, stockLine, stockValue, upkeepServices } from './upkeep';
import { sparLevel, sparService, type SparState } from './sparring';
import { HEAR_RANGE, advance, bubbleOf, eligible, slotAt, type Running } from './gossip';
import { JobBoard, KIND_NAMES, aptitudeOf, type JobKind, type JobsPort, type JobsWorld, type Stop } from './jobs';
import { DRINKS, TONICS, drinkService, type DrinkLog, type TavernBuff } from './drinks';
import { newcomerLine, type Arrival, type Newcomer, type TownFacts } from './moveIn';
import { ARRIVAL_LINES, BED_ROOM, LODGE_COMMON, LODGE_ROOMS, LODGE_SLEEP, Settlement, lodgeRooms, nameOfPerson, sampleTags, townContentment, type SettlementSnapshot } from './settlement';
import { bedOfRoom, scanRooms } from './housingScan';
import { CAMP as CAMP_ROOM, type RoomInput } from './housingView';
import { favourRate, lineTone, priceFactor } from './contentment';
import { DAY_BUDGET } from './townBuilder';
import { townTemplate } from './townTemplates';
import { REPUTATION_STEPS, UNLOCK_REP } from './buildBoard';
import { moodLabel, waitingText, type TownPage } from './townPage';
import { CAMP_GOALS, currentGoal, doneGoals, type CampFacts, type CampGoal } from '../game/campGoals';
import { LODGE_D, LODGE_W } from './lodge';

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
  /** A speech bubble over their head (overheard gossip), or null. */
  bubble: string | null;
  /** What they wear: day clothes, sleepwear (at night) or swimwear (in the pool). Derived, never saved. */
  outfit: Outfit;
  /** The party is on (everyone in swimwear; people without a dance bounce on the spot). */
  party: boolean;
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
  /** The party switch behind the bar, and whether the jukebox was already on before it. */
  party?: boolean;
  partyJuke?: boolean;
  /** Trust 0..100 per person, and the day of each person's last gift. */
  trust?: Record<string, number>;
  /** What Old Bram has bought, newest last: item, count, coin he paid. */
  shelf?: [string, number, number][];
  giftDay?: Record<string, number>;
  /** Rosa's drinks served on `day`. */
  drinks?: { day: number; n: Record<string, number> };
  /** Gossip: the slot last held (`day:slot`) and the exchanges heard, newest last. */
  gossip?: { last: string; said: string[] };
  /** Favours pinned to the quest board (favours.ts). */
  favours?: ReturnType<FavourBoard['toJSON']>;
  /** Sparring with Gruk: bouts fought, and the day's tally. */
  spar?: SparState;
  /** The bar's stock, till and upgrades (upkeep.ts). */
  upkeep?: ReturnType<Upkeep['toJSON']>;
  /** The seasonal festival: contests entered (by festival day), medals won, and whether it switched the jukebox on. */
  festival?: FestivalState;
  /** The wandering trader's visit under way (trader.ts): its start day, the units left per stock line, and whether the wanted favour is done. */
  trader?: { visit: number; left: number[]; wantDone: boolean };
  /** Gruk's town build (townBuilder.ts): the plan, the progress and the storage bay's stock. */
  town?: TownSnapshot;
  /** Who lives here now (ids in NPCS). Absent in old saves: everyone does. */
  present?: string[];
  /** The camp stands in place of the tavern (a new world); absent in old saves. */
  camp?: boolean;
  /** Who lives in which room, the move-in clock and the arrival log (settlement.ts); absent in old saves. */
  settle?: SettlementSnapshot;
  /** Camp goals done and the flags that feed them (campGoals.ts); absent in old saves. */
  goals?: { done: string[]; flags: string[] };
  /** What each resident carries between two stops (jobs.ts); absent in old saves. */
  jobs?: ReturnType<JobBoard['toJSON']>;
}

/** What the manager needs from the game. */
/** The town's state as the debug handle reports it (NpcManager.townDebug). */
export interface TownDebug {
  site: [number, number] | null;
  building: string | null;
  base: number | null;
  waiting: string | null;
  rep: number;
  board: { spot: { x: number; y: number; z: number } | null; placed: boolean; bounties: { id: string; item: string; left: number; coin: number; template: string }[] };
  bay: { x: number; z: number; rot: number; base: number } | null;
  crate: { x: number; y: number; z: number } | null;
  front: { x: number; y: number; z: number } | null;
  stock: Record<string, number>;
  missing: { item: string; count: number }[];
  stage: number;
  progress: { cell: number; laid: number; cells: number; blocked: number; skips: string[]; next: { x: number; y: number; z: number; block: string; dig: boolean; stage: number } | null };
  coins: number;
  planned: { template: string; x: number; z: number; rot: number } | null;
  /** The whole queue, in build order (as it stands: unlocked buildings may have been moved forward). */
  plan: { template: string; x: number; z: number; rot: number }[];
}

export interface NpcHost {
  /** Lights or darkens the jukebox block's lamp (its active bit). False when the chunk is not loaded or the block is not there. */
  setBlockActive?(x: number, y: number, z: number, on: boolean): boolean;
  give(item: string, count: number): number;
  currentGoal(): string | null;
  completed(): ReadonlySet<string>;
  timeOfDay(): number;
  day(): number;
  /** The world's seed (the trader's visits and stock are drawn from it). */
  worldSeed?(): number;
  /** Degrees C a spot is warmer than outside (heat zones, src/npcs/warmth.ts warmthDelta); absent until that is wired, then 0 everywhere. */
  roomWarmth?(x: number, y: number, z: number): number;
  /** What the move-in triggers ask about the player (magic met, the distillery reached); absent: neither. */
  townFacts?(): { magic: boolean; alchemy: boolean };
  /** The stack in the player's hand, or null. */
  held(): { item: string; count: number } | null;
  takeHeld(count: number): void;
  /** Progression advice for a specialist (magic, brewing, tech), or null when there is none. */
  advice(role: 'witch' | 'barkeep' | 'artificer' | 'alchemist'): string | null;
  /** Air temperature in C at a world cell (src/game/thermal.ts). Absent: nobody seeks warmth. */
  temperatureAt?(x: number, y: number, z: number): number;
  /** Keeps a hearth in the tavern burning. */
  tendFire?(x: number, y: number, z: number): void;
  /** Skips the night to dawn: rested, warm (a paid bed). */
  sleepToDawn?(bed?: { x: number; y: number; z: number }): void;
  /** Gives the player a timed buff (Rosa's drinks). */
  grantBuff?(buff: TavernBuff, seconds: number): void;
  /** Whether the trade caravan is in town today, and a way to open its screen. */
  caravanPresent?(): boolean;
  openCaravan?(): void;
  /** Ground under a column: the top solid block, or null when not loaded (townBuilder.ts). */
  townSurface?(x: number, z: number): { y: number; key: string } | null;
  /** The block key at a cell, or null when its chunk is not loaded. */
  townBlock?(x: number, y: number, z: number): string | null;
  /** True when the player (or anything but the world's generation) changed the cell. */
  townEdited?(x: number, y: number, z: number): boolean;
  /** Sets a block (or 'air') with the 'town' source. False when the chunk is not loaded. */
  townPlace?(x: number, y: number, z: number, block: string, facing: number): boolean;
  /** The storage bay's stock crate at a cell, as an inventory over its slots (null when there is no crate there). */
  townCrate?(x: number, y: number, z: number): StockCrate | null;
  /** The containers and machines a resident's job carries between (jobs.ts); absent in tests without a workshop. */
  jobs?: JobsWorld;
  companion: CompanionHost;
}

const REACH = 3.4;
const OFFER_WINDOW_S = 10;
const SHELF_MAX = 6;
const GREET_AFTER_S = 90;
const TRADER_ID = 'pell';
/** The person who lives in a new world's camp and builds the town (`BUILDER_ID`, townBuilder.ts; Orrin joins later). */
export { BUILDER_ID };
/** Who answers for each specialist role's advice; when they do not live here yet, the builder gives the general advice. */
const SPECIALIST: Readonly<Record<'witch' | 'barkeep' | 'artificer' | 'alchemist', string>> = { witch: 'mara', barkeep: 'rosa', artificer: 'orrin', alchemist: 'veyra' };

/** The trader right now, for the UI and the tests (see NpcManager.trader). */
export interface TraderStatus {
  start: number;
  leave: number;
  here: boolean;
  stock: { item: string; left: number; price: number; rare: boolean }[];
  want: TraderWant;
  wantDone: boolean;
}

/** `{key}` placeholders filled in from `v`. */
const fillIn = (s: string, v: Record<string, string | number>): string => Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);
const nameOf = (item: string): string => item.replace(/_/g, ' ');

export class NpcManager {
  at: [number, number, number] | null = null;
  greeted = false;
  coins = 0;
  /** The tavern jukebox is playing. */
  jukeboxOn = false;
  /** The party button behind the bar is on: everyone in swimwear and dancing. */
  partyOn = false;
  private jukeBeforeParty = false;
  private partyLamp: boolean | null = null;
  /** What the jukebox block's lamp last showed (null: not yet set this session). */
  private lamp: boolean | null = null;
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
  /** The trader's visit under way: its start day, the units left per stock line, and whether the wanted favour is done. */
  private trade: { visit: number; left: number[]; wantDone: boolean } | null = null;
  /** The visit's stock, want and phrase bank, drawn from the seed (rebuilt when the visit changes). */
  private traderCache: { visit: number; lines: TraderLine[]; want: TraderWant; bank: PhraseBank } | null = null;
  /** The stall: one service per stock line (a Use pitches it, a second Use inside the window buys one unit). */
  private traderMenu: ServiceMenu | null = null;
  /** Whether the trader was in the yard at the last tick (null: not yet known this session, so no arrival is announced). */
  private traderWas: boolean | null = null;
  /** Where each walking person is now (tavern-local x, z); filled from the routine on first use. */
  private readonly pos = new Map<string, [number, number]>();
  /** The route each walking person follows: the goal it was planned for and the cells still to cross. */
  private readonly routes = new Map<string, { goal: string; cells: Cell[] }>();
  /** The camp stands in place of the tavern (a new world): no tavern features until `settle`. */
  camp = false;
  /** Who lives where, the nightly move-in roll and contentment (settlement.ts). */
  private readonly settlement = new Settlement();
  /** The rooms found by their bed in the world (housingScan.ts), refreshed on a night when they matter. */
  private builtRooms: RoomInput[] = [];
  private trackedLevel = -1;
  /** Camp goals seen done (campGoals.ts), the flags that feed them, and whether the first look after a load has passed. */
  private goalsDone = new Set<string>();
  private goalFlags = new Set<string>();
  private goalsReady = false;
  /** Who lives here now (ids in NPCS). Only these are drawn, walk, talk, and count for gated features. */
  private people = new Set<string>(NPCS.map((n) => n.id));
  private host: NpcHost | null = null;
  private cooldownS = 0;
  private offerS = 0;
  private fireS = 0;
  private clockS = 0;
  private readonly greetedAt = new Map<string, number>();
  private readonly lines: LinePicker;
  /** What Rosa sells (rooms, drinks, ...): see services.ts. */
  private readonly favours = new FavourBoard();
  private spar: SparState = { xp: 0, day: 0, today: 0 };
  /** What Gruk sells besides his arm: a bout in the hall. */
  private readonly gruk = new ServiceMenu([sparService(() => this.spar)]);
  private gossip: Running | null = null;
  private gossipLast = '';
  private gossipSaid: string[] = [];
  private drinkLog: DrinkLog = { day: 0, n: {} };
  private readonly bar = new Upkeep();
  /** Templates start once the town stands at their standing (buildBoard.ts UNLOCK_REP). */
  private readonly town = new TownBuilder((t) => unlockedAt(t, this.board.rep));
  /** Gruk's building board: bounties for the current stage and the town's reputation (buildBoard.ts). */
  private readonly board = new BuildBoard();
  readonly jobs = new JobBoard();
  /** A stop being picked: the next Use on a block sets it (see jobPick). */
  private picking: { id: string; which: 'from' | 'to' } | null = null;
  private fest: FestivalState = newFestivalState();
  private festNow = false;
  /** Veyra's tonics (drinks.ts): a swift and a mending draught, a few a day. */
  private readonly veyra = new ServiceMenu(TONICS.map((d) => drinkService(d, () => this.drinkLog)));
  private readonly rosa = new ServiceMenu([ROOM_SERVICE, ...upkeepServices(() => this.bar), ...festivalServices(() => this.fest, () => this.bar.built.has('stage')), ...DRINKS.map((d) => drinkService(d, () => this.drinkLog))]);

  constructor(private readonly bus: GameBus, private readonly rng: () => number = Math.random) {
    this.lines = new LinePicker(rng);
    bus.on?.('flag', ({ flag }) => {
      if (flag === 'well_warmed' || flag === 'rested') this.goalFlags.add(flag);
    });
  }

  bind(host: NpcHost): void {
    this.host = host;
  }

  get present(): boolean {
    return this.at !== null;
  }

  /** Whether a person lives here now (a new world has only the builder until the others move in). */
  isPresent(id: string): boolean {
    return this.people.has(id);
  }

  /**
   * How many lodge stages stand (lodge.ts, 0..5): 0 at the camp, 1 once the lodge's bedroom is up, 5 for the full Hearth & Anvil.
   * An old town whose plan has no lodge (or a save from before the lodge) has its tavern already.
   */
  get tavernLevel(): number {
    if (!this.at) return 0;
    if (!this.camp && !this.town.hasLodge()) return LODGE_PATH.length;
    return this.town.lodgeLevel();
  }

  /**
   * The tavern stands: the hall, its fixtures, the trader and the festival are on. Only after the lodge's last stage (or an old
   * world, or `settle`): the lodge's earlier stages switch on their own features (`tavernLevel`).
   */
  get hasTavern(): boolean {
    return this.at !== null && !this.camp && this.tavernLevel >= LODGE_PATH.length;
  }

  /**
   * Where the player wakes after a respawn without a home furnace: the lodge's first bedroom once it stands, the guest bed once the
   * upper floor does. Null while the camp is still the spawn point (and in worlds with no lodge).
   */
  bedSpawn(): { x: number; y: number; z: number } | null {
    const o = this.at;
    const level = this.tavernLevel;
    if (!o || this.camp || level < 1) return null;
    if (level >= 4) return { x: o[0] + GUEST_BEDS[0][0], y: o[1] + GUEST_BEDS[0][1], z: o[2] + GUEST_BEDS[0][2] };
    return { x: o[0] + LODGE_SPAWN[0] + 0.5, y: o[1] + LODGE_SPAWN[1], z: o[2] + LODGE_SPAWN[2] + 0.5 };
  }

  private presentCount(): number {
    return NPCS.filter((n) => this.people.has(n.id)).length;
  }

  /**
   * Starts a NEW world at a camp on flat ground near the spawn (sx, sz): Gruk's cart, a fire and two bedrolls, and only Gruk
   * lives there. Returns the player's start, or null when no ground near the spawn will take it.
   */
  startCamp(world: IWorld, sx: number, sz: number): { x: number; y: number; z: number } | null {
    const surface: SurfaceFn = (x, z) => {
      if (!world.isLoaded(x, z)) return null;
      const y = world.surfaceY(x, z);
      return y < 0 ? null : { y, key: world.getBlock(x, y, z).key };
    };
    const site = pickCampSite(surface, Math.floor(sx), Math.floor(sz));
    if (!site || !buildCamp(world, site[0], site[1], site[2])) return null;
    this.at = [...site];
    this.camp = true;
    this.people = new Set([BUILDER_ID]);
    this.pos.clear();
    this.routes.clear();
    return { x: site[0] + CAMP_START[0] + 0.5, y: site[1] + CAMP_START[1], z: site[2] + CAMP_START[2] + 0.5 };
  }

  /**
   * Dev skip (window.__hw.settle): builds the full tavern on the camp's origin and everyone moves in. Returns the player's start in
   * the hall, or null when there is no camp to settle (an old world already has its tavern).
   */
  settle(world: IWorld): { x: number; y: number; z: number } | null {
    const o = this.at;
    // The camp, or the lodge part-way up: the full tavern goes on the same origin (the lodge's cells are its own).
    if (!o || this.tavernLevel >= LODGE_PATH.length || !buildTavern(world, o[0], o[1], o[2])) return null;
    this.town.finishLodge();
    this.camp = false;
    this.people = new Set(NPCS.map((n) => n.id));
    this.pos.clear();
    this.routes.clear();
    return { x: o[0] + TAVERN_START[0] + 0.5, y: o[1] + TAVERN_START[1], z: o[2] + TAVERN_START[2] + 0.5 };
  }

  /** Builds the full tavern with its start cell on x, z, the floor at ground level y; everyone lives there. Returns the player's start. */
  buildStart(world: IWorld, cx: number, groundY: number, cz: number): { x: number; y: number; z: number } | null {
    const ox = Math.floor(cx) - TAVERN_START[0];
    const oz = Math.floor(cz) - TAVERN_START[2];
    if (!buildTavern(world, ox, groundY, oz)) return null;
    this.at = [ox, groundY, oz];
    this.camp = false;
    this.people = new Set(NPCS.map((n) => n.id));
    return { x: ox + TAVERN_START[0] + 0.5, y: groundY + TAVERN_START[1], z: oz + TAVERN_START[2] + 0.5 };
  }

  /** Where a person stands in `phase`: the camp's spot for the builder while the camp stands, else their tavern routine. */
  private spot(n: NpcDef, phase: Phase): Spot | null {
    const own = this.baseSpot(n, phase);
    return own && (phase === 'evening' || phase === 'night') ? this.warmerThan(own, phase) : own;
  }

  private baseSpot(n: NpcDef, phase: Phase): Spot | null {
    if (this.camp) return CAMP_ROUTINES[n.id]?.[phase as 'morning'] ?? null;
    // Only the lodge stands: Gruk keeps to the common room by the hearth (the tavern's own spots are not built yet).
    if (n.id === BUILDER_ID && this.tavernLevel < LODGE_PATH.length) return LODGE_ROUTINE;
    // Only the lodge stands: the newcomers keep to the common room by day and sleep in their bedroom at night.
    if (this.tavernLevel < LODGE_PATH.length) return this.lodgeSpot(n.id, phase);
    return spotFor(n.id, phase);
  }

  /** On a cold evening or night (thermal.ts) a person takes the warmest spot the routines already use, if it is clearly warmer. */
  private warmerThan(own: Spot, phase: Phase): Spot {
    const host = this.host;
    const o = this.at;
    if (!host?.temperatureAt || !o) return own;
    const routines = this.camp ? CAMP_ROUTINES : ROUTINES;
    const candidates: Spot[] = [];
    for (const r of Object.values(routines)) {
      const c = r[phase as 'morning'];
      if (c) candidates.push(c);
    }
    return warmerSpot(own, candidates, (x, y, z) => host.temperatureAt!(o[0] + x, o[1] + y, o[2] + z));
  }

  /** Tavern-local x, z of a person or prop right now: walking their routine, or fixed. */
  private where(n: NpcDef): [number, number] {
    if (n.kind !== 'person') return [n.at[0], n.at[2]];
    const have = this.pos.get(n.id);
    if (have) return have;
    const s = n.role === 'trader' ? (this.traderHereNow() ? TRADER_SETTLE : TRADER_GATE) : this.spot(n, this.phase());
    const start: [number, number] = s ? [s[0], s[2]] : [n.at[0], n.at[2]];
    this.pos.set(n.id, start);
    return start;
  }

  /** Where a person is heading now (their routine spot for this part of the day). */
  target(n: NpcDef): [number, number] {
    if (n.role === 'trader') {
      const g = this.traderHereNow() ? TRADER_SETTLE : TRADER_GATE;
      return [g[0], g[2]];
    }
    const d = this.jukeboxOn ? DANCE_SPOTS[n.id] : undefined;
    if (d) return [d[0], d[2]];
    const sw = this.coolOff() ? SWIM_SPOTS[n.id] : undefined;
    if (sw) return [sw[0], sw[2]];
    const s = this.spot(n, this.phase());
    return s ? [s[0], s[2]] : [n.at[0], n.at[2]];
  }

  /** A hot midday (the warm season, outside the festival): the regulars cool off in the yard pool. */
  private coolOff(): boolean {
    const h = this.host;
    return !!h && this.hasTavern && coolOffAt(h.day(), h.timeOfDay());
  }

  /** One walking step along the planned route (replanned when the goal changes); straight when no route exists. */
  private step(n: NpcDef, dt: number): [number, number] {
    const here = this.where(n);
    const goal = this.target(n);
    const gk = `${goal[0]},${goal[1]}`;
    let route = this.routes.get(n.id);
    if (!route || route.goal !== gk) {
      const from = nearestCell(here[0], here[1], this.camp);
      const path = from ? findPath(from, goal, this.camp) : null;
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

  /** Distance in blocks between two people right now. */
  private apart(a: string, b: string): number {
    const na = NPCS.find((n) => n.id === a);
    const nb = NPCS.find((n) => n.id === b);
    if (!na || !nb || !this.isPresent(a) || !this.isPresent(b)) return Infinity;
    const [ax, az] = this.where(na);
    const [bx, bz] = this.where(nb);
    return Math.hypot(ax - bx, az - bz);
  }

  /** Starts the day's gossip when its slot is open, two regulars are close and the player is near enough to hear. */
  private tickGossip(dt: number): void {
    const host = this.host;
    const o = this.at;
    if (!host || !o) return;
    if (this.gossip) {
      this.gossip = advance(this.gossip, dt);
      return;
    }
    if (this.presentCount() < 2) return;
    const tod = host.timeOfDay();
    const slot = slotAt(tod);
    const key = `${host.day()}:${slot}`;
    if (slot < 0 || key === this.gossipLast) return;
    const p = host.companion.player();
    const near = (id: string): boolean => {
      if (!this.isPresent(id)) return false;
      const n = NPCS.find((x) => x.id === id)!;
      const [x, z] = this.where(n);
      return Math.hypot(o[0] + x - p.x, o[2] + z - p.z) <= HEAR_RANGE;
    };
    const pool = eligible(tod, (a, b) => this.apart(a, b), new Set(this.gossipSaid)).filter((e) => near(e.a) && near(e.b));
    if (pool.length === 0) return;
    const ex = pool[Math.min(pool.length - 1, Math.floor(this.rng() * pool.length))];
    this.gossipLast = key;
    this.gossipSaid.push(ex.id);
    this.gossipSaid = this.gossipSaid.slice(-6);
    this.gossip = { ex, at: 0, left: 4.2 };
  }

  /** The bar sells while the tavern is open (not at night); a turned day sells a night and collects rent. */
  private tickBar(dt: number): void {
    const host = this.host;
    // The bar counter is the lodge's second stage: nothing sells until it stands.
    if (!host || !this.at || this.tavernLevel < 2 || !this.isPresent('rosa')) return;
    this.bar.tick(dt, this.phase() !== 'night', this.rng);
    const got = this.bar.dayRoll(host.day(), this.rng);
    if (got > 0) this.toast(`While you were away the bar took ${got} coin. Ask Rosa for the till (${Math.floor(this.bar.till)} waiting).`);
  }

  /** The conversation running now, for the UI and tests: who speaks and what. */
  overheard(): { id: string; text: string } | null {
    return bubbleOf(this.gossip);
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
    const bubble = bubbleOf(this.gossip);
    return [...NPCS.filter((n) => this.isPresent(n.id)), ...VISITORS].filter((n) => n.role !== 'trader' || this.traderShown()).map((n) => {
      const hired = n.role === 'orc' && this.companion.active;
      const cell = n.kind === 'person' ? 0.5 : 0;
      const here = this.where(n);
      const road = !hired && n.kind === 'person' ? this.jobs.pose(n.id) : null;
      return {
        id: n.id, name: n.name, sprite: n.sprite, role: n.role, kind: n.kind, scale: n.scale, hired, party: this.partyOn && n.kind === 'person', dancing: this.jukeboxOn && n.kind === 'person' && DANCES(n.role) && !hired, danceS: this.danceS,
        x: hired ? this.companion.x : road ? road.x : o[0] + here[0] + cell,
        y: hired ? this.companion.y : road ? road.y : o[1] + n.at[1],
        z: hired ? this.companion.z : road ? road.z : o[2] + here[1] + cell,
        extra: n.role === 'clock' ? h * 60 + m : 0,
        bubble: bubble?.id === n.id ? bubble.text : null,
        outfit: n.kind === 'person' ? chooseOutfit({ phase: this.phase(), inWater: this.coolOff() && inPool(here[0], here[1]), dancing: this.jukeboxOn && DANCES(n.role), hired, party: this.partyOn && n.kind === 'person' }) : 'day',
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
      if (t !== null && t > 1e-6 && t <= maxDist && (!best || t < best.distance)) best = { npc: [...NPCS, ...VISITORS].find((n) => n.id === v.id)!, distance: t };
    }
    return best;
  }

  /** Use on a person or prop: true when something was spoken to (the Use is spent). */
  talk(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist = REACH): boolean {
    const hit = this.raycast(ox, oy, oz, dx, dy, dz);
    // Something nearer on the ray (a wall, an animal) is what the player aims at; props that are blocks themselves keep a margin.
    if (!hit || hit.distance > maxDist + (hit.npc.kind === 'prop' ? 0.75 : 0)) return false;
    if (this.cooldownS > 0) return true;
    this.cooldownS = 0.8;
    this.speak(hit.npc);
    return true;
  }

  private say(npc: NpcDef, line: string): void {
    this.bus.emit('npc:say', { id: npc.id, role: npc.role, name: npc.name, title: npc.title, text: line, work: this.canWork(npc.id) || undefined });
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

  /** Use on a fixture block (the quest board or the wall clock, placed by the tavern). Null when there is no such fixture. */
  useFixture(role: 'board' | 'clock' | 'jukebox' | 'party'): string | null {
    if (role === 'board' && this.atTownBoard()) return this.useTownBoard();
    if (!this.hasTavern) return null;
    if (role === 'party') return this.useParty();
    const npc = FIXTURES.find((n) => n.role === role);
    return npc ? this.speak(npc) : null;
  }

  /** What the person says or does when used. Returns the main line. */
  speak(npc: NpcDef): string {
    if (npc.kind === 'person' && npc.role !== 'trader' && !this.isPresent(npc.id)) return '';
    if (npc.role === 'board') return this.useBoard(npc);
    if (npc.role === 'clock') return this.useClock(npc);
    if (npc.role === 'jukebox') return this.useJukebox(npc);
    if (npc.role === 'trader') return this.useTrader(npc);
    const gift = npc.kind === 'person' ? this.giveGift(npc) : null;
    if (gift !== null) return gift;
    const stocked = this.stockBar(npc);
    if (stocked !== null) return stocked;
    if (npc.role === 'hermit') return this.useHermit(npc);
    if (!this.gifted.has(npc.id) && npc.gift.length > 0) {
      this.gifted.add(npc.id);
      for (const g of npc.gift) this.host?.give(g.item, g.count);
      this.say(npc, npc.giftLine);
      return npc.giftLine;
    }
    if (npc.role === 'orc') return this.useOrc(npc);
    if (npc.role === 'barkeep' || npc.role === 'alchemist') {
      const taken = (npc.role === 'barkeep' ? this.rosa : this.veyra).take(this.port(npc));
      if (taken !== null) {
        this.say(npc, taken);
        return taken;
      }
    }
    const n = (this.spoken[npc.id] ?? 0) + 1;
    this.spoken[npc.id] = n;
    const bank = npc.bank!;
    let line: string | null = null;
    // Odd visits: a hint for the goal (once) or the specialist's advice about what to do next; even visits: talk.
    if (n % 2 === 1) line = this.hint(npc) ?? (npc.role === 'witch' || npc.role === 'barkeep' || npc.role === 'artificer' || npc.role === 'alchemist' ? this.advice(npc.role) : null);
    if (line === null) line = this.friendLine(npc) ?? this.lines.pick(npc.id, bank, this.phase(), { greeting: this.greeting(npc) });
    this.say(npc, line);
    if (npc.role === 'barkeep' || npc.role === 'alchemist') {
      const pitch = (npc.role === 'barkeep' ? this.rosa : this.veyra).pitch(this.port(npc));
      if (pitch !== null) this.say(npc, pitch);
    }
    return line;
  }

  /** Rosa's menu and the port she serves from (a UI or a test buys by id). */
  serviceMenu(id: 'rosa' | 'gruk' | 'veyra' = 'rosa'): ServiceMenu {
    if (!this.isPresent(id) || (id === 'rosa' && this.tavernLevel < 2)) return new ServiceMenu([]);
    return id === 'gruk' ? this.gruk : id === 'veyra' ? this.veyra : this.rosa;
  }

  /** The festival night is on right now. */
  festivalNow(): boolean {
    return this.festNow;
  }

  /** Medals won at the festival contests, all time. */
  festivalRecord(): { gold: number; silver: number; bronze: number } {
    return { gold: this.fest.gold, silver: this.fest.silver, bronze: this.fest.bronze };
  }

  /** From dusk to dawn of a festival day the jukebox plays and the dancers dance (unless the player had it on already). */
  private tickFestival(): void {
    const host = this.host;
    if (!host || !this.at) return;
    const on = this.hasTavern && this.presentCount() >= 3 && festivalOn(host.day(), this.phase());
    if (on === this.festNow) return;
    this.festNow = on;
    if (on) {
      this.toast('The festival night begins at the Hearth & Anvil: music, dancing and three contests. Ask Rosa to enter.');
      if (!this.jukeboxOn) {
        this.jukeboxOn = true;
        this.beatS = 0;
        this.beat = 0;
        this.danceS = 0;
        this.fest.juke = true;
      }
    } else {
      this.toast('The festival is over. The hall is quiet again.');
      if (this.fest.juke && !this.partyOn) this.jukeboxOn = false;
      this.fest.juke = false;
    }
  }

  /** Progression advice from a specialist. When that person does not live here yet, the builder (Gruk) gives the general advice. */
  advice(role: 'witch' | 'barkeep' | 'artificer' | 'alchemist'): string | null {
    const r = this.isPresent(SPECIALIST[role]) ? role : 'artificer';
    return this.host?.advice(r) ?? null;
  }

  /** Units on Rosa's bar. */
  barStock(): number {
    return this.bar.units();
  }

  /** Coin in Rosa's till, waiting for the player. */
  till(): number {
    return this.bar.till;
  }

  /** Upgrades built so far ('stage', 'rooms2', 'rooms3'). */
  upgrades(): string[] {
    return [...this.bar.built];
  }

  /** Hands food or a brew to Rosa for the bar. Null when she is not the one spoken to or it is not stock. */
  private stockBar(npc: NpcDef): string | null {
    const held = this.host?.held();
    if (npc.role !== 'barkeep' || !held || stockValue(held.item) <= 0) return null;
    const took = this.bar.add(held.item, held.count);
    if (took <= 0) {
      const line = 'The bar is full to the rafters. Let it sell down first.';
      this.say(npc, line);
      return line;
    }
    this.host?.takeHeld(took);
    stockLine(this.port(npc), held.item, took, stockValue(held.item));
    const line = 'On the bar it goes. I will keep the books.';
    this.say(npc, line);
    return line;
  }

  /** Sparring skill 0..5 (bouts fought with Gruk). */
  sparSkill(): number {
    return sparLevel(this.spar.xp);
  }

  servicePort(id: string): TavernPort {
    return this.port(NPCS.find((n) => n.id === id)!);
  }

  /** What a service may touch (services.ts), speaking as `npc`. */
  private port(npc: NpcDef): TavernPort {
    return {
      host: this.host, rng: this.rng, phase: () => this.phase(), day: () => this.host?.day() ?? 1,
      coins: () => this.coins,
      spend: (n) => (this.coins >= n ? ((this.coins -= n), true) : false),
      earn: (n) => void (this.coins += n),
      trust: (id) => this.trustOf(id),
      mood: (id) => this.settlement.scoreOf(id),
      addTrust: (id, n) => void (this.trust[id] = Math.max(0, Math.min(TRUST_MAX, this.trustOf(id) + n))),
      say: (line) => this.say(npc, line),
      toast: (text) => this.toast(text),
      bed: (nth) => {
        // The guest beds are on the upper floor, the lodge's fourth stage.
        const o = this.tavernLevel >= 4 ? this.at : null;
        const free = this.bar.built.has('rooms2') ? GUEST_BEDS.length : 1;
        const b = o ? GUEST_BEDS[nth % free] : undefined;
        return b && o ? { x: o[0] + b[0], y: o[1] + b[1], z: o[2] + b[2] } : null;
      },
    };
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
      if (npc.role === 'barkeep' && stockValue(held.item) > 0) return null; // the rest goes on her bar
      const line = 'You are kind, but one gift a day is plenty. Thank you.';
      this.say(npc, line);
      return line;
    }
    this.giftDay[npc.id] = day;
    this.host?.takeHeld(1);
    const line = 'Oh, that is just what I wanted. Thank you.';
    this.say(npc, line);
    this.raiseTrust(npc, GIFT_TRUST, (after) => this.toast(`${npc.name} likes it (trust ${after}/${TRUST_MAX})`));
    return line;
  }

  /** Adds trust (capped) and pays each tier reward newly reached; `between` runs after the trust is set and before the rewards. */
  private raiseTrust(npc: NpcDef, n: number, between?: (after: number) => void): number {
    const before = this.trustOf(npc.id);
    const after = Math.min(TRUST_MAX, before + n);
    this.trust[npc.id] = after;
    between?.(after);
    TIERS.forEach((t, i) => {
      if (before >= t || after < t) return;
      const r = REWARDS[npc.id]?.[i];
      if (!r) return;
      this.host?.give(r.item, r.count);
      this.say(npc, r.line);
      this.toast(`${npc.name} gives you ${r.count} ${r.item.replace(/_/g, ' ')}`);
    });
    return after;
  }

  /** The favours pinned to the board now. */
  pinnedFavours(): Favour[] {
    return this.favours.list().filter((f) => this.isPresent(f.who));
  }

  /** Hands in a favour held in the player's stack. Null when the board wants nothing they hold. */
  private deliverFavour(npc: NpcDef): string | null {
    const held = this.host?.held();
    if (!held) return null;
    const f = this.favours.matching(held.item, held.count);
    if (!f) {
      const w = this.favours.wanting(held.item);
      if (!w) return null;
      this.toast(`Favour: ${w.ask} You hold ${held.count}, it needs ${w.count}.`);
      return npc.name;
    }
    const who = NPCS.find((n) => n.id === f.who);
    this.host?.takeHeld(f.count);
    this.coins += f.coin;
    this.favours.complete(f.id, this.host?.day() ?? 1);
    if (who) this.raiseTrust(who, f.trust);
    this.toast(`Favour done for ${who?.name ?? f.who}${f.coin ? `: +${f.coin} coin` : ''}${f.trust ? `, +${f.trust} trust` : ''}. ${f.thanks}`);
    return npc.name;
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
    const bout = this.gruk.take(this.port(npc));
    if (bout !== null) {
      this.say(npc, bout);
      return bout;
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
    // Odd visits offer his arm for hire; even visits offer a bout in the hall.
    const bout2 = n % 2 === 0 ? this.gruk.pitch(this.port(npc)) : null;
    if (bout2 !== null) this.say(npc, bout2);
    else if (this.coins >= this.hireCost()) {
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

  /** Whether the player stands at Gruk's building board (inside the storage bay): Use there is for the build bounties. */
  private atTownBoard(): boolean {
    const s = this.board.spot;
    const p = this.host?.companion.player();
    if (!s || !this.board.placed || !p) return false;
    return Math.abs(p.x - s.x) <= 6 && Math.abs(p.z - s.z) <= 6 && Math.abs(p.y - s.y) <= 4;
  }

  /** Use on the building board: a held stack that matches a bounty is handed in; otherwise the open bounties are read out. */
  private useTownBoard(): string {
    const held = this.host?.held() ?? null;
    if (held && this.deliverBuild(held.item, held.count)) return 'Build board';
    const open = this.board.list();
    const standing = reputationStep(this.board.rep).name;
    const waiting = this.town.waitingOn();
    if (open.length === 0 && waiting) this.toast(`Build board: ${lockNote(waiting, this.board.rep) ?? `${this.builderName()} is waiting.`} Town standing: ${standing} (${this.board.rep}).`);
    else if (open.length === 0) this.toast(`Build board: ${this.builderName()} has nothing waiting on materials. Town standing: ${standing} (${this.board.rep}).`);
    else this.toast(`Build board: ${open.map(describeBounty).join('; ')}. Town standing: ${standing} (${this.board.rep}). Hold the items and use the board to hand them in.`);
    return 'Build board';
  }

  /** Hands held materials to a build bounty: they go into the storage bay, and pay coin, town standing and Gruk's trust. */
  private deliverBuild(item: string, count: number): boolean {
    const b = this.board.matching(item);
    const pay = b ? this.board.deliver(b.id, count) : null;
    if (!pay) return false;
    this.host?.takeHeld(pay.take);
    this.town.deliver(item, pay.take);
    this.coins += pay.coin;
    if (pay.reward) this.host?.give(pay.reward.item, pay.reward.count);
    const builder = NPCS.find((n) => n.id === BUILDER_ID);
    if (builder && pay.trust > 0) this.raiseTrust(builder, pay.trust);
    const rare = pay.reward ? `, and a ${pay.reward.item.replace(/_/g, ' ')}` : '';
    this.toast(`Build board: ${pay.take} ${item.replace(/_/g, ' ')} into the storage bay. +${pay.coin} coin, +${pay.rep} town standing${pay.trust ? `, +${pay.trust} trust with ${this.builderName()}` : ''}${rare}.`);
    this.refreshBoard(this.host);
    return true;
  }

  /** Redraws the board from the builder's needs: when a bounty is filled, or the stage moves on. */
  private refreshBoard(host: NpcHost | null | undefined): void {
    const cur = this.town.currentTemplate;
    const stage = this.town.stage();
    this.board.refresh(cur && stage >= 0 ? { template: cur, stage } : null, this.town.missing(), host?.worldSeed?.() ?? 0);
  }

  /**
   * Places the board block in the storage bay's floor row once the spot is known (the bay is being raised; the board does not
   * wait for it to stand, so the first materials can be handed in). Waits while the cell holds something that is not movable.
   */
  private placeBoard(host: NpcHost): void {
    const s = this.board.spot;
    if (!s || this.board.placed || !host.townBlock || !host.townPlace) return;
    const key = host.townBlock.call(host, s.x, s.y, s.z);
    if (key === null) return;
    if (key === 'quest_board') this.board.placed = true;
    else if (key === 'air' || movable(key)) this.board.placed = host.townPlace.call(host, s.x, s.y, s.z, 'quest_board', s.facing);
  }

  /** Dev skip (the lodge's e2e): `n` of every block the lodge's stages use goes into the storage bay's stock. */
  supplyLodge(n: number): number {
    for (const item of lodgeItems()) this.town.deliver(item, n);
    return n;
  }

  /** The town's state for the debug handle and the e2e driver: the building in progress, the board, the bay and its crate, the coin. */
  townDebug(): TownDebug {
    const at = this.town.currentPlace();
    return {
      site: this.town.planned ? [...this.town.planned.site] : null,
      building: this.town.currentTemplate,
      base: this.town.buildBase(),
      waiting: this.town.waitingOn(),
      rep: this.board.rep,
      board: { spot: this.board.spot ? { x: this.board.spot.x, y: this.board.spot.y, z: this.board.spot.z } : null, placed: this.board.placed, bounties: this.board.list().map((b) => ({ id: b.id, item: b.item, left: b.left, coin: b.coin, template: b.template })) },
      bay: this.board.bay ? { ...this.board.bay } : null,
      crate: this.board.crate(),
      front: this.board.front(),
      stock: this.town.stock(),
      progress: this.town.progress(),
      missing: this.town.missing(),
      stage: this.town.stage(),
      coins: this.coins,
      planned: at ? { template: at.template, x: at.x, z: at.z, rot: at.rot } : null,
      plan: (this.town.planned?.buildings ?? []).map((b) => ({ template: b.template, x: b.x, z: b.z, rot: b.rot })),
    };
  }

  /** The town's save: the builder's state, with the building board inside it. */
  private townSnapshot(): TownSnapshot | undefined {
    const t = this.town.toJSON();
    return t ? { ...t, board: this.board.toJSON() } : undefined;
  }

  private useBoard(npc: NpcDef): string {
    const handed = this.deliverFavour(npc);
    if (handed !== null) return handed;
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
    const favs = this.favours.list();
    if (favs.length > 0) this.toast(`Favours pinned (hold the item and use the board): ${favs.map((f) => f.ask).join(' ')}`);
    return npc.name;
  }

  /** Switches the jukebox: the girls and the other guys dance to it, Gruk does not. */
  private useJukebox(npc: NpcDef): string {
    if (this.partyOn) {
      const t = 'The party is on. Press the party button behind the bar to end it.';
      this.toast(`${npc.name}: ${t}`);
      return t;
    }
    this.jukeboxOn = !this.jukeboxOn;
    this.beatS = 0;
    this.beat = 0;
    this.danceS = 0;
    const text = this.jukeboxOn ? 'The jukebox starts up. Everyone but Gruk is on their feet.' : 'The jukebox winds down.';
    this.toast(`${npc.name}: ${text}`);
    return text;
  }

  /** The party button behind the bar: on, everyone changes into swimwear and dances (Gruk stomps); off, outfits and routines return. */
  private useParty(): string {
    const rosa = NPCS.find((n) => n.role === 'barkeep');
    this.partyOn = !this.partyOn;
    this.beatS = 0;
    this.beat = 0;
    this.danceS = 0;
    if (this.partyOn) {
      this.jukeBeforeParty = this.jukeboxOn;
      this.jukeboxOn = true;
    } else {
      this.jukeboxOn = this.jukeBeforeParty;
    }
    const text = this.partyOn ? 'Party time! Swimwear on, everyone!' : 'Party is over. Back to normal, folks.';
    this.toast(`${rosa?.name ?? 'Rosa'}: ${text}`);
    if (this.partyOn) this.toast('Gruk: Hmph. Stomp stomp.');
    return text;
  }

  /** The button glows while the party is on: its block's active bit follows `partyOn` (retried until the chunk is there). */
  private syncPartyLamp(): void {
    const o = this.at;
    if (!o || !this.host?.setBlockActive || this.partyLamp === this.partyOn) return;
    if (this.host.setBlockActive(o[0] + PARTY_BUTTON[0], o[1] + PARTY_BUTTON[1], o[2] + PARTY_BUTTON[2], this.partyOn)) this.partyLamp = this.partyOn;
  }

  /** The cabinet glows amber while it plays: the block's active bit follows `jukeboxOn` (retried until the chunk is there). */
  private syncJukeboxLamp(): void {
    const o = this.at;
    if (!o || !this.host?.setBlockActive || this.lamp === this.jukeboxOn) return;
    const j = FIXTURES.find((n) => n.role === 'jukebox');
    if (!j) return;
    if (this.host.setBlockActive(o[0] + Math.floor(j.at[0]), o[1] + Math.floor(j.at[1]), o[2] + Math.floor(j.at[2]), this.jukeboxOn)) this.lamp = this.jukeboxOn;
  }

  private playJukebox(dt: number): void {
    const o = this.at;
    const j = FIXTURES.find((n) => n.role === 'jukebox');
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
    if (!held && this.host?.caravanPresent?.() && this.host.openCaravan) {
      const line = "My cousin's caravan is in the yard today. Rare goods for coin, and they buy your surplus. Go on, look.";
      this.say(npc, line);
      this.host.openCaravan();
      return line;
    }
    if (!held && this.shelf.length > 0) return this.buyBack(npc);
    if (!held) {
      const line = this.rng() < 0.5 ? this.lines.from('bram-nothing', HERMIT_NOTHING) : this.lines.pick(npc.id, bank, this.phase(), { greeting: this.greeting(npc) });
      this.say(npc, line);
      return line;
    }
    // Old Bram pays by his mood, which is his contentment: 0.75 when he is restless, 1.35 when he is cheerful (no dice).
    const mood = 1.05 + 0.3 * this.settlement.scoreOf('bram');
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

  // ---- the wandering trader (trader.ts): a visit every few days; stock to buy, and one favour they want --------------

  private traderSeed(): number {
    return this.host?.worldSeed?.() ?? 0;
  }

  /** The visit covering today (null between visits) and whether the trader is standing in the yard now. */
  private traderInfo(): { visit: TraderVisit; here: boolean } | null {
    const host = this.host;
    if (!host || !this.at || !this.hasTavern) return null;
    const day = host.day();
    const visit = traderVisitOn(this.traderSeed(), day);
    return visit ? { visit, here: traderHere(visit, day, this.phase()) } : null;
  }

  private traderHereNow(): boolean {
    return this.traderInfo()?.here ?? false;
  }

  /** Shown while in the yard, and while walking out of it (until they reach the gate). */
  private traderShown(): boolean {
    // The caravan comes to the tavern only once it stands (the lodge's last stage), not to the lodge or the camp.
    if (!this.hasTavern || !this.traderInfo()) return false;
    if (this.traderHereNow()) return true;
    const p = this.pos.get(TRADER_ID);
    return !!p && Math.hypot(p[0] - TRADER_GATE[0], p[1] - TRADER_GATE[2]) > 0.05;
  }

  /** Makes sure the stock, want, phrase bank and stall are those of `visit`. A saved visit keeps the units left. */
  private syncTrader(visit: TraderVisit): void {
    if (this.traderCache?.visit === visit.start) return;
    const seed = this.traderSeed();
    const lines = traderStock(seed, visit.start);
    this.traderCache = { visit: visit.start, lines, want: traderWant(seed, visit.start, lines.map((l) => l.item)), bank: traderBank(seed, visit.start) };
    if (!(this.trade?.visit === visit.start && this.trade.left.length === lines.length)) {
      this.trade = { visit: visit.start, left: lines.map((l) => l.count), wantDone: false };
    }
    this.traderMenu = new ServiceMenu(lines.map((_, i) => this.traderService(i)));
  }

  /** The stall's price once the town's mood is counted: a content town pays up to 15% less, a restless one up to 20% more (contentment.ts). */
  private tradePrice(base: number): number {
    return base <= 0 ? 0 : Math.max(1, Math.round(base * priceFactor(this.settlement.mood())));
  }

  /** One stock line as a service: pitched while units are left; the Use inside the window buys one unit. */
  private traderService(i: number): Service {
    const line = (): TraderLine | undefined => this.traderCache?.lines[i];
    return {
      id: `trader-${i}`,
      cost: () => this.tradePrice(line()?.price ?? 0),
      pitch: () => {
        const l = line();
        if (!l || !this.trade || this.trade.left[i] <= 0) return null;
        return `${nameOf(l.item)}: ${this.trade.left[i]} left at ${this.tradePrice(l.price)} coin. Use me again to buy one.`;
      },
      accept: (p) => {
        const l = line();
        if (!l || !this.trade || this.trade.left[i] <= 0) return 'That one is sold out. Ask what else I have.';
        const price = this.tradePrice(l.price);
        if (!p.spend(price)) return `That is ${price} coin, friend, and you carry ${p.coins()}. Come back with it.`;
        if ((this.host?.give(l.item, 1) ?? 1) > 0) {
          p.earn(price);
          return TRADER_FULL;
        }
        this.trade.left[i]--;
        this.toast(`Bought 1 ${nameOf(l.item)} from Pell for ${price} coin (${this.coins} left)`);
        return `There you go. One ${nameOf(l.item)}. Do not wear it out on the road.`;
      },
    };
  }

  /** Each tick: the stall's windows run down, the visit is synced, and an arrival or a departure is announced once. */
  private tickTrader(dt: number): void {
    this.traderMenu?.tick(dt);
    const info = this.traderInfo();
    if (!info) {
      this.trade = null;
      this.traderCache = null;
      this.traderMenu = null;
      this.traderWas = false;
      return;
    }
    this.syncTrader(info.visit);
    if (this.traderWas === null) this.traderWas = info.here;
    else if (info.here !== this.traderWas) {
      this.traderWas = info.here;
      this.toast(info.here
        ? 'A trader comes up the road at dusk with a lantern and a goat. Pell will set up in the yard for three nights.'
        : 'Pell packs the stall and walks the goat back down the road.');
    }
  }

  /**
   * Use on Pell: a favour they want (if the item is in hand in full) is handed over for its bonus; otherwise the stall pitches its
   * next line and a second Use buys one unit; otherwise they talk (and say what they want, now and then).
   */
  private useTrader(npc: NpcDef): string {
    const info = this.traderInfo();
    if (!info || !info.here) {
      const line = 'No trader in the yard. Look up the road at dusk.';
      this.say(npc, line);
      return line;
    }
    this.syncTrader(info.visit);
    const c = this.traderCache!;
    const t = this.trade!;
    const want = c.want;
    const held = this.host?.held() ?? null;
    if (held && !t.wantDone && held.item === want.item) {
      if (held.count < want.count) {
        const line = fillIn(this.lines.from(`${npc.id}-short`, TRADER_WANT_SHORT), { count: want.count, item: nameOf(want.item), have: held.count });
        this.say(npc, line);
        return line;
      }
      this.host!.takeHeld(want.count);
      this.coins += want.coin;
      t.wantDone = true;
      const line = fillIn(this.lines.from(`${npc.id}-thanks`, TRADER_WANT_THANKS), { count: want.count, item: nameOf(want.item), coin: want.coin });
      this.say(npc, line);
      this.toast(`Pell takes ${want.count} ${nameOf(want.item)} for ${want.coin} coin. The favour is done.`);
      return line;
    }
    const menu = this.traderMenu!;
    const taken = menu.take(this.port(npc));
    if (taken !== null) {
      this.say(npc, taken);
      return taken;
    }
    const n = (this.spoken[npc.id] ?? 0) + 1;
    this.spoken[npc.id] = n;
    const line = n % 2 === 1 && !t.wantDone ? want.ask : this.lines.pick(npc.id, c.bank, this.phase(), { greeting: this.greeting(npc) });
    this.say(npc, line);
    const pitch = menu.pitch(this.port(npc));
    if (pitch !== null) this.say(npc, pitch);
    return line;
  }

  /** The trader's visit as it stands (null between visits): dates, whether they are in the yard, the stock left, and the want. */
  trader(): TraderStatus | null {
    const info = this.traderInfo();
    if (!info) return null;
    this.syncTrader(info.visit);
    const c = this.traderCache!;
    const t = this.trade!;
    return {
      start: info.visit.start, leave: info.visit.leave, here: info.here,
      stock: c.lines.map((l, i) => ({ item: l.item, left: t.left[i], price: this.tradePrice(l.price), rare: l.rare })),
      want: c.want, wantDone: t.wantDone,
    };
  }

  // ---- newcomers, housing and contentment -----------------------------------------------------------------------

  /** Where a resident stands while only the lodge is built: the common room by day, their bedroom at night. */
  private lodgeSpot(id: string, phase: Phase): Spot {
    if (phase === 'night') {
      const room = this.settlement.roomOf(id);
      const sleep = LODGE_SLEEP[room];
      if (sleep) return sleep;
    }
    return LODGE_COMMON[id] ?? LODGE_ROUTINE;
  }

  /** The people still to come, with what holds each back (moveIn.ts). */
  private townLine(host: NpcHost): Newcomer[] {
    const extra = host.townFacts?.() ?? { magic: false, alchemy: false };
    const residents = this.presentCount() - (this.people.has(BUILDER_ID) ? 1 : 0);
    const facts: TownFacts = { hearth: this.tavernLevel >= 1, firstBronze: host.completed().has('make_bronze'), firstMagic: extra.magic, residents, alchemy: extra.alchemy };
    return newcomerLine(facts, this.board.rep).filter((n) => !this.people.has(n.id));
  }

  /** Every room the town counts now: the lodge's own (valid by default) and the player's found by their bed. */
  private roomsNow(): RoomInput[] {
    return [...lodgeRooms(this.tavernLevel), ...this.builtRooms];
  }

  private roomLabel(id: string): string {
    return LODGE_ROOMS.find((r) => r.id === id)?.label ?? (id === CAMP_ROOM ? 'Camp' : 'Your room');
  }

  /** Looks for rooms the player built: every bed near the town that passes the room check. */
  private scanBuilt(host: NpcHost): RoomInput[] {
    const o = this.at;
    if (!o) return [];
    return scanRooms(host.companion.world, { x: o[0] + Math.floor(LODGE_W / 2), y: o[1], z: o[2] + Math.floor(LODGE_D / 2), lodge: { x: o[0], z: o[2], w: LODGE_W, d: LODGE_D } });
  }

  /**
   * Each time the day turns, the nights that passed are rolled one by one: a newcomer may move into a free valid room (never on its
   * first night, at most one a night), a resident whose room broke moves out, and contentment is read again.
   */
  private tickSettlement(host: NpcHost): void {
    if (!this.at) return;
    const day = host.day();
    const level = this.tavernLevel;
    const turned = day !== this.settlement.last;
    if (!turned && level === this.trackedLevel) return;
    this.trackedLevel = level;
    if (!turned) {
      this.settlement.track(day, this.roomsNow());
      return;
    }
    const line = (): Newcomer[] => this.townLine(host);
    const lives = Object.values(this.settlement.occupancy).some((r) => r.startsWith(BED_ROOM));
    if (line().length > 0 || lives) this.builtRooms = this.scanBuilt(host);
    this.settlement.track(day, this.roomsNow());
    this.settlement.advance(day, () => this.roomsNow(), line, this.rng, (a, night) => this.moveIn(a, night));
    for (const m of this.settlement.evict(this.roomsNow())) {
      this.toast(`${nameOfPerson(m.personId)}'s room is not a room any more (a wall, the door, the light or the seat is gone). ${m.to === CAMP_ROOM ? 'They sleep by the camp fire until it is mended.' : `They move to the ${this.roomLabel(m.to).toLowerCase()}.`}`);
    }
    this.rescore(host);
  }

  /** A newcomer arrives: they walk in at the door, say who they are, and their room has their things in it. */
  private moveIn(a: Arrival, night: number): void {
    const id = a.personId;
    this.people.add(id);
    this.pos.set(id, [6, 0]);
    this.routes.delete(id);
    const name = nameOfPerson(id);
    const room = this.roomLabel(a.roomId).toLowerCase();
    this.toast(`${name} has moved into the ${room}.`);
    const hello = ARRIVAL_LINES[id];
    if (hello) this.toast(hello);
    this.bus.emit('town:note', { key: `town:arrived:${id}`, text: `${name} moved into the ${room}.` });
    this.bus.emit('sfx', { name: 'ui_click' });
    void night;
  }

  /** Reads contentment again for everyone who lives here (the room, the neighbours and the surroundings). */
  private rescore(host: NpcHost): void {
    const o = this.at;
    if (!o) {
      this.settlement.setScores({});
      return;
    }
    const spotOf = (id: string): { x: number; y: number; z: number } => {
      const room = this.settlement.roomOf(id);
      const def = LODGE_ROOMS.find((r) => r.id === room);
      if (def) return { x: o[0] + def.at[0], y: o[1] + def.at[1], z: o[2] + def.at[2] };
      const bed = bedOfRoom(room);
      if (bed) return bed;
      return { x: o[0] + LODGE_ROUTINE[0], y: o[1] + LODGE_ROUTINE[1], z: o[2] + LODGE_ROUTINE[2] };
    };
    const block = host.townBlock;
    const residents = NPCS.filter((n) => this.people.has(n.id)).map((n) => n.id);
    this.settlement.setScores(townContentment(
      residents,
      spotOf,
      (id) => this.settlement.roomOf(id) !== CAMP_ROOM,
      (_id, spot) => (block ? sampleTags((x, y, z) => block.call(host, x, y, z), spot) : new Set()),
      (_id, spot) => host.roomWarmth?.(spot.x, spot.y, spot.z) ?? 0,
    ));
  }

  /** What the camp goals read (campGoals.ts). */
  private campFacts(): CampFacts {
    return {
      metBuilder: (this.spoken[BUILDER_ID] ?? 0) > 0,
      warmed: this.goalFlags.has('well_warmed'),
      rested: this.goalFlags.has('rested'),
      standing: this.board.rep,
      lodgeLevel: this.tavernLevel,
      residents: this.presentCount() - (this.people.has(BUILDER_ID) ? 1 : 0),
    };
  }

  /** Whether the camp goal track applies here: a new world's camp, or a lodge on its way (an old tavern has no such track). */
  private campTrack(): boolean {
    return this.at !== null && (this.camp || this.town.hasLodge());
  }

  /** Notes the camp goals the town has finished: a toast and a diary line each (silently on the first look after a load). */
  private tickGoals(host: NpcHost): void {
    void host;
    if (!this.campTrack()) return;
    const done = doneGoals(this.campFacts(), this.goalsDone);
    const fresh = CAMP_GOALS.filter((g) => done.has(g.id) && !this.goalsDone.has(g.id));
    if (fresh.length === 0) {
      this.goalsReady = true;
      return;
    }
    for (const g of fresh) this.goalsDone.add(g.id);
    if (!this.goalsReady) {
      this.goalsReady = true;
      return;
    }
    const last = fresh[fresh.length - 1];
    for (const g of fresh) this.bus.emit('town:note', { key: `camp:${g.id}`, text: g.note });
    this.toast(`Camp goal done: ${last.title}.`);
    const next = currentGoal(this.goalsDone);
    if (next) this.toast(`Next at the camp: ${next.title}. ${next.text}`);
  }

  /** The current camp goal for the HUD chip, or null when the track is finished or does not apply. */
  campGoal(): CampGoal | null {
    return this.campTrack() ? currentGoal(doneGoals(this.campFacts(), this.goalsDone)) : null;
  }

  /** What the HUD's town chip says: the camp goal, else the building going up; null when there is no town to show. */
  townChip(): { kicker: string; title: string } | null {
    if (!this.campTrack()) return null;
    const goal = this.campGoal();
    if (goal) return { kicker: 'Camp goal', title: goal.title };
    const cur = this.town.currentTemplate;
    if (!cur) return { kicker: 'Town', title: `${this.presentCount() - 1} neighbours` };
    const idx = (LODGE_PATH as readonly string[]).indexOf(cur);
    const prog = this.town.progress();
    const pct = prog.cells > 0 ? Math.round((100 * prog.laid) / prog.cells) : 0;
    return { kicker: 'Gruk is building', title: `${idx >= 0 ? LODGE_NAMES[idx] : (townTemplate(cur)?.name ?? cur)} ${pct}%` };
  }

  /** Everything the Town page shows (townPage.ts). */
  townPage(): TownPage {
    const host = this.host;
    const day = host?.day() ?? 1;
    const active = this.campTrack();
    const cur = this.town.currentTemplate;
    const prog = this.town.progress();
    const lodgeIdx = (LODGE_PATH as readonly string[]).indexOf(cur ?? '');
    const missing = this.town.missing().map((m) => ({ item: m.item, count: m.count }));
    const waiting = this.town.waitingOn();
    const building = cur
      ? {
          name: lodgeIdx >= 0 ? LODGE_NAMES[lodgeIdx] : (townTemplate(cur)?.name ?? cur),
          stage: lodgeIdx >= 0 ? lodgeIdx + 1 : null,
          stages: lodgeIdx >= 0 ? LODGE_PATH.length : null,
          percent: prog.cells > 0 ? Math.round((100 * prog.laid) / prog.cells) : 0,
          missing,
          daysLeft: missing.length === 0 && prog.cells > 0 ? Math.max(1, Math.ceil((prog.cells - prog.laid) / DAY_BUDGET)) : null,
          waiting: waiting ? lockNote(waiting, this.board.rep) : null,
        }
      : null;
    const rep = this.board.rep;
    const nextStep = REPUTATION_STEPS.find((s) => s.at > rep) ?? null;
    const lock = Object.entries(UNLOCK_REP).filter(([, at]) => at > rep).sort((a, b) => a[1] - b[1])[0];
    const line = host ? this.townLine(host) : [];
    const free = this.roomsNow();
    const nextIn = line.length > 0 ? this.settlement.next(line, free) : null;
    const labels: Record<string, string> = {};
    for (const r of LODGE_ROOMS) labels[r.id] = r.label;
    const done = doneGoals(this.campFacts(), this.goalsDone);
    const goals = this.campTrack() ? CAMP_GOALS.map((g) => ({ id: g.id, title: g.title, text: g.text, done: done.has(g.id) })) : [];
    const goal = goals.find((g) => !g.done) ?? null;
    return {
      active,
      camp: this.camp,
      day,
      building,
      finished: this.town.builtCount,
      planned: this.town.planned?.buildings.length ?? 0,
      standing: { name: reputationStep(rep).name, value: rep, next: nextStep ? { name: nextStep.name, at: nextStep.at } : null },
      nextUnlock: lock ? `${townTemplate(lock[0])?.name ?? lock[0]} (town standing ${lock[1]}; it stands at ${rep})` : null,
      mood: this.settlement.mood(),
      moodLabel: moodLabel(this.settlement.mood()),
      residents: NPCS.filter((n) => this.people.has(n.id)).map((n) => {
        const score = this.settlement.scoreOf(n.id);
        const room = this.settlement.roomOf(n.id);
        return { id: n.id, name: n.name, home: n.id === BUILDER_ID && room === CAMP_ROOM ? (this.camp ? 'Camp' : 'Common room') : room === CAMP_ROOM ? 'Common room' : (labels[room] ?? 'Your room'), score, tone: lineTone(score), reasons: [...this.settlement.reasonsOf(n.id)], trust: this.trustOf(n.id) };
      }),
      rooms: this.settlement.housing(free, labels),
      nextInLine: nextIn ? { id: nextIn.id, name: nameOfPerson(nextIn.id), waitingFor: nextIn.waitingFor, text: waitingText(nextIn.id, nameOfPerson(nextIn.id), nextIn.waitingFor) } : null,
      goals,
      goal,
    };
  }

  /** The settlement as the debug handle and the e2e driver read it: the line, the rooms, who lives where, the scores. */
  settlementDebug(): { last: number; level: number; line: Newcomer[]; rooms: RoomInput[]; occupancy: Record<string, string>; scores: Record<string, number>; mood: number; goals: string[]; present: string[] } {
    const host = this.host;
    return {
      last: this.settlement.last,
      level: this.tavernLevel,
      line: host ? this.townLine(host) : [],
      rooms: this.roomsNow(),
      occupancy: this.settlement.occupancy,
      scores: Object.fromEntries(NPCS.filter((n) => this.people.has(n.id)).map((n) => [n.id, this.settlement.scoreOf(n.id)])),
      mood: this.settlement.mood(),
      goals: [...this.goalsDone],
      present: [...this.people],
    };
  }

  /** Dev skip (the e2e): runs `n` nights of the move-in roll at once, as if the days had passed. Returns who arrived. */
  skipNights(n: number): string[] {
    const host = this.host;
    if (!host || !this.at) return [];
    const before = new Set(this.people);
    const day = host.day() + Math.max(0, Math.floor(n));
    this.settlement.track(host.day(), this.roomsNow());
    this.builtRooms = this.scanBuilt(host);
    this.settlement.track(host.day(), this.roomsNow());
    this.settlement.advance(day, () => this.roomsNow(), () => this.townLine(host), this.rng, (a, night) => this.moveIn(a, night));
    this.rescore(host);
    return [...this.people].filter((p) => !before.has(p));
  }

  // ---- jobs (jobs.ts, docs/api/jobs.md) ---------------------------------------------------------------------------

  /** Who can be given work: people who live here (not props, not the visiting trader), and only when the world has a workshop. */
  canWork(id: string): boolean {
    const n = NPCS.find((p) => p.id === id);
    return !!n && n.kind === 'person' && n.role !== 'trader' && this.isPresent(id) && !!this.host?.jobs;
  }

  /** The people the Jobs screen lists, each with what they carry and what they do now. */
  workers(): { id: string; name: string; note: string; kindName: string | null }[] {
    return NPCS.filter((n) => this.canWork(n.id)).map((n) => {
      const v = this.jobs.get(n.id);
      return { id: n.id, name: n.name, note: aptitudeOf(n.id).note, kindName: v ? KIND_NAMES[v.job.kind] : null };
    });
  }

  /** Puts a resident to work (or changes what they do); `null` sends them back to their routine. */
  setJob(id: string, kind: JobKind | null): void {
    if (!this.canWork(id)) return;
    if (kind === null) this.jobs.clear(id);
    else this.jobs.assign(id, kind);
  }

  /** Asks for a stop to be picked: the next Use on a block (not a person) sets it, then the Jobs screen opens again. */
  startPick(id: string, which: 'from' | 'to'): boolean {
    if (!this.canWork(id) || !this.jobs.has(id)) return false;
    this.picking = { id, which };
    this.toast(`Aim at ${which === 'to' ? 'the crate or machine to deliver to' : this.jobs.get(id)?.job.kind === 'tend' ? 'a block in the workshop to look after' : 'the crate, depot or vault to collect from'} and Use`);
    return true;
  }

  get pickingStop(): { id: string; which: 'from' | 'to' } | null {
    return this.picking;
  }

  cancelPick(): void {
    this.picking = null;
  }

  /** The game's Use on a block while a stop is being picked: true when the Use was spent. */
  jobPick(hit: { x: number; y: number; z: number; block: { key: string } } | null): boolean {
    const p = this.picking;
    if (!p) return false;
    if (!hit || hit.block.key === 'air') {
      this.picking = null;
      this.toast('Nothing there. Open the jobs again to pick a stop.');
      return true;
    }
    this.picking = null;
    const stop: Stop = { x: hit.x, y: hit.y, z: hit.z };
    this.jobs.setStop(p.id, p.which, stop);
    const name = NPCS.find((n) => n.id === p.id)?.name ?? p.id;
    this.toast(`${name} will ${p.which === 'to' ? 'deliver to' : this.jobs.get(p.id)?.job.kind === 'tend' ? 'look after the machines around' : 'collect from'} the ${hit.block.key.replace(/_/g, ' ')} at ${stop.x}, ${stop.y}, ${stop.z}`);
    this.bus.emit('ui:open', { screen: { type: 'jobs', person: p.id } });
    return true;
  }

  private tickJobs(host: NpcHost, dt: number): void {
    const w = host.jobs;
    if (!w || this.jobs.size === 0) return;
    const port: JobsPort = {
      peek: (s) => w.peek(s),
      take: (s, item, max) => w.take(s, item, max),
      canOffer: (s, item, n) => w.canOffer(s, item, n),
      offer: (s, item, n) => w.offer(s, item, n),
      loaded: (s) => w.loaded(s),
      spill: (s, item, n) => w.spill(s, item, n),
      worn: w.worn ? (near) => w.worn!(near) : undefined,
      tend: w.tend ? (x, y, z) => w.tend!(x, y, z) : undefined,
      working: () => this.phase() !== 'night',
      busy: (id) => !this.isPresent(id) || (id === 'gruk' && this.companion.active),
    };
    this.jobs.tick(dt, port);
  }

  /** The block under a stop (for the screen's labels), or null when it is not loaded. */
  stopBlock(s: Stop): string | null {
    return this.host?.jobs?.blockAt(s) ?? null;
  }

  // ---- time -----------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.clockS += dt;
    if (this.cooldownS > 0) this.cooldownS = Math.max(0, this.cooldownS - dt);
    if (this.offerS > 0) this.offerS = Math.max(0, this.offerS - dt);
    if (this.buybackS > 0) this.buybackS = Math.max(0, this.buybackS - dt);
    this.rosa.tick(dt);
    this.gruk.tick(dt);
    this.tickBar(dt);
    this.tickFestival();
    this.tickTrader(dt);
    this.tickGossip(dt);
    if (this.host) this.favours.refresh(this.host.day(), this.rng, (who) => this.isPresent(who), (who) => favourRate(this.settlement.scoreOf(who)));
    const host = this.host;
    if (!host || !this.at) return;
    this.tickTown(host, dt);
    this.tickSettlement(host);
    this.tickGoals(host);
    this.tickJobs(host, dt);
    this.syncJukeboxLamp();
    this.syncPartyLamp();
    if (this.jukeboxOn) this.playJukebox(dt);
    for (const n of [...NPCS, ...VISITORS]) {
      if (n.kind !== 'person' || (n.role === 'orc' && this.companion.active)) continue;
      if (n.role !== 'trader' && !this.isPresent(n.id)) continue;
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
      const fires = this.camp ? CAMP_FIRES : this.tavernLevel >= LODGE_PATH.length ? FIRE_SPOTS : LODGE_FIRES;
      for (const [x, y, z] of fires) host.tendFire?.(this.at[0] + x, this.at[1] + y, this.at[2] + z);
    }
  }

  /**
   * A lodge stage is finished. The lodge's first stage (its bedroom) makes it the home: the people's origin moves to the lodge,
   * the camp is left behind, and the player wakes in the bedroom (bedSpawn). The later stages say what they added.
   */
  private lodgeStageDone(stage: LodgeKey): void {
    if (stage === LODGE_PATH[0]) {
      const o = this.town.lodgeOrigin();
      if (o) {
        this.at = o;
        this.camp = false;
        this.pos.clear();
        this.routes.clear();
      }
    }
    const k = LODGE_PATH.indexOf(stage);
    this.toast(stage === LODGE_PATH[LODGE_PATH.length - 1] ? `${LODGE_NAMES[k]} is finished. The tavern is open.` : `${this.builderName()} finished ${LODGE_NAMES[k]}.`);
  }

  /** Gruk's town build, anchored on the tavern's centre (townBuilder.ts). Only when the host can place blocks. */
  private tickTown(host: NpcHost, dt: number): void {
    const { townSurface, townBlock, townEdited, townPlace } = host;
    const o = this.at;
    if (!o || !townSurface || !townBlock || !townEdited || !townPlace) return;
    const th: TownHost = {
      day: () => host.day(),
      timeOfDay: () => host.timeOfDay(),
      townSurface: (x, z) => townSurface.call(host, x, z),
      townBlock: (x, y, z) => townBlock.call(host, x, y, z),
      townEdited: (x, y, z) => townEdited.call(host, x, y, z),
      townPlace: (x, y, z, block, facing) => townPlace.call(host, x, y, z, block, facing),
    };
    // The bay's stock is what its crate holds: the player's hand-ins and takes are read first, then the crate is brought to the stock.
    const crate = this.board.crate();
    this.town.syncCrate(crate && host.townCrate ? host.townCrate.call(host, crate.x, crate.y, crate.z) : null);
    const anchor: [number, number] = this.camp ? [o[0] + Math.floor(CAMP_W / 2), o[2] + Math.floor(CAMP_D / 2)] : [o[0] + Math.floor(TAVERN_W / 2), o[2] + Math.floor(TAVERN_D / 2)];
    this.town.tick(dt, th, host.worldSeed?.() ?? 0, anchor);
    for (const f of this.town.takeFinished()) {
      this.board.finished();
      if (f.template === 'storage_bay' && !this.board.bay) this.board.setBay(f);
      if ((LODGE_PATH as readonly string[]).includes(f.template)) this.lodgeStageDone(f.template as LodgeKey);
    }
    // The bay's floor row is known once Gruk has started it: the board is placed from then on, before the bay stands.
    const at = this.town.currentPlace();
    const base = this.town.buildBase();
    if (!this.board.bay && at && at.template === 'storage_bay' && base !== null) this.board.setBay({ x: at.x, z: at.z, rot: at.rot, base });
    // The board is redrawn every tick: what Gruk still needs changes as the stages move, and a timer on game time would
    // leave it stale while the game time barely moves (a paused or slow run).
    this.refreshBoard(host);
    this.placeBoard(host);
  }

  /** The builder's display name (Gruk). */
  private builderName(): string {
    return NPCS.find((n) => n.id === BUILDER_ID)?.name ?? 'Gruk';
  }

  /** The welcome, once, the first tick of a new world. */
  greet(): void {
    if (this.greeted || !this.at) return;
    this.greeted = true;
    this.toast(this.camp
      ? `A camp by the spawn: ${this.builderName()}'s cart, a fire and two bedrolls. Use ${this.builderName()} to talk; he has wooden tools for you.`
      : 'The Hearth & Anvil. Talk to Mara, Rosa, Gruk and Orrin (Use on them), check the quest board by the door, and visit Old Bram out back.');
  }

  toJSON(): NpcSnapshot {
    const r2 = (n: number): number => Math.round(n * 100) / 100;
    return {
      v: 1, at: this.at ? [...this.at] : null, greeted: this.greeted, gifted: [...this.gifted], spoken: { ...this.spoken }, heard: [...this.heard],
      coins: this.coins, claimed: [...this.claimed], hiredS: Math.max(0, Math.round(this.companion.hiredS)),
      comp: [r2(this.companion.x), r2(this.companion.y), r2(this.companion.z)], juke: this.jukeboxOn, party: this.partyOn, partyJuke: this.jukeBeforeParty,
      trust: { ...this.trust }, giftDay: { ...this.giftDay }, shelf: this.shelf.map((s) => [s.item, s.count, s.coin] as [string, number, number]), drinks: { day: this.drinkLog.day, n: { ...this.drinkLog.n } }, gossip: { last: this.gossipLast, said: [...this.gossipSaid] }, favours: this.favours.toJSON(), spar: { ...this.spar }, upkeep: this.bar.toJSON(), festival: { entered: { ...this.fest.entered }, gold: this.fest.gold, silver: this.fest.silver, bronze: this.fest.bronze, juke: this.fest.juke },
      trader: this.trade ? { visit: this.trade.visit, left: [...this.trade.left], wantDone: this.trade.wantDone } : undefined,
      town: this.townSnapshot(), present: [...this.people], camp: this.camp, jobs: this.jobs.size > 0 ? this.jobs.toJSON() : undefined,
      settle: this.settlement.toJSON(), goals: { done: [...this.goalsDone], flags: [...this.goalFlags] },
    };
  }

  load(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<NpcSnapshot>;
    const at = r.at;
    this.at = Array.isArray(at) && at.length === 3 && at.every((n) => Number.isFinite(n)) ? ([at[0], at[1], at[2]] as [number, number, number]) : null;
    this.greeted = r.greeted === true;
    this.jukeboxOn = r.juke === true;
    this.partyOn = r.party === true;
    this.jukeBeforeParty = r.partyJuke === true;
    if (this.partyOn) this.jukeboxOn = true;
    this.partyLamp = null;
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
    // Old saves (no `present`) have everyone; a camp keeps its own list.
    this.camp = r.camp === true && this.at !== null;
    const known = (id: string): boolean => NPCS.some((n) => n.id === id);
    this.people = new Set(Array.isArray(r.present) ? strings(r.present).filter(known) : NPCS.map((n) => n.id));
    this.gifted = new Set(strings(r.gifted));
    this.heard = new Set(strings(r.heard));
    this.claimed = new Set(strings(r.claimed));
    this.coins = typeof r.coins === 'number' && Number.isFinite(r.coins) ? Math.max(0, Math.floor(r.coins)) : 0;
    this.trust = {};
    this.giftDay = {};
    for (const [src, dst] of [[r.trust, this.trust], [r.giftDay, this.giftDay]] as const) {
      if (src && typeof src === 'object') for (const [k, v] of Object.entries(src)) if (typeof v === 'number' && Number.isFinite(v)) dst[k] = Math.max(0, Math.min(src === r.trust ? TRUST_MAX : 1e6, v));
    }
    this.favours.load(r.favours);
    this.bar.load(r.upkeep);
    this.fest = newFestivalState();
    this.festNow = false;
    const fe = r.festival;
    if (fe && typeof fe === 'object') {
      for (const [k, v] of Object.entries(fe.entered ?? {})) if ((k === 'dance' || k === 'cook' || k === 'brew') && typeof v === 'number' && Number.isFinite(v)) this.fest.entered[k] = v;
      for (const k of ['gold', 'silver', 'bronze'] as const) if (typeof fe[k] === 'number' && Number.isFinite(fe[k])) this.fest[k] = Math.max(0, Math.floor(fe[k]));
      this.fest.juke = fe.juke === true;
    }
    const sp = r.spar;
    this.spar = { xp: 0, day: 0, today: 0 };
    if (sp && typeof sp === 'object') for (const k of ['xp', 'day', 'today'] as const) if (typeof sp[k] === 'number' && Number.isFinite(sp[k])) this.spar[k] = Math.max(0, Math.floor(sp[k]));
    this.gossip = null;
    this.gossipLast = typeof r.gossip?.last === 'string' ? r.gossip.last : '';
    this.gossipSaid = strings(r.gossip?.said).slice(-6);
    this.drinkLog = { day: 0, n: {} };
    const dl = r.drinks;
    if (dl && typeof dl === 'object' && Number.isFinite(dl.day) && dl.n && typeof dl.n === 'object') {
      this.drinkLog.day = dl.day;
      for (const [k, v] of Object.entries(dl.n)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) this.drinkLog.n[k] = Math.floor(v);
    }
    this.pos.clear();
    this.routes.clear();
    this.shelf = [];
    for (const e of Array.isArray(r.shelf) ? r.shelf : []) {
      if (Array.isArray(e) && typeof e[0] === 'string' && Number.isFinite(e[1]) && Number.isFinite(e[2]) && e[1] > 0 && e[2] >= 0) this.shelf.push({ item: e[0], count: Math.floor(e[1]), coin: Math.floor(e[2]) });
    }
    this.shelf = this.shelf.slice(-SHELF_MAX);
    this.trade = null;
    this.traderCache = null;
    this.traderMenu = null;
    this.traderWas = null;
    const tr = r.trader;
    if (tr && typeof tr === 'object' && Number.isFinite(tr.visit) && Array.isArray(tr.left)) {
      this.trade = { visit: Math.floor(tr.visit), left: tr.left.map((n) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0)), wantDone: tr.wantDone === true };
    }
    this.jobs.load(r.jobs, (id) => this.people.has(id));
    this.picking = null;
    this.town.load(r.town);
    this.board.load(r.town?.board);
    this.settlement.load(r.settle);
    this.builtRooms = [];
    this.trackedLevel = -1;
    this.goalsDone = new Set(strings(r.goals?.done).filter((id) => CAMP_GOALS.some((g) => g.id === id)));
    this.goalFlags = new Set(strings(r.goals?.flags));
    this.goalsReady = false;
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
