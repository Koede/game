/**
 * The `formedModel` registry: one entry per kind of multiblock structure (the hearths today; the boiler vessel and the
 * distillery rigs later). A kind says how to FIND its formed instances in a world and how to BUILD the merged model of
 * one from a plain spec (tier, size, which shell cells hold parts). The FormedLayer does the rest: it hides the
 * instance's shell blocks, draws the model, animates the snap and takes it down when the structure comes apart.
 */
import type { GameBus } from '../../core/context';
import type { IWorld } from '../../core/types';
import type { ModelData, V3 } from './meshBuilder';

export type Cell = readonly [number, number, number];

/** What stands in a shell cell besides plain wall. */
export type PartKind = 'window' | 'item_hatch' | 'fluid_hatch' | 'port' | 'blower' | 'electrode' | (string & {});

export interface FormedPart {
  /** Cell in the model frame (the box's minimum corner is 0,0,0). */
  cell: Cell;
  /** Outward normal of the face it is on (axis unit vector). */
  normal: V3;
  kind: PartKind;
}

/** Everything the model builder needs; two equal specs build the same model. */
export interface FormedSpec {
  kind: string;
  tier: number;
  /** Box size in blocks. */
  size: V3;
  /** False: an open top (a chimney / hood); true: a closed ceiling (a roof). */
  closed: boolean;
  parts: FormedPart[];
  /** The controller's cell and face (the mouth): left as the real block. Null when the kind has none. */
  controller: { cell: Cell; normal: V3 } | null;
}

/** A formed structure as the world has it right now. */
export interface FormedInstance {
  /** Stable id: the same structure keeps it between scans (the controller's position for a hearth). */
  id: string;
  kind: string;
  tier: number;
  /** World cells, inclusive. */
  min: Cell;
  max: Cell;
  closed: boolean;
  controller: Cell;
  /** Temperature the interior glows with (deg C), 0 when cold. */
  tempC: number;
  /** True for a structure that burns gold whatever its temperature reads (the lit Starhearth). */
  gold: boolean;
}

export interface FormedKind {
  kind: string;
  /** Formed instances of this kind within `range` blocks (horizontal) of (x, z). */
  find(world: IWorld, x: number, z: number, range: number, out: FormedInstance[]): void;
  /** Parts of an instance, read off the world (windows, hatches, ports...). */
  parts(world: IWorld, inst: FormedInstance): FormedPart[];
  /** Optional: turns the game's formed / unformed events of this kind into notices (returns the unsubscribe). */
  listen?(bus: GameBus, notify: { formed(id: string): void; unformed(id: string): void }): () => void;
  /** The merged model of a spec. */
  build(spec: FormedSpec): ModelData;
}

const kinds = new Map<string, FormedKind>();

export const formedModel = {
  register(def: FormedKind): void {
    kinds.set(def.kind, def);
  },
  get(kind: string): FormedKind | undefined {
    return kinds.get(kind);
  },
  kinds(): FormedKind[] {
    return [...kinds.values()];
  },
  /** Builds the model of a spec with its kind's builder (throws on an unknown kind). */
  build(spec: FormedSpec): ModelData {
    const k = kinds.get(spec.kind);
    if (!k) throw new Error(`formedModel: no kind "${spec.kind}"`);
    return k.build(spec);
  },
};

/** Cache key of a spec: the same key means the same model, so a layer rebuilds only when it changes. */
export function specKey(spec: FormedSpec): string {
  const parts = spec.parts
    .map((p) => `${p.cell.join(',')}/${p.normal.join(',')}/${p.kind}`)
    .sort()
    .join(';');
  const c = spec.controller ? `${spec.controller.cell.join(',')}/${spec.controller.normal.join(',')}` : '-';
  return `${spec.kind}|${spec.tier}|${spec.size.join('x')}|${spec.closed ? 1 : 0}|${c}|${parts}`;
}
