/**
 * Seams Game uses to connect workshop, magic, distillery and road speed without those modules importing each other.
 * DOM-free. The chunk-mesh hider only rewrites index buffers already on the GPU meshes.
 */
import * as THREE from 'three';
import { DRINK_BUFFS } from '../core/brewing';
import { DRINK_COOLDOWN_S, PLAYER_HEIGHT, PLAYER_WIDTH } from '../core/constants';
import { elixirGrant, ESSENCE_DRINKS, roadSpeedOf, type ElixirGrant } from '../core/distill';
import { item } from '../core/registry';
import type { IWorld } from '../core/types';
import type { PlayerState } from '../game/playerState';
import { sweepBox } from '../vehicles/collide';
import { BODY_HEIGHT, HALF_WIDTH } from '../vehicles/tractor';
import { createRigScreen } from '../ui/screens/distill';
import type { GameBus } from '../core/context';
import type { Exploration } from '../game/exploration';
import type { GameUI } from '../ui/gameUI';
import { setMapMarkerSource } from '../ui/screens/log/journalMap';
import { createWaypointScreen } from '../ui/screens/waypoint/waypointScreen';

const PLAYER_HALF = PLAYER_WIDTH / 2;
/** Same slack the treadwheel used for the player before tame animals counted. */
const PLAYER_XZ = 0.7;

export interface Feet {
  x: number;
  y: number;
  z: number;
}

export interface TameMob extends Feet {
  tame: boolean;
}

/** True when the player's feet are on the cell the treadwheel watches (the cell above the wheel). */
export function playerOnTreadwheel(feet: Feet, x: number, y: number, z: number): boolean {
  return Math.abs(feet.x - (x + 0.5)) < PLAYER_XZ && Math.abs(feet.z - (z + 0.5)) < PLAYER_XZ && feet.y > y - 0.2 && feet.y < y + 0.4;
}

/** True when a mob's feet point lies in the block cell. */
export function mobFeetInCell(mob: Feet, x: number, y: number, z: number): boolean {
  return Math.floor(mob.x) === x && Math.floor(mob.z) === z && mob.y >= y && mob.y < y + 1;
}

/**
 * Treadwheel occupancy. The wheel itself stays 12 rpm / 24 su; this only answers "is something standing on it".
 * A tame mob counts. A wild mob does not.
 */
export function treadwheelOccupied(player: Feet, mobs: readonly TameMob[], x: number, y: number, z: number): boolean {
  if (playerOnTreadwheel(player, x, y, z)) return true;
  for (const mob of mobs) if (mob.tame && mobFeetInCell(mob, x, y, z)) return true;
  return false;
}

/**
 * Puts the body on the centre of the skiff block (feet on its top). The eye stays PLAYER_EYE above the feet;
 * this does not write a separate eye. Null leaves the body where it is so walking works again.
 * Returns true while the ride is held.
 */
export function followRide(body: { position: Feet; velocity: Feet }, cell: { x: number; y: number; z: number } | null): boolean {
  if (!cell) return false;
  body.position.x = cell.x + 0.5;
  body.position.z = cell.z + 0.5;
  body.position.y = cell.y + 1;
  body.velocity.x = 0;
  body.velocity.y = 0;
  body.velocity.z = 0;
  return true;
}

/** Wind-vane clock and punched-card return, assigned onto the workshop. */
export function workshopClockAndPack(
  clock: { readonly worldTimeS: number },
  add: (item: string, count: number) => number,
): { timeS: () => number; giveItem: (item: string, count: number) => void } {
  return {
    timeS: () => clock.worldTimeS,
    giveItem: (item, count) => {
      add(item, count);
    },
  };
}

/** `setAura` as Game calls it: the rod string, including null, with nothing substituted. */
export function showRodAura(hud: { setAura(text: string | null): void }, reading: string | null): void {
  hud.setAura(reading);
}

/** Registers the wrench's distillery rig screen. */
export function registerDistillRig(ui: { registerScreen(type: 'distill_rig', factory: typeof createRigScreen): void }): void {
  ui.registerScreen('distill_rig', createRigScreen);
}

/**
 * The waypoint picker and the journal map's markers (docs/api/waypoints.md, journal.md): Use on a stone with somewhere
 * to go opens the picker instead of cycling toasts; the Hearth Log map pins stones and treasure-map landmarks.
 */
export function registerWaypointPicker(ui: Pick<GameUI, 'registerScreen'>, bus: GameBus, exploration: Exploration): void {
  ui.registerScreen('waypoint', (request, ctx) => createWaypointScreen(request, ctx, exploration));
  exploration.openPicker = (s) => bus.emit('ui:open', { screen: { type: 'waypoint', x: s.x, y: s.y, z: s.z } });
  setMapMarkerSource(() => exploration.mapMarks());
}

/**
 * bindWorkshop runs before any magic.tick. tick() throws if bind was skipped, so a reordered Game constructor fails loudly.
 */
export class MagicWorkshopLink {
  private bound = false;

  bind(magic: { bindWorkshop(workshop: unknown): void }, workshop: unknown): void {
    magic.bindWorkshop(workshop);
    this.bound = true;
  }

  tick(magic: { tick(dt: number): void }, dt: number): void {
    if (!this.bound) throw new Error('magic.tick before bindWorkshop');
    magic.tick(dt);
  }
}

export type ElixirDrink =
  | { kind: 'no' }
  | { kind: 'refused' }
  | { kind: 'drunk'; grant: ElixirGrant };

/**
 * Drinks one elixir from the selected slot. Calls `elixirGrant` and applies its buff for `buffS`
 * (three times the source drink) and its `strengthAdd` as flat strength for that same time.
 * Elixirs are not drink items, so they stay out of `DRINKS`. A second elixir keeps the higher
 * strength and refreshes the timer; it does not add the bonuses together.
 */
export function drinkElixir(player: PlayerState): ElixirDrink {
  if (player.dead) return { kind: 'no' };
  const stack = player.heldStack();
  if (!stack) return { kind: 'no' };
  const row = ESSENCE_DRINKS.find((d) => d.elixir === stack.item);
  if (!row) return { kind: 'no' };
  if (player.drinkCooldownS > 0) return { kind: 'refused' };
  const source = item(row.item).drink;
  if (!source) return { kind: 'no' };
  const grant = elixirGrant(row, source.buffS);
  player.inventory.removeAt(player.selectedSlot, 1);
  const granted = player.buffs.grant(grant.buff, grant.buffS);
  player.buffs.grantStrength(grant.strengthAdd, grant.buffS);
  player.drinkCooldownS = DRINK_COOLDOWN_S;
  const drunk = (player.stats.drunk ??= {});
  drunk[grant.item] = (drunk[grant.item] ?? 0) + 1;
  const { bus, position: p } = player;
  bus.emit('player:drank', { item: grant.item });
  bus.emit('buff:gained', { buff: grant.buff, durationS: grant.buffS });
  bus.emit('sfx', { name: 'sip', x: p.x, y: p.y + 1.5, z: p.z });
  const name = DRINK_BUFFS[grant.buff].name;
  const text = granted.replaced ? `${name} replaces ${DRINK_BUFFS[granted.replaced].name}` : `${name}: ${DRINK_BUFFS[grant.buff].effect}`;
  bus.emit('toast', { text, kind: 'good', item: grant.item });
  return { kind: 'drunk', grant };
}

/** Block the feet are standing on. */
export function blockUnder(world: Pick<IWorld, 'getBlock'>, x: number, y: number, z: number): string {
  return world.getBlock(Math.floor(x), Math.floor(y - 0.02), Math.floor(z)).key;
}

/** Walk multiplier from `roadSpeedOf`. Sprint, swim and flight stay at their own speeds. */
export function walkRoadFactor(blockKey: string, opts: { onGround: boolean; sprinting: boolean; inLiquid: boolean; flying: boolean }): number {
  if (!opts.onGround || opts.sprinting || opts.inLiquid || opts.flying) return 1;
  return roadSpeedOf(blockKey)?.walk ?? 1;
}

/** Tractor multiplier from `roadSpeedOf` while the machine actually moved. */
export function tractorRoadFactor(blockKey: string, moved: boolean): number {
  if (!moved) return 1;
  return roadSpeedOf(blockKey)?.tractor ?? 1;
}

/**
 * Adds the rest of a road-speed step on top of a move that already happened at 1x.
 * The extra slice is swept, so a wall stops it. Returns the extra distance covered.
 */
export function extendRoadMove(
  world: IWorld,
  pos: { x: number; y: number; z: number },
  fromX: number,
  fromZ: number,
  factor: number,
  hw: number,
  height: number,
): number {
  if (!(factor > 1)) return 0;
  const dx = (pos.x - fromX) * (factor - 1);
  const dz = (pos.z - fromZ) * (factor - 1);
  if (dx === 0 && dz === 0) return 0;
  const box = { x: pos.x, y: pos.y, z: pos.z };
  const mx = sweepBox(world, box, 0, dx, hw, height);
  const mz = sweepBox(world, box, 2, dz, hw, height);
  pos.x = box.x;
  pos.z = box.z;
  return Math.hypot(mx, mz);
}

export const PLAYER_ROAD_HALF = PLAYER_HALF;
export const PLAYER_ROAD_HEIGHT = PLAYER_HEIGHT;
export const TRACTOR_ROAD_HALF = HALF_WIDTH;
export const TRACTOR_ROAD_HEIGHT = BODY_HEIGHT;

export interface StructureMotionFrom {
  from: readonly [number, number, number];
}

/** Cells the chunk mesh should skip while a structure step is open: each motion's `from`, plus `vacating()`. */
export function hiddenStructureCells(
  motions: readonly StructureMotionFrom[],
  vacating: readonly (readonly [number, number, number])[],
): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const motion of motions) out.push([motion.from[0], motion.from[1], motion.from[2]]);
  for (const cell of vacating) out.push([cell[0], cell[1], cell[2]]);
  return out;
}

const HIDE_ORIGINAL = 'structureHideOriginal';
const HIDE_KEY = 'structureHideKey';
const HIDE_EPS = 1e-3;

function cellListKey(cells: readonly (readonly [number, number, number])[]): string {
  if (cells.length === 0) return '';
  const parts = cells.map((c) => `${c[0]},${c[1]},${c[2]}`);
  parts.sort();
  return parts.join('|');
}

function triangleInCell(position: ArrayLike<number>, ia: number, ib: number, ic: number, cell: readonly [number, number, number]): boolean {
  const x0 = cell[0] - HIDE_EPS;
  const x1 = cell[0] + 1 + HIDE_EPS;
  const y0 = cell[1] - HIDE_EPS;
  const y1 = cell[1] + 1 + HIDE_EPS;
  const z0 = cell[2] - HIDE_EPS;
  const z1 = cell[2] + 1 + HIDE_EPS;
  for (const i of [ia, ib, ic]) {
    const x = position[i * 3];
    const y = position[i * 3 + 1];
    const z = position[i * 3 + 2];
    if (x < x0 || x > x1 || y < y0 || y > y1 || z < z0 || z > z1) return false;
  }
  return true;
}

function filterTriangles(position: ArrayLike<number>, original: Uint32Array, originX: number, originZ: number, cells: readonly (readonly [number, number, number])[]): Uint32Array {
  const local: [number, number, number][] = [];
  for (const cell of cells) {
    const lx = cell[0] - originX;
    const lz = cell[2] - originZ;
    if (lx < -1 || lx > 16 || lz < -1 || lz > 16) continue;
    local.push([lx, cell[1], lz]);
  }
  if (local.length === 0) return original;
  const keep = new Uint32Array(original.length);
  let n = 0;
  let dropped = false;
  for (let i = 0; i + 2 < original.length; i += 3) {
    const a = original[i];
    const b = original[i + 1];
    const c = original[i + 2];
    let hide = false;
    for (const cell of local) {
      if (triangleInCell(position, a, b, c, cell)) {
        hide = true;
        break;
      }
    }
    if (hide) {
      dropped = true;
      continue;
    }
    keep[n++] = a;
    keep[n++] = b;
    keep[n++] = c;
  }
  return dropped ? keep.subarray(0, n) : original;
}

/**
 * Drops triangles that sit inside `cells` from chunk meshes under `root` (the renderer's `chunks` group).
 * An empty list puts the original indices back. A remesh replaces the geometry, so the next call captures it fresh.
 */
export function applyStructureHide(root: THREE.Object3D | null | undefined, cells: readonly (readonly [number, number, number])[]): void {
  if (!root) return;
  const key = cellListKey(cells);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const position = geo.getAttribute('position');
    if (!position) return;
    if (geo.userData[HIDE_KEY] === key) return;
    let original = geo.userData[HIDE_ORIGINAL] as Uint32Array | undefined;
    if (!original) {
      const index = geo.getIndex();
      if (!index) return;
      original = Uint32Array.from(index.array);
      geo.userData[HIDE_ORIGINAL] = original;
    }
    const next = key === '' ? original : filterTriangles(position.array, original, mesh.position.x, mesh.position.z, cells);
    geo.setIndex(new THREE.BufferAttribute(next, 1));
    geo.userData[HIDE_KEY] = key;
  });
}
