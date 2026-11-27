/**
 * The ignition finale: when the Starhearth is lit, the journal gets a page and a toast says what the star means.
 * DOM-free. (Goals for after the ignition belong to the objectives list, not here.)
 */
import type { GameBus } from '../core/context';

export function watchFinale(bus: GameBus): () => void {
  return bus.on('game:won', () => {
    bus.emit('town:note', { key: 'star:ignited', text: 'The Starhearth is lit. A white star burns where the furnace was, and the whole valley is warm. Whatever comes next, the fire will not go out.' });
    bus.emit('toast', { text: 'The star burns for as long as you keep the grid. Take a photo of it.', kind: 'good' });
  });
}
