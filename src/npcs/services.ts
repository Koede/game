/**
 * Paid services (docs/api/npcs.md): what Rosa and Gruk sell beyond talk. A `ServiceMenu` holds one person's offers. Use on them
 * pitches the next offer that is open right now and starts a short window; Use again inside the window takes it. A pitch the player
 * lets lapse moves on, so the next Use pitches the next offer. Offers are pure data plus two functions over a narrow `TavernPort`.
 */
import type { Phase } from './dialogue';
import type { NpcHost } from './manager';

export const SERVICE_WINDOW_S = 10;

/** What a service may touch: the coin purse, the game host, the day, and the voices. */
export interface TavernPort {
  host: NpcHost | null;
  rng: () => number;
  phase(): Phase;
  day(): number;
  coins(): number;
  /** Takes coin; false (and no change) when the purse is short. */
  spend(n: number): boolean;
  earn(n: number): void;
  trust(id: string): number;
  addTrust(id: string, n: number): void;
  say(line: string): void;
  toast(text: string): void;
}

export interface Service {
  id: string;
  /** What it costs now (shown in the pitch). */
  cost(p: TavernPort): number;
  /** The pitch, or null when it is not on offer right now. */
  pitch(p: TavernPort): string | null;
  /** Takes the offer; returns Rosa's or Gruk's reply. Spends coin itself (so it can refuse). */
  accept(p: TavernPort): string;
}

export class ServiceMenu {
  private idx = 0;
  private pending: string | null = null;
  private windowS = 0;

  constructor(private readonly offers: readonly Service[]) {}

  get open(): string | null {
    return this.windowS > 0 ? this.pending : null;
  }

  tick(dt: number): void {
    if (this.windowS <= 0) return;
    this.windowS = Math.max(0, this.windowS - dt);
    if (this.windowS === 0) this.pending = null;
  }

  /** Takes the pitched offer if its window is open. Null when nothing is pending. */
  take(p: TavernPort): string | null {
    const s = this.offers.find((o) => o.id === this.open);
    this.pending = null;
    this.windowS = 0;
    return s ? s.accept(p) : null;
  }

  /** Pitches the next open offer. Null when none is open. */
  pitch(p: TavernPort): string | null {
    for (let i = 0; i < this.offers.length; i++) {
      const o = this.offers[(this.idx + i) % this.offers.length];
      const text = o.pitch(p);
      if (text === null) continue;
      this.idx = (this.idx + i + 1) % this.offers.length;
      this.pending = o.id;
      this.windowS = SERVICE_WINDOW_S;
      return text;
    }
    return null;
  }

  /** Direct purchase by id (a UI or a test): accepts the offer if it is on offer. */
  buy(id: string, p: TavernPort): string | null {
    const o = this.offers.find((s) => s.id === id);
    return o && o.pitch(p) !== null ? o.accept(p) : null;
  }
}
