/**
 * The cool glow (glowcaps cyan, crystal clusters violet, spec 14) for instanced models lit from a LightProbe - animals
 * and machine parts - so they take the same colour as the terrain, the held item and the particles beside them.
 * One float per instance: the share 0..1 of block light that is cool, negative when it is violet.
 */
import type { LightProbe } from './lightProbe';
import { COOL_CYAN, COOL_VIOLET } from './shaders/chunk';

const vec3 = (c: readonly number[]): string => `vec3(${c.map((v) => v.toFixed(3)).join(', ')})`;

/** GLSL (after LIGHT_GLSL, which declares uBlockLight): the block-light colour for a signed cool share. */
export const COOL_TINT_GLSL = /* glsl */ `
vec3 coolBlockTint(float cool) {
  if (cool == 0.0) return uBlockLight;
  vec3 c = cool < 0.0 ? ${vec3(COOL_VIOLET)} : ${vec3(COOL_CYAN)};
  return mix(uBlockLight, c, abs(cool));
}
`;

/** The last probe's cool share, signed: negative for violet (crystals), positive for cyan (glowcaps). */
export const signedCool = (probe: LightProbe): number => (probe.violet ? -probe.cool : probe.cool);
