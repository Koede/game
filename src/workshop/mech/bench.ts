/**
 * The Mechanics Test Bench (docs/MECHANICS_PLAN.md section 6, Dev Mode): a hall of small stations that exercise every part of the drivetrain layer.
 * `mechBenchBlueprint` is pure (a list of blocks relative to a corner); `placeMechBench` writes it into a world and winds the motors.
 *
 *   row z=0   brake + torque fuse + flywheel: motor, flywheel, brake, bronze fuse, saw and loom as the load
 *   row z=4   whip: motor and a run of seven shafts (critical speed 22.9 rpm, the motor turns 24): put a pillow block into the run to cure it
 *   row z=8   cam drum: four tracks light wire and lamps on its sides; beside it an AND gate with two levers
 *   row z=12  press line: motor, flywheel, press over a basin of bronze ingots (pulses ride through the flywheel)
 */
import { blockId } from '../../core/registry';
import { Facing, makeVoxel, type IWorld } from '../../core/types';
import type { Workshop } from '../workshop';

export interface BenchBlock {
  dx: number;
  dy: number;
  dz: number;
  key: string;
  facing?: Facing;
  /** Times to Use the block after placing it (cycles a setting, or winds a motor). */
  uses?: number;
}

export const BENCH_SIZE = { x: 14, y: 4, z: 15 };

export function mechBenchBlueprint(): BenchBlock[] {
  const b: BenchBlock[] = [];
  const row = (z: number, keys: string[], from = 0): void => keys.forEach((key, i) => b.push({ dx: from + i, dy: 0, dz: z, key }));
  // Row 0: brake / fuse / flywheel.
  b.push({ dx: 0, dy: 0, dz: 0, key: 'clockwork_motor', uses: 4 });
  row(0, ['flywheel', 'brake', 'shear_pin', 'drive_shaft', 'mech_saw'], 1);
  b[b.length - 3].uses = 2; // the pin: bronze (12 su); saw and loom at 24 rpm load ~10 SU
  b.push({ dx: 5, dy: 0, dz: 1, key: 'mech_loom' });
  // Row 4: seven shafts whip at the motor's 24 rpm.
  b.push({ dx: 0, dy: 0, dz: 4, key: 'clockwork_motor', uses: 4 });
  row(4, ['drive_shaft', 'drive_shaft', 'drive_shaft', 'drive_shaft', 'drive_shaft', 'drive_shaft', 'drive_shaft', 'mech_millstone'], 1);
  // Row 8: cam drum with lamps on three sides, and an AND gate.
  b.push({ dx: 0, dy: 0, dz: 8, key: 'clockwork_motor', uses: 4 }, { dx: 1, dy: 0, dz: 8, key: 'drive_shaft' }, { dx: 2, dy: 0, dz: 8, key: 'cam_drum' });
  b.push({ dx: 2, dy: 0, dz: 7, key: 'signal_wire' }, { dx: 2, dy: 0, dz: 6, key: 'signal_lamp' });
  b.push({ dx: 3, dy: 0, dz: 8, key: 'signal_wire' }, { dx: 4, dy: 0, dz: 8, key: 'signal_lamp' });
  b.push({ dx: 2, dy: 0, dz: 9, key: 'signal_wire' }, { dx: 2, dy: 0, dz: 10, key: 'signal_lamp' });
  b.push({ dx: 8, dy: 0, dz: 8, key: 'logic_gate', facing: Facing.North });
  b.push({ dx: 7, dy: 0, dz: 8, key: 'crank_lever' }, { dx: 9, dy: 0, dz: 8, key: 'crank_lever' });
  b.push({ dx: 8, dy: 0, dz: 7, key: 'signal_wire' }, { dx: 8, dy: 0, dz: 6, key: 'signal_lamp' });
  // Row 12: press line with a flywheel.
  b.push({ dx: 0, dy: 0, dz: 12, key: 'clockwork_motor', uses: 4 }, { dx: 1, dy: 0, dz: 12, key: 'flywheel' }, { dx: 2, dy: 0, dz: 12, key: 'drive_shaft' });
  b.push({ dx: 2, dy: 1, dz: 12, key: 'drive_shaft' }, { dx: 3, dy: 1, dz: 12, key: 'mech_press' }, { dx: 3, dy: 0, dz: 12, key: 'basin' });
  return b;
}

/** Every row's motor feeds its neighbour along +x; the press of row 12 sits on a raised shaft that climbs from the line. Dev Mode: the creative menu's Mech bench button calls it. */
export function placeMechBench(world: IWorld, ox: number, oy: number, oz: number, workshop: Workshop | null): number {
  // A floor and clear air, so the bench stands the same everywhere.
  for (let x = -1; x <= BENCH_SIZE.x; x++) {
    for (let z = -1; z <= BENCH_SIZE.z; z++) {
      world.setVoxel(ox + x, oy - 1, oz + z, makeVoxel(blockId('stone_brick')), 'player');
      for (let y = 0; y < BENCH_SIZE.y; y++) world.setVoxel(ox + x, oy + y, oz + z, 0, 'player');
    }
  }
  const bp = mechBenchBlueprint();
  for (const blk of bp) world.setVoxel(ox + blk.dx, oy + blk.dy, oz + blk.dz, makeVoxel(blockId(blk.key), blk.facing ?? Facing.North), 'player');
  if (workshop) {
    for (const blk of bp) for (let i = 0; i < (blk.uses ?? 0); i++) workshop.use(ox + blk.dx, oy + blk.dy, oz + blk.dz, null, () => undefined);
    workshop.offer(ox + 3, oy, oz + 12, 'bronze_ingot', 16);
  }
  return bp.length;
}
