/**
 * Pure lookups over a hearth's structure rules (spec 17.1): which interiors a tier accepts, what an interior grants
 * (crucibles, heat capacity, heat loss, smelting speed) and what the smallest legal shell of a tier costs. No world
 * access: src/sim scans the world and feeds what it found in here, so the numbers live in one place.
 *
 * An interior is [x, z, y] in blocks. x and z are interchangeable (a hearth may face any way); y is the height.
 */
import {
  HEARTH_MAX_TUYERES, HEARTH_OPENING_AREA, HEARTH_SHELL_AREA_REF, HEARTH_SPEED_MAX, HEARTH_SPEED_PER_CELL, HEARTH_TUYERE_BONUS,
} from './constants';
import type { HearthStructureSpec } from './types';

export type Interior = readonly [x: number, z: number, y: number];

/** Whether an interior lies within the tier's bounds (x and z may be swapped against the table). */
export function interiorFits(s: HearthStructureSpec, inner: Interior): boolean {
  const [x, z, y] = inner;
  const within = (a: number, b: number): boolean =>
    a >= s.minInner[0] && a <= s.maxInner[0] && b >= s.minInner[1] && b <= s.maxInner[1];
  return y >= s.minInner[2] && y <= s.maxInner[2] && (within(x, z) || within(z, x));
}

/** Crucibles a formed hearth of this tier has: min(maxCrucibles, x * z + crucibleBonus). */
export const hearthCrucibles = (s: HearthStructureSpec, inner: Interior): number =>
  Math.min(s.maxCrucibles, inner[0] * inner[1] + s.crucibleBonus);

/** Cells of a shell around the interior (frame, faces, floor, and the ceiling when closed), controller and parts included. */
export function shellCells(inner: Interior, closed: boolean): number {
  const [x, z, y] = inner;
  return (x + 2) * (z + 2) * (y + (closed ? 2 : 1)) - x * z * y;
}

/**
 * Face cells (not edges or corners) of a shell: the four walls, the floor and the ceiling. The controller must sit in
 * a wall face; parts (hatches, ports, windows, tuyeres) only in faces; electrodes only in ceiling faces.
 */
export function faceCells(inner: Interior): { walls: number; floor: number; ceiling: number } {
  const [x, z, y] = inner;
  return { walls: 2 * (x + z) * y, floor: x * z, ceiling: x * z };
}

/** Multipliers a formed interior puts on its tier's numbers. */
export interface HearthScale {
  /** On FurnaceTierSpec.heatCapacityJ: sqrt(interior volume). */
  heatCapacity: number;
  /** On FurnaceTierSpec.lossWPerC: shell area / HEARTH_SHELL_AREA_REF. */
  loss: number;
  /** On FurnaceTierSpec.speed: the size bonus (capped at HEARTH_SPEED_MAX) times the tuyere bonus. */
  speed: number;
}

/**
 * What an interior grants (spec 17.1). The shell area is the closed box's cell count; every window (glass face) and,
 * with an open top, every cell over the interior counts HEARTH_OPENING_AREA times instead of once. `tuyeres` are the
 * powered blowers set in the faces (only the first HEARTH_MAX_TUYERES count).
 */
export function hearthScale(inner: Interior, opts: { closed: boolean; windows: number; tuyeres: number }): HearthScale {
  const [x, z, y] = inner;
  const volume = x * z * y;
  const openings = opts.windows + (opts.closed ? 0 : x * z);
  const area = shellCells(inner, true) + openings * (HEARTH_OPENING_AREA - 1);
  const size = Math.min(HEARTH_SPEED_MAX, 1 + HEARTH_SPEED_PER_CELL * (volume - 1));
  const tuyere = 1 + HEARTH_TUYERE_BONUS * Math.min(HEARTH_MAX_TUYERES, Math.max(0, opts.tuyeres));
  return { heatCapacity: Math.sqrt(volume), loss: area / HEARTH_SHELL_AREA_REF, speed: size * tuyere };
}

/** The cheapest legal shell of a tier: its smallest interior, closed only when the tier requires a ceiling. */
export interface SmallestShell {
  inner: Interior;
  closed: boolean;
  /** Every shell cell, controller included. */
  cells: number;
  /** Wall blocks needed: every cell but the controller, the electrodes and the power ports. */
  wall: number;
  electrodes: number;
  powerPorts: number;
}

export function smallestShell(s: HearthStructureSpec): SmallestShell {
  const inner: Interior = [s.minInner[0], s.minInner[1], s.minInner[2]];
  const closed = s.ceiling === 'required';
  const cells = shellCells(inner, closed);
  const electrodes = s.electrodes ?? 0;
  const powerPorts = s.powerPorts ?? 0;
  return { inner, closed, cells, wall: cells - 1 - electrodes - powerPorts, electrodes, powerPorts };
}
