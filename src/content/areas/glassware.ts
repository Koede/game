/**
 * The materials of the glassware models (docs/api/glass.md): smooth clear glass and polished brass. They are never placed or
 * held; the glass mesher (src/world/meshGlass.ts) borrows their tiles for the glass and brass parts of every glass piece.
 */
import type { AreaContent } from '../area';
import type { BlockSpec } from '../../core/types';

const material = (key: string, name: string): BlockSpec => ({
  key, name, desc: `The ${name.toLowerCase()} of the glassware models. Not a block you can place.`, hardness: -1, item: false, drops: 'none',
  opaque: false, translucent: true, category: 'block', textures: { all: key },
});

export default {
  blocks: [material('glassware_glass', 'Glassware Glass'), material('glassware_brass', 'Glassware Brass')],
  recipes: [],
} satisfies AreaContent;
