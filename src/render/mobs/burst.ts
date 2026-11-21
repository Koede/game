/**
 * The break-apart of an automaton (spec 19.5): pieces cut from its own model boxes (so the debris has its colours, and
 * the ember parts break into glowing pieces), thrown outward and up from the body's middle. Pure over a DebrisField.
 */
import type { DebrisField } from './debris';
import { pickPart, type AutomatonAnchors } from './anchors';

/** How many pieces an automaton of this height (blocks) breaks into. */
export const piecesFor = (height: number): number => Math.min(56, 14 + Math.round(height * 14));

/**
 * Spawns `pieces` cubes for an automaton standing at x,y,z facing `yaw` at `scale`. `rnd` gives 0..1 (Math.random in
 * the game, a seeded one in tests); `sky` and `block` is the light where it stood.
 */
export function breakApart(
  a: AutomatonAnchors, field: DebrisField, x: number, y: number, z: number, yaw: number, scale: number,
  sky: number, block: number, pieces: number, rnd: () => number,
): void {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const mid = a.middle;
  for (let n = 0; n < pieces; n++) {
    const i = pickPart(a, rnd());
    const b = a.boxes;
    const o = i * 6;
    const lx = (b[o] + (b[o + 3] - b[o]) * rnd()) * scale;
    const ly = (b[o + 1] + (b[o + 4] - b[o + 1]) * rnd()) * scale;
    const lz = (b[o + 2] + (b[o + 5] - b[o + 2]) * rnd()) * scale;
    const wx = cy * lx + sy * lz;
    const wz = -sy * lx + cy * lz;
    const dx = wx;
    const dz = wz;
    const d = Math.max(0.2, Math.hypot(dx, dz));
    const out = 1.6 + rnd() * 3;
    const dims = Math.cbrt((b[o + 3] - b[o]) * (b[o + 4] - b[o + 1]) * (b[o + 5] - b[o + 2]));
    const j = 0.9 + rnd() * 0.2;
    const hot = a.emissive[i];
    field.spawn(
      {
        x: x + wx, y: y + ly, z: z + wz,
        vx: (dx / d) * out + (rnd() - 0.5), vy: 2.5 + rnd() * 4.5 + Math.max(0, ly - mid) * 1.2, vz: (dz / d) * out + (rnd() - 0.5),
        size: Math.min(0.17, Math.max(0.05, dims * 0.36)) * (0.75 + rnd() * 0.5) * scale,
        r: Math.min(1, a.colors[i * 3] * j), g: Math.min(1, a.colors[i * 3 + 1] * j), b: Math.min(1, a.colors[i * 3 + 2] * j),
        emissive: hot, sky, block, life: hot ? 1.7 + rnd() * 0.6 : 2.4 + rnd() * 1.2,
      },
      rnd() * 2 - 1, rnd() * 2 - 1,
    );
  }
}
