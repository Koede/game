/**
 * What the caves do around the player (docs/plans/caves-and-depths.md, hazards and phase 4). DOM-free; ticked with the game.
 *  - Foul air snuffs torches: any placed torch within SNUFF_REACH blocks of a foul-air cell goes out (the block is removed).
 *  - Map notes: the journal (src/game/journal.ts) gets a line the first time the player finds a miner's camp, stands near foul air,
 *    or builds a cave cairn, each with its place and depth band. The journal's map shows ground the player has been over, never more.
 */
import type { GameBus } from '../core/context';
import { blockId } from '../core/registry';
import { AIR, CHUNK_SIZE, voxelId, type IWorld } from '../core/types';
import { caveBandAt, findCaveCamp } from '../world/caveRooms';

/** Seconds between looks. */
export const WATCH_PERIOD_S = 1;
/** A torch this close to foul air goes out. */
export const SNUFF_REACH = 2;
/** The player sees a camp or a pocket this close (blocks). */
const NOTE_REACH = 6;
/** Above this y there is nothing to watch (the camp and gas rooms all lie under it). */
export const WATCH_MAX_Y = 56;

export interface CaveWatchHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  position(): { x: number; y: number; z: number };
  /** The journal's `add`: true when written. */
  note(text: string, key: string): boolean;
}

const at = (x: number, y: number, z: number): string => `${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)}`;

export class CaveWatch {
  private acc = 0;
  private snuffedAt = -99;
  private t = 0;
  private readonly torch = blockId('torch');
  private readonly foul = blockId('foul_air');
  private readonly cairn = blockId('cave_cairn');
  private readonly off: () => void;

  constructor(private readonly host: CaveWatchHost) {
    this.off = host.bus.on('block:placed', (e) => {
      if (voxelId(e.voxel) === this.cairn) host.note(`Built a cairn at ${at(e.x, e.y, e.z)} (${caveBandAt(e.y)} caves). It glows, so it shows the way back.`, `cave:cairn:${e.x},${e.y},${e.z}`);
    });
  }

  dispose(): void { this.off(); }

  tick(dt: number): void {
    this.acc += dt;
    this.t += dt;
    if (this.acc < WATCH_PERIOD_S) return;
    this.acc = 0;
    const p = this.host.position();
    if (p.y > WATCH_MAX_Y) return;
    const px = Math.floor(p.x);
    const py = Math.floor(p.y);
    const pz = Math.floor(p.z);
    this.watchCamps(px, py, pz);
    this.watchGas(px, py, pz);
  }

  private watchCamps(px: number, py: number, pz: number): void {
    const { world } = this.host;
    const read = (x: number, y: number, z: number): number => voxelId(world.getVoxel(x, y, z));
    for (let cz = Math.floor((pz - NOTE_REACH) / CHUNK_SIZE); cz <= Math.floor((pz + NOTE_REACH) / CHUNK_SIZE); cz++) {
      for (let cx = Math.floor((px - NOTE_REACH) / CHUNK_SIZE); cx <= Math.floor((px + NOTE_REACH) / CHUNK_SIZE); cx++) {
        if (!world.isLoaded(cx * CHUNK_SIZE, cz * CHUNK_SIZE)) continue;
        const camp = findCaveCamp(world.seed, cx, cz, read);
        if (!camp || Math.hypot(camp.x - px, camp.y - py, camp.z - pz) > NOTE_REACH) continue;
        this.host.note(`Found an old miner's camp at ${at(camp.x, camp.y, camp.z)} (${caveBandAt(camp.y)} caves). There is a crate by the torch.`, `cave:camp:${camp.x},${camp.y},${camp.z}`);
      }
    }
  }

  private watchGas(px: number, py: number, pz: number): void {
    const { world } = this.host;
    const R = 6;
    let gas: [number, number, number] | null = null;
    for (let y = Math.max(1, py - 3); y <= py + 4; y++) {
      for (let z = pz - R; z <= pz + R; z++) {
        for (let x = px - R; x <= px + R; x++) {
          const id = voxelId(world.getVoxel(x, y, z));
          if (id === this.foul && gas === null) gas = [x, y, z];
          if (id === this.torch && this.nearFoul(x, y, z)) {
            world.setVoxel(x, y, z, AIR, 'sim');
            if (this.t - this.snuffedAt > 5) {
              this.snuffedAt = this.t;
              this.host.bus.emit('toast', { text: 'A torch gutters out in the foul air.', kind: 'warn' });
            }
          }
        }
      }
    }
    if (gas) this.host.note(`Foul air pools near ${at(gas[0], gas[1], gas[2])} (${caveBandAt(gas[1])} caves). It hurts to breathe and puts torches out: wall it off.`, `cave:gas:${gas[0] >> 4},${gas[1] >> 3},${gas[2] >> 4}`);
  }

  private nearFoul(x: number, y: number, z: number): boolean {
    const { world } = this.host;
    for (let dy = -SNUFF_REACH; dy <= SNUFF_REACH; dy++) {
      for (let dz = -SNUFF_REACH; dz <= SNUFF_REACH; dz++) {
        for (let dx = -SNUFF_REACH; dx <= SNUFF_REACH; dx++) if (voxelId(world.getVoxel(x + dx, y + dy, z + dz)) === this.foul) return true;
      }
    }
    return false;
  }
}
