/**
 * The player's hands on pipes and fluid blocks (spec 16.2, 16.3), decided BEFORE any machine screen opens:
 * - the wrench on a pipe works on the side aimed at (pipeAim.ts): an end touching a block cycles push -> pull -> off,
 *   a side towards a pipe parts or joins the two (the simulation toasts and clunks);
 * - a bucket (empty, water, bronze, lava) on a tank or any fluid endpoint moves 1000 L and swaps the held bucket;
 *   when it cannot (nothing to scoop, no room, the wrong fluid) the reason is toasted and the block's screen opens;
 * - Use on a pipe with anything that is not the wrench, a bucket or a placeable block opens the PIPE screen.
 *
 * The simulation is reached through the small TransportHands interface (src/sim's Simulation fits it structurally), so
 * this module never imports src/sim (spec 9).
 */
import type { GameBus } from '../core/context';
import type { Vec3 } from '../core/math';
import { blockOfItem, isFluidEndpoint } from '../core/registry';
import type { Face, IWorld } from '../core/types';
import type { PlayerState } from '../game';
import { BUCKETS, swapHeldItem } from './buckets';
import { pipeSideAt } from './pipeAim';
import { screenFor } from './blockRules';
import type { RayHit } from './raycast';

/** What the player module needs from the simulation's transport (src/sim's Simulation fits it). */
export interface TransportHands {
  /** The wrench on the side `dir` of the pipe at x, y, z (the simulation toasts and plays pipe_clunk on success). */
  wrench(x: number, y: number, z: number, dir: Face): { ok: true } | { ok: false; reason: string };
  /**
   * A bucket used on face `face` of the block at x, y, z: 1000 L in or out; `held` is the bucket the hand holds after.
   * `endpoint` false: the block takes no fluids, Use goes on as if this had not been asked.
   */
  bucketUse(x: number, y: number, z: number, face: Face, heldKey: string): { ok: true; held: string } | { ok: false; reason: string; endpoint: boolean };
}

/** The held item that configures pipes. */
export const WRENCH = 'wrench';
/** Shortest time between two wrench turns (a held button repeats Use every 0.25 s; one turn per press is plenty). */
export const WRENCH_COOLDOWN_S = 0.35;

/** What PipeTools needs from the Interaction that owns it. */
export interface PipeToolsHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  advise(key: string, text: string): void;
  swing(): void;
  stopMining(): void;
}

export type PipeToolOutcome = 'wrenched' | 'pail' | 'screen' | 'refused';

export class PipeTools {
  private cooldown = 0;
  private readonly dir: Vec3 = { x: 0, y: 0, z: 1 };

  constructor(private readonly host: PipeToolsHost, private readonly transport: TransportHands | null) {}

  /** Call every frame. */
  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  /**
   * Use on `hit` with `held` (item key or null). Returns what happened, or null when this is not a pipe-or-fluid
   * matter and the normal Use (screens, buckets on liquids, placing...) should go on.
   */
  use(hit: RayHit, held: string | null): PipeToolOutcome | null {
    if (hit.block.liquid !== null) return null;
    if (hit.block.pipe) {
      if (held === WRENCH) return this.wrench(hit);
      if (held !== null && (BUCKETS.has(held) || blockOfItem(held) !== null)) return null;
      return this.openPipe(hit);
    }
    if (held !== null && BUCKETS.has(held) && this.transport && isFluidEndpoint(hit.block)) return this.bucket(hit, held);
    return null;
  }

  private wrench(hit: RayHit): PipeToolOutcome {
    const h = this.host;
    if (this.cooldown > 0) return 'refused';
    if (!this.transport) return 'refused';
    const p = h.player;
    p.viewDir(this.dir);
    const side: Face = pipeSideAt(h.world, hit.x, hit.y, hit.z, p.position.x, p.eyeY, p.position.z, this.dir.x, this.dir.y, this.dir.z, hit.face);
    this.cooldown = WRENCH_COOLDOWN_S;
    const r = this.transport.wrench(hit.x, hit.y, hit.z, side);
    h.swing();
    if (r.ok) return 'wrenched';
    h.advise(`wrench:${r.reason}`, r.reason);
    return 'refused';
  }

  private bucket(hit: RayHit, held: string): PipeToolOutcome | null {
    const h = this.host;
    const r = this.transport!.bucketUse(hit.x, hit.y, hit.z, hit.face, held);
    if (r.ok) {
      swapHeldItem(h.player, r.held);
      h.swing();
      return 'pail';
    }
    if (!r.endpoint) return null;
    h.advise(`bucket:${r.reason}`, r.reason);
    // A machine that has a screen opens it (it shows what the machine holds); only a screenless block ends here.
    return screenFor(hit.block, hit.x, hit.y, hit.z) ? null : 'refused';
  }

  private openPipe(hit: RayHit): PipeToolOutcome {
    const h = this.host;
    h.stopMining();
    h.bus.emit('ui:open', { screen: { type: 'pipe', x: hit.x, y: hit.y, z: hit.z } });
    h.swing();
    return 'screen';
  }
}
