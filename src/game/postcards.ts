/**
 * Town postcards: a small keepsake picture of the town taken when a new age begins.
 * DOM-free: the director decides WHEN a card is due (the game then renders it), the store keeps the finished cards in a
 * Storage-like object, and `postcardVantage` picks where the camera stands. Cards live outside the save document (they are
 * pictures), keyed by the world seed, so a failing or full store never hurts the save.
 */
import type { GameBus } from '../core/context';
import type { DayPhase } from '../core/gameEvents';
import type { StorageLike } from '../save/storage';

export interface Postcard {
  /** Index into AGES the card marks (1 = Bronze ...). */
  age: number;
  ageName: string;
  day: number;
  /** A small JPEG data URL. */
  image: string;
}

/** What the game needs to know to decide whether a card can be taken right now. */
export interface PostcardMoment {
  paused: boolean;
  dead: boolean;
  /** A window is open or photo mode is on: the view is not the town. */
  busy: boolean;
  phase: DayPhase;
}

export class PostcardDirector {
  private readonly due = new Set<number>();
  private settle = 0;
  /** Seconds to let the age banner pass before the card is taken. */
  static readonly SETTLE_S = 8;
  private readonly offs: Array<() => void> = [];

  /** `have`: ages that already have a card (checked against the store), so a loaded game does not repeat them. */
  constructor(bus: GameBus, private readonly have: (age: number) => boolean) {
    this.offs.push(
      bus.on('age:advanced', ({ age }) => {
        if (age >= 1 && !this.have(age)) {
          this.due.add(age);
          this.settle = PostcardDirector.SETTLE_S;
        }
      }),
    );
  }

  get waiting(): number {
    return this.due.size;
  }

  /** Call once a second or so with the current moment: returns the age to take a card for now, or null. */
  poll(dt: number, m: PostcardMoment): number | null {
    if (this.settle > 0) this.settle -= dt;
    if (this.due.size === 0 || this.settle > 0) return null;
    if (m.paused || m.dead || m.busy || m.phase === 'night') return null;
    const age = Math.min(...this.due);
    this.due.delete(age);
    return age;
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
  }
}

const KEY_PREFIX = 'hearthwatt:postcards:';
/** Keeps the whole set well inside a localStorage quota. */
const MAX_CARDS = 8;

export class PostcardStore {
  private cards: Postcard[] = [];
  private readonly key: string;

  constructor(private readonly storage: StorageLike | null, seed: number) {
    this.key = KEY_PREFIX + (seed >>> 0);
    this.cards = this.read();
  }

  list(): readonly Postcard[] {
    return this.cards;
  }

  has(age: number): boolean {
    return this.cards.some((c) => c.age === age);
  }

  /** Adds (or replaces the card for that age). Returns false when storage refused it: the card is then kept in memory only. */
  add(card: Postcard): boolean {
    this.cards = [...this.cards.filter((c) => c.age !== card.age), card].sort((a, b) => a.age - b.age).slice(-MAX_CARDS);
    return this.write();
  }

  private read(): Postcard[] {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) return [];
      const data: unknown = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(isCard).slice(-MAX_CARDS);
    } catch {
      return [];
    }
  }

  private write(): boolean {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.cards));
      return this.storage !== null;
    } catch {
      return false;
    }
  }
}

function isCard(v: unknown): v is Postcard {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return typeof c.age === 'number' && typeof c.ageName === 'string' && typeof c.day === 'number' && typeof c.image === 'string' && c.image.startsWith('data:image/');
}

export interface Vantage {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** Farther than this from the player the town is not what the player knows: the card is taken from the player's spot instead. */
const TOWN_NEAR = 70;
const BACK = 15;
const HEIGHT = 9;

/**
 * Where the camera stands for a card: above and back from the town site (or from the player when there is no town near),
 * looking down at it. `eyeY` is the player's eye height, the best guess at the ground level around them.
 */
export function postcardVantage(player: { x: number; z: number; eyeY: number }, site: readonly [number, number] | null): Vantage {
  const near = site !== null && Math.hypot(site[0] - player.x, site[1] - player.z) <= TOWN_NEAR;
  const tx = near && site ? site[0] : player.x;
  const tz = near && site ? site[1] : player.z;
  const yaw = Math.PI / 4;
  // The view direction at yaw is (-sin, -cos): stand opposite to it.
  const x = tx + Math.sin(yaw) * BACK;
  const z = tz + Math.cos(yaw) * BACK;
  const y = player.eyeY + HEIGHT;
  return { x, y, z, yaw, pitch: -Math.atan2(HEIGHT, BACK) };
}

export const postcardCaption = (ageName: string, day: number): string => `${ageName} - Day ${day}`;
export const postcardFileName = (age: number, day: number): string => `hearthwatt-postcard-age${age}-day${day}.png`;
