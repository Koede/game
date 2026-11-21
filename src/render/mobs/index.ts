/** src/render/mobs: the animals' 3D models (one instanced draw call per species, plus blob shadows). */
export { MobRenderer, MOB_DRAW_CAPACITY, PROBES_PER_FRAME, FRESH_PROBES, type MobRenderView, type MobScene } from './mobRenderer';
export { buildSpeciesGeometry, PART_GROUP, type SpeciesGeometry } from './geometry';
