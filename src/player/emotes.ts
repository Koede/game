/**
 * Player emotes (wave, sit, cheer, dance), seen through the first-person eye: there is no body to animate, so each emote is a small,
 * eased offset of the view (a nod and sway, a crouch, a hop, a bob on the beat). DOM-free. Walking or jumping ends any emote.
 * When the tavern jukebox plays, the dance locks to its beat (BEAT_S) so the player joins the party.
 */
import { BEAT_S } from '../npcs/jukebox';

export type EmoteKind = 'wave' | 'sit' | 'cheer' | 'dance';
export const EMOTES: readonly EmoteKind[] = ['wave', 'sit', 'cheer', 'dance'];

/** Seconds an emote lasts; null = until the player moves (sit, dance). */
export const EMOTE_LENGTH_S: Readonly<Record<EmoteKind, number | null>> = { wave: 2, sit: null, cheer: 1.6, dance: null };

export interface EmoteView {
  /** Added to the eye height, blocks. */
  dy: number;
  /** Added to the view yaw / pitch, radians. */
  dyaw: number;
  dpitch: number;
}

const NONE: EmoteView = { dy: 0, dyaw: 0, dpitch: 0 };
const EASE_S = 0.35;

const smooth = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export class Emotes {
  kind: EmoteKind | null = null;
  /** Seconds since the emote began. */
  t = 0;
  /** Seconds left in the ease-out once it ended (0 = not leaving). */
  private leaving = 0;
  private from: EmoteKind | null = null;
  private fromT = 0;

  constructor(private readonly jukeboxOn: () => boolean = () => false) {}

  get active(): boolean {
    return this.kind !== null;
  }

  get sitting(): boolean {
    return this.kind === 'sit';
  }

  play(kind: EmoteKind): void {
    this.from = null;
    this.leaving = 0;
    this.kind = kind;
    this.t = 0;
  }

  /** The emote key: starts the next emote in the list, and after the last one stops. */
  cycle(): EmoteKind | null {
    const i = this.kind ? EMOTES.indexOf(this.kind) : -1;
    if (i + 1 >= EMOTES.length) {
      this.cancel();
      return null;
    }
    this.play(EMOTES[i + 1]);
    return this.kind;
  }

  cancel(): void {
    if (!this.kind) return;
    this.from = this.kind;
    this.fromT = this.t;
    this.leaving = EASE_S;
    this.kind = null;
  }

  update(dt: number, movingOrJumping: boolean): void {
    if (this.leaving > 0) this.leaving = Math.max(0, this.leaving - dt);
    if (!this.kind) return;
    if (movingOrJumping) {
      this.cancel();
      return;
    }
    this.t += dt;
    const len = EMOTE_LENGTH_S[this.kind];
    if (len !== null && this.t >= len) this.cancel();
  }

  /** The view offset right now. */
  view(): EmoteView {
    if (this.kind) return this.shape(this.kind, this.t, smooth(this.t / EASE_S));
    if (this.from && this.leaving > 0) return this.shape(this.from, this.fromT, smooth(this.leaving / EASE_S));
    return NONE;
  }

  private shape(kind: EmoteKind, t: number, k: number): EmoteView {
    switch (kind) {
      case 'wave':
        // A friendly nod and a little side-to-side as if turning to greet someone.
        return { dy: 0, dyaw: Math.sin(t * 6) * 0.06 * k, dpitch: -Math.abs(Math.sin(t * 3)) * 0.1 * k };
      case 'sit':
        return { dy: -0.9 * k, dyaw: 0, dpitch: 0.05 * k };
      case 'cheer': {
        const hop = Math.abs(Math.sin(t * 5)) * 0.35;
        return { dy: hop * k, dyaw: 0, dpitch: 0.28 * k };
      }
      case 'dance': {
        const period = this.jukeboxOn() ? BEAT_S * 4 : 0.5;
        const phase = (t / period) * Math.PI * 2;
        return { dy: Math.abs(Math.sin(phase / 2)) * 0.12 * k, dyaw: Math.sin(phase / 2) * 0.12 * k, dpitch: Math.sin(phase) * 0.04 * k };
      }
    }
  }
}
