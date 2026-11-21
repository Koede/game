/** The fission pile (spec 3.3) and explosions. */
import { AMBIENT_TEMP_C, MAX_HEALTH, PLAYER_HEIGHT } from '../core/constants';
import { blockId, machine } from '../core/registry';
import { AIR, makeVoxel } from '../core/types';
import type { MachineEntity, SimContext, SimNode } from './entities';
import { burnFuel, holdsFuel, type Behaviour } from './machines';

const PILE = machine('fission_pile');
const P = PILE.params ?? {};

export const pileCooled = (node: SimNode): boolean => node.water >= P.minWater;

export const fissionPile: Behaviour = {
  prepare(node) {
    const e = node.e as MachineEntity;
    e.availW = e.on && holdsFuel(node) && pileCooled(node) ? PILE.outputW ?? 0 : 0;
  },
  apply(node, ctx, dt) {
    const e = node.e as MachineEntity;
    const reacting = e.on && holdsFuel(node);
    e.outW = e.availW * (node.net ? node.net.load : 0);
    if (e.outW > 0) burnFuel(node, ctx, e.outW * dt);

    if (reacting && !pileCooled(node)) {
      e.coreC += P.heatRateC * dt;
    } else {
      const target = reacting ? P.runTempC : AMBIENT_TEMP_C;
      if (e.coreC > target) e.coreC = Math.max(target, e.coreC - P.coolRateC * dt);
      else if (e.coreC < target) e.coreC = Math.min(target, e.coreC + P.heatRateC * dt);
    }
    ctx.setActive(node, reacting);

    if (e.coreC < P.warnTempC) {
      e.warned = false;
      e.hotS = 0;
      return;
    }
    if (!e.warned) {
      e.warned = true;
      e.alarmS = 0;
      ctx.bus.emit('power:alert', { kind: 'meltdown_warning', message: `${PILE.name} overheating - give it water or switch it off`, x: e.x, y: e.y, z: e.z });
      ctx.bus.emit('toast', { text: `${PILE.name} is overheating!`, kind: 'bad' });
    }
    e.alarmS -= dt;
    if (e.alarmS <= 0) {
      e.alarmS = P.alarmIntervalS;
      ctx.bus.emit('sfx', { name: 'alarm', x: e.x, y: e.y, z: e.z });
    }
    const pos = ctx.player.position;
    const d = Math.hypot(pos.x - (e.x + 0.5), pos.y + PLAYER_HEIGHT / 2 - (e.y + 0.5), pos.z - (e.z + 0.5));
    if (d < P.warnRadius) ctx.player.extraRadiation += P.warnRadiation * (1 - d / P.warnRadius);

    if (e.coreC < P.meltdownTempC) {
      e.hotS = 0;
      return;
    }
    e.hotS += dt;
    if (e.hotS >= P.meltdownSeconds) ctx.meltdown(node);
  },
};

/** Radius of a pile's meltdown blast. */
export const BLAST_RADIUS = P.blastRadius;

/**
 * Removes every block in a sphere except unbreakable solids (corestone), then hurts the player by distance:
 * lethal at the centre, nothing beyond twice the radius. The caller decides what the centre becomes.
 */
export function explode(ctx: SimContext, x: number, y: number, z: number, radius: number): void {
  const { world, player, bus } = ctx;
  const r = Math.ceil(radius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        const def = world.getBlock(x + dx, y + dy, z + dz);
        if (def.id === 0 || (def.hardness < 0 && def.liquid === null)) continue;
        world.setVoxel(x + dx, y + dy, z + dz, AIR, 'sim');
      }
    }
  }
  bus.emit('explosion', { x, y, z, radius });
  bus.emit('sfx', { name: 'explosion', x, y, z });
  const pos = player.position;
  const d = Math.hypot(pos.x - (x + 0.5), pos.y + PLAYER_HEIGHT / 2 - (y + 0.5), pos.z - (z + 0.5));
  const reach = radius * 2;
  if (d < reach && !player.dead) player.damage(Math.ceil(MAX_HEALTH * (1 - d / reach)), 'explosion');
}

/** A pile melts down: the blast, then corium where it stood. */
export function meltDown(ctx: SimContext, node: SimNode): void {
  const { x, y, z } = node.e;
  explode(ctx, x, y, z, BLAST_RADIUS);
  ctx.world.setVoxel(x, y, z, makeVoxel(blockId('corium')), 'sim');
  ctx.bus.emit('toast', { text: `The ${PILE.name.toLowerCase()} melted down`, kind: 'bad' });
}
