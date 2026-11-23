/**
 * NpcManager: the tavern's three people. DOM-free and headless (owned by GameState, saved with `world.persist('npcs')`).
 * `buildStart` builds the tavern around the spawn point of a NEW world and puts the player inside; `talk` is the player's Use on
 * a person under the crosshair: gifts once, then goal hints, then rotating lines. Views feed the sprite renderer.
 */
import type { GameBus } from '../core/context';
import type { IWorld } from '../core/types';
import { NPCS, type NpcDef, type NpcSprite } from './data';
import { TAVERN_START, buildTavern } from './tavern';

export interface NpcView {
  id: string;
  name: string;
  sprite: NpcSprite;
  x: number;
  y: number;
  z: number;
}

export interface NpcSnapshot {
  v: 1;
  /** Tavern-local origin in the world (the north-west floor corner), or null in worlds without one. */
  at: [number, number, number] | null;
  greeted: boolean;
  gifted: string[];
  spoken: Record<string, number>;
  heard?: string[];
}

/** What the manager needs from the game. */
export interface NpcHost {
  give(item: string, count: number): number;
  currentGoal(): string | null;
}

const REACH = 3.4;
/** Half-width and height of a person's hit box. */
const HALF = 0.38;
const HEIGHT = 2.0;

export class NpcManager {
  at: [number, number, number] | null = null;
  greeted = false;
  private gifted = new Set<string>();
  private spoken: Record<string, number> = {};
  /** `npc:goal` pairs whose hint was already given (each hint is said once, then the lines rotate). */
  private heard = new Set<string>();
  private host: NpcHost | null = null;
  /** Seconds before the next Use speaks again (a held Use must not read the whole script). */
  private cooldownS = 0;

  constructor(private readonly bus: GameBus) {}

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
    return NPCS.map((n) => ({ id: n.id, name: n.name, sprite: n.sprite, x: o[0] + n.at[0] + 0.5, y: o[1] + n.at[1], z: o[2] + n.at[2] + 0.5 }));
  }

  /** The person whose box the ray hits first within reach, or null. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist = REACH): { npc: NpcDef; distance: number } | null {
    let best: { npc: NpcDef; distance: number } | null = null;
    for (const v of this.views()) {
      const t = rayBox(ox, oy, oz, dx, dy, dz, v.x - HALF, v.y, v.z - HALF, v.x + HALF, v.y + HEIGHT, v.z + HALF);
      if (t !== null && t <= maxDist && (!best || t < best.distance)) best = { npc: NPCS.find((n) => n.id === v.id)!, distance: t };
    }
    return best;
  }

  /** Use on a person: true when someone was spoken to (the Use is spent). */
  talk(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): boolean {
    const hit = this.raycast(ox, oy, oz, dx, dy, dz);
    if (!hit) return false;
    if (this.cooldownS > 0) return true;
    this.cooldownS = 0.8;
    this.speak(hit.npc);
    return true;
  }

  speak(npc: NpcDef): string {
    let line: string;
    if (!this.gifted.has(npc.id)) {
      this.gifted.add(npc.id);
      for (const g of npc.gift) this.host?.give(g.item, g.count);
      line = npc.giftLine;
    } else {
      const goal = this.host?.currentGoal() ?? null;
      const n = (this.spoken[npc.id] ?? 0) + 1;
      this.spoken[npc.id] = n;
      const key = `${npc.id}:${goal}`;
      if (goal && npc.byGoal[goal] && !this.heard.has(key)) {
        this.heard.add(key);
        line = npc.byGoal[goal];
      } else line = npc.lines[n % npc.lines.length];
    }
    this.bus.emit('toast', { text: `${npc.name}, ${npc.title.toLowerCase()}: "${line}"`, kind: 'good' });
    return line;
  }

  tick(dt: number): void {
    if (this.cooldownS > 0) this.cooldownS = Math.max(0, this.cooldownS - dt);
  }

  /** The welcome, once, the first tick of a new world. */
  greet(): void {
    if (this.greeted || !this.at) return;
    this.greeted = true;
    this.bus.emit('toast', { text: 'The Hearth & Anvil tavern. Talk to Mara, Rosa and Gruk (Use on them): each has something for you.', kind: 'good' });
  }

  toJSON(): NpcSnapshot {
    return { v: 1, at: this.at ? [...this.at] : null, greeted: this.greeted, gifted: [...this.gifted], spoken: { ...this.spoken }, heard: [...this.heard] };
  }

  load(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<NpcSnapshot>;
    const at = r.at;
    this.at = Array.isArray(at) && at.length === 3 && at.every((n) => Number.isFinite(n)) ? ([at[0], at[1], at[2]] as [number, number, number]) : null;
    this.greeted = r.greeted === true;
    this.gifted = new Set(Array.isArray(r.gifted) ? r.gifted.filter((s): s is string => typeof s === 'string') : []);
    this.heard = new Set(Array.isArray(r.heard) ? r.heard.filter((s): s is string => typeof s === 'string') : []);
    this.spoken = {};
    if (r.spoken && typeof r.spoken === 'object') for (const [k, v] of Object.entries(r.spoken)) if (typeof v === 'number' && Number.isFinite(v)) this.spoken[k] = v;
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
