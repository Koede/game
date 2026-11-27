import { describe, expect, it } from 'vitest';
import { AUTOMATONS, CREATURES, creature, item } from '../core/registry';
import { spawnPlacesAt } from '../core/hostile';
import { ALL_BIOMES, type BiomeKey } from '../core/types';
import { BIOME_ANIMALS, BIOME_SERVANTS } from './biomeMobs';

const NIGHT_PLACE: Record<string, string> = { woodland: 'wood_night', dunes: 'dunes_night', frostfell: 'frost_night', scar: 'scar_night', marsh: 'marsh_night' };

describe('biome life (docs/SYNERGY_PLAN.md section 3)', () => {
  it('gives every biome its own animal and its own feral servant', () => {
    for (const biome of ALL_BIOMES) {
      const own = BIOME_ANIMALS.filter((c) => c.biomes.length === 1 && c.biomes[0] === biome);
      expect(own, `${biome} animal`).toHaveLength(1);
      expect(CREATURES.map((c) => c.key)).toContain(own[0].key);
      const servants = BIOME_SERVANTS.filter((c) => c.biomes.length === 1 && c.biomes[0] === biome);
      expect(servants, `${biome} servant`).toHaveLength(1);
      expect(AUTOMATONS.map((c) => c.key)).toContain(servants[0].key);
    }
  });

  it('lets a servant spawn only on its own biome at night, never in the others', () => {
    for (const s of BIOME_SERVANTS) {
      const own = s.biomes[0] as BiomeKey;
      for (const biome of ALL_BIOMES) {
        const places = spawnPlacesAt({ skyOpen: true, y: 40, night: true, biome });
        const weights = s.hostile!.habitat.places;
        const lives = places.some((p) => (weights[p] ?? 0) > 0);
        expect(lives, `${s.key} in ${biome}`).toBe(biome === own);
      }
      expect(Object.keys(s.hostile!.habitat.places)).toEqual([NIGHT_PLACE[own]]);
      // By day, in the open, nothing of its kind spawns.
      expect(spawnPlacesAt({ skyOpen: true, y: 40, night: false, biome: own }).some((p) => (s.hostile!.habitat.places[p] ?? 0) > 0)).toBe(false);
    }
  });

  it('drops only items that exist, tied to what the servant is made of', () => {
    for (const c of [...BIOME_ANIMALS, ...BIOME_SERVANTS]) for (const d of c.drops) expect(item(d.item).key).toBe(d.item);
    expect(creature('barkwright').drops.map((d) => d.item)).toContain('plank');
    expect(creature('glass_scarab').drops.map((d) => d.item)).toContain('silica');
    expect(creature('rime_husk').drops.map((d) => d.item)).toContain('ice');
    expect(creature('magma_crawler').drops.map((d) => d.item)).toContain('coal');
    expect(creature('bog_lantern').drops.map((d) => d.item)).toContain('glowcap');
  });
});
