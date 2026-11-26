/**
 * The Bronze workshop's modular parts (docs/OVERHAUL_PLAN.md A.2, A.5-A.7): transmission (reverse box, ratio dial,
 * clutch, split box, gearshift, governor, worm gear, chain sprocket, belt pulley), a clockwork motor, and the
 * logistics and processing pieces that follow. Each part is a block with a generated front (src/render/textures/
 * iconsWorkshopParts.ts) and runs from src/workshop. Gate: Bronze, like the first slice.
 */
import type { BlockSpec, ItemSpec } from '../core/types';
import { ageIndexOf } from '../magic/ageMap';

const BRONZE = ageIndexOf('bronze');

export interface PartDef { key: string; name: string; desc: string; /** has a running front */ anim: boolean; /** a flat slab: the face is its top */ flat?: boolean }

export const PART_DEFS: readonly PartDef[] = [
  { key: 'reverse_box', name: 'Reverse Box', anim: true, desc: 'Two meshed cogs: what leaves it turns the other way. Use it to read its direction under goggles.' },
  { key: 'ratio_dial', name: 'Ratio Dial', anim: true, desc: 'A gear train with a dial. Use it to cycle the output speed: half, equal, double, triple.' },
  { key: 'clutch', name: 'Clutch', anim: true, desc: 'Use it to engage or release: a released clutch hands nothing on, so the machines beyond it stop.' },
  { key: 'split_box', name: 'Split Box', anim: true, desc: 'A bevel box that joins shafts on every side and shares the load between them.' },
  { key: 'sequence_gearshift', name: 'Sequenced Gearshift', anim: true, desc: 'A drum that engages, reverses and changes speed on a loop. Use a punched card for eight steps, or Use it empty to pick one of three programs.' },
  { key: 'governor', name: 'Governor', anim: true, desc: 'Flyweights that cap the speed beyond it. Use it to cycle 32, 64 and 96 rpm.' },
  { key: 'worm_gear', name: 'Worm Gear', anim: true, desc: 'Slows the turning to an eighth. Only the worm side can drive it.' },
  { key: 'chain_sprocket', name: 'Chain Sprocket', anim: true, desc: 'Face two sprockets along a straight line, up to 16 blocks apart, and a chain joins their shafts without slipping.' },
  { key: 'belt_pulley', name: 'Belt Pulley', anim: true, desc: 'Pulleys up to 9 blocks apart in a line are joined by a leather belt. Use it to pick the size: the big one turns slower.' },
  { key: 'clockwork_motor', name: 'Clockwork Motor', anim: true, desc: 'Use it to wind it (30 s a wind). While wound it turns at 24 rpm and carries 48 stress units.' },
  { key: 'funnel', name: 'Funnel', anim: false, desc: 'Takes items lying in it, or from a depot, basin or crate behind it, and passes them out of its front. Use with an item to filter; empty-handed to clear.' },
  { key: 'chute', name: 'Chute', anim: false, desc: 'A vertical drop: takes what lies in it or comes from the block above and lets it fall below. Use with an item to filter.' },
  { key: 'depot', name: 'Depot', anim: false, desc: 'A plate that holds one stack where machines and arms can reach it. Drop items on it or Use it with an item; Use it empty to take the stack.' },
  { key: 'basin', name: 'Basin', anim: false, desc: 'Holds two kinds of item and up to 1000 L of water. A mixer or press above it works what is inside. Use a water bucket to fill it.' },
  { key: 'spout', name: 'Spout', anim: false, desc: 'Under a basin: fills an empty bucket on the depot or belt beneath it from the basin, 1000 L at a time.' },
  { key: 'item_drain', name: 'Item Drain', anim: false, desc: 'Empties full buckets dropped on it into the basin below, and passes the empty ones out of its front.' },
  { key: 'mixer', name: 'Mixer', anim: true, desc: 'Stirs the basin below it at 32 rpm or more: dough, alloys. Needs a ratio dial or a second source to reach that speed from one crank.' },
  { key: 'mech_press', name: 'Mechanical Press', anim: true, desc: 'A turning ram over a basin: presses the items in it into plates.' },
  { key: 'deployer', name: 'Deployer', anim: true, desc: 'A mechanical hand holding a stack. Every two seconds it uses it on the block in front: places, breaks with a tool, tills, strikes a hand station.' },
  { key: 'mech_arm', name: 'Mechanical Arm', anim: true, desc: 'Use a wrench on it, then on a source and up to four targets within 3 blocks, then on it again. It carries items from the source to the targets in turn.' },
  { key: 'mech_drill', name: 'Mechanical Drill', anim: true, desc: 'A turning bit that breaks the block in front of it, one after another; the drops fall where the block was.' },
  { key: 'shear_pin', name: 'Shear Pin', anim: false, desc: 'The weak link. Use to pick its metal: plain, copper 6, bronze 12, iron 24 su. It snaps when the torque through it tops its rating, so the engine upstream lives.' },
  { key: 'flywheel', name: 'Flywheel', anim: true, desc: 'A heavy wheel with real momentum: slow to spin up, slow to stop. It rides pulsing loads (press, hammer) through their peaks and keeps the line coasting when power stops.' },
  { key: 'brake', name: 'Brake', anim: true, desc: 'Use to engage: takes 24 su and stops a coasting flywheel fast. A lit signal cell beside it flips it. Held hard it heats and fades.' },
  { key: 'pillow_block', name: 'Pillow Block', anim: false, desc: 'A bearing in a shaft line. A long unsupported run whips near 160 / length rpm; a pillow block in the run splits it.' },
  { key: 'cam_drum', name: 'Cam Drum', anim: true, desc: 'A pegged drum, a music box for machines. Turning, it lights signal wire on its four sides in a pattern. Use it to pick one of six programs.' },
  { key: 'logic_gate', name: 'Logic Gate', anim: true, desc: 'Reads the signal cells on its left and right and drives the cell in front: AND, OR, XOR, NOT, latch, counters, compare, delay. Use it to cycle modes.' },
  { key: 'differential', name: 'Differential', anim: true, desc: 'Two shafts meet here and it turns at their mean speed, even when they turn opposite ways. It hands that on to the sides they did not come from.' },
  { key: 'treadwheel', name: 'Treadwheel', anim: true, desc: 'A big wheel to walk in. It turns at 12 rpm and carries 12 stress units while you or a tame animal stand on top of it.' },
  { key: 'saw_arm', name: 'Saw Arm', anim: true, desc: 'A deployer with a blade. Every three seconds it fells the whole tree in front of it, log by log, and the logs fall as items. It needs no fuel.' },
  { key: 'item_vault', name: 'Item Vault', anim: false, desc: 'Holds 108 stacks of anything. Funnels, arms and belts fill and empty it. Use it with an item to store, empty-handed to take the biggest stack.' },
  { key: 'vacuum_collector', name: 'Vacuum Collector', anim: true, desc: 'A turning fan that sucks loose items from four blocks around and sends them out of its front into whatever is there.' },
  { key: 'signal_wire', name: 'Signal Wire', anim: true, flat: true, desc: 'Carries a signal 15 blocks from a lever, plate or metronome. It loses one step per wire and lights while it carries one.' },
  { key: 'crank_lever', name: 'Crank Lever', anim: true, desc: 'Use it to throw it on or off. Touching machines (arms, deployers, drills, clutches) read the signal.' },
  { key: 'pressure_plate', name: 'Pressure Plate', anim: true, flat: true, desc: 'Signals while an item lies on it or you stand on it.' },
  { key: 'metronome', name: 'Metronome', anim: true, desc: 'Signals for one second in every four. Set an arm or a clutch beside it to pace a line.' },
  { key: 'signal_lamp', name: 'Signal Lamp', anim: true, desc: 'Lights while a powered signal cell touches it.' },
  { key: 'bell', name: 'Bell', anim: false, desc: 'Rings when a signal reaches it, and whenever a machine within 12 blocks seizes, jams or is overloaded.' },
  { key: 'tally_board', name: 'Tally Board', anim: false, desc: 'Passes items on out of its front like a funnel and counts them. Use it to reset the count.' },
  { key: 'clockface', name: 'Clockface', anim: false, desc: 'A dial that shows the time of day under the goggles.' },
  { key: 'wind_vane', name: 'Wind Vane', anim: false, desc: 'Shows the wind the turbines feel, the same rise and fall, with no bonus for where it stands.' },
  { key: 'contraption_frame', name: 'Contraption Frame', anim: false, desc: 'A timber frame that holds a moving structure together. Pistons and bearings carry every frame and workshop part connected to them.' },
  { key: 'piston', name: 'Piston', anim: true, desc: 'While turning it pushes the structure in front of it out one block at a time (up to 4), leaving a rod; stopped, it pulls it back. A lever makes it a lift.' },
  { key: 'bearing', name: 'Bearing', anim: true, desc: 'Turns the structure on top of it a quarter turn every 1.5 s, with the shaft: left or right. Machines on it stay powered through the bearing.' },
  { key: 'rail', name: 'Rail', anim: false, flat: true, desc: 'A track of slats. A skiff above a line of rails rolls along it, waits at the end and turns round.' },
  { key: 'skiff', name: 'Skiff', anim: false, desc: 'A little ore cart on rails. It holds a stack that arms and funnels load and unload. Use it empty-handed to board. A signal cell it touches brakes it while off.' },
];

/** Parts that never carry rotation: logistics, signals and decor (kinetic ones join shaft networks). */
export const NON_KINETIC: ReadonlySet<string> = new Set(['funnel', 'chute', 'depot', 'basin', 'spout', 'item_drain', 'item_vault', 'tally_board', 'signal_wire', 'crank_lever', 'pressure_plate', 'metronome', 'signal_lamp', 'bell', 'clockface', 'wind_vane', 'logic_gate', 'contraption_frame', 'rail', 'skiff']);

export const PART_ITEMS: ItemSpec[] = [
  { key: 'bronze_cog', name: 'Bronze Cog', category: 'material', age: BRONZE, stack: 64, desc: 'A toothed bronze wheel. Gearboxes, dials and motors are built from them.' },
  { key: 'punched_card', name: 'Punched Card', category: 'material', age: BRONZE, stack: 16, desc: 'A stiff card of eight steps for a sequenced gearshift. Each step sets a speed ratio, a direction and how many seconds it runs.' },
];

const front = (key: string, anim: boolean) => ({ side: 'ws_machine_side', top: 'ws_hopper_top', bottom: 'ws_machine_side', front: `ws_${key}_front`, ...(anim ? { frontActive: `ws_${key}_front_on` } : {}) });

export const PART_BLOCKS: BlockSpec[] = PART_DEFS.map((d): BlockSpec => ({
  key: d.key, name: d.name, desc: d.desc, category: 'machine', age: BRONZE, hardness: 1.2, tool: 'pickaxe', minTier: 0, stack: 16,
  oriented: !d.flat, textures: d.flat
    ? { top: `ws_${d.key}_front`, ...(d.anim ? { topActive: `ws_${d.key}_front_on` } : {}), side: 'ws_belt_side', bottom: 'ws_machine_side' }
    : front(d.key, d.anim),
  ...(d.flat ? { shape: 'slab' as const, opaque: false } : {}),
}));
