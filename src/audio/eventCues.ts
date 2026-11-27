/**
 * Voices events that have no sound of their own: other systems only announce what happened on the bus, and these
 * cues turn the announcement into a one-shot. Kept here so a feature does not have to know about audio.
 */
import type { GameBus } from '../core/context';

/** Subscribes the cues; returns the function that removes them. Sounds are positioned where the event has a position. */
export function bindEventCues(bus: GameBus): () => void {
  const offs = [
    bus.on('photo:snap', () => bus.emit('sfx', { name: 'shutter' })),
    bus.on('blueprint:grant', () => bus.emit('sfx', { name: 'blueprint_unfurl' })),
    bus.on('legendary:proc', (e) => bus.emit('sfx', { name: 'legend_proc', x: e.x, y: e.y, z: e.z })),
    bus.on('buff:gained', () => bus.emit('sfx', { name: 'buff_gain' })),
    // The power came back, or sagged: the machines' own on and off, a touch higher or lower.
    bus.on('power:alert', (e) => {
      if (e.kind === 'recovered') bus.emit('sfx', { name: 'machine_on', x: e.x, y: e.y, z: e.z, pitch: 1.25 });
      else if (e.kind === 'brownout') bus.emit('sfx', { name: 'machine_off', x: e.x, y: e.y, z: e.z, pitch: 0.7 });
    }),
    // A hearth lost its walls: the fire dies back with a low breath.
    bus.on('hearth:unformed', (e) => bus.emit('sfx', { name: 'fire_out', x: e.x, y: e.y, z: e.z, pitch: 0.55 })),
  ];
  return () => {
    for (const off of offs) off();
  };
}
