/**
 * Machine status, shown on the block itself instead of in an icon.
 *
 * A machine face has up to six looks (status only shows while stopped; a running machine always shows its running face):
 *   running  - the voxel's active flag (the block's own `*_on` texture, drawn full-bright where it glows)
 *   idle     - switched off or nothing to do: the plain "off" texture, i.e. the block's base face
 *   starved  - wants to work but lacks fuel, power, water or input: the off face with a red "empty" badge
 *   full     - cannot work because its output has no room: the off face with an amber "stacked" badge
 *   worn     - still works but is wearing out: the off face a little duller, scuffed, with a grey badge (the machine-wear system sets it)
 *   broken   - damaged and stopped: the off face, darkened and cracked (also set by the machine-wear system)
 *
 * Everything but running and idle is stored in bits 13-15 of the voxel (the variant bits; machines use no
 * variant otherwise) and drawn from textures that are *derived from the off texture* (see
 * src/render/textures/status.ts), so a block opts in with `textures.status: true` and nobody paints
 * anything extra. Content, sim and renderer only share this file.
 */

export const MachineStatus = { None: 0, Starved: 1, Full: 2, Worn: 3, Broken: 4 } as const;
export type MachineStatusCode = (typeof MachineStatus)[keyof typeof MachineStatus];

/** Suffix key per status code (index 0 = no status). */
export const STATUS_KEYS = ['', 'starved', 'full', 'worn', 'broken'] as const;
export const STATUS_COUNT = STATUS_KEYS.length;
const SEP = '_stat_';

/** Name of the derived texture that shows `status` on top of texture `base`. */
export const statusTextureName = (base: string, status: number): string =>
  status > 0 && status < STATUS_COUNT ? `${base}${SEP}${STATUS_KEYS[status]}` : base;

/** Splits a derived texture name back into its base and status code, or null for a plain texture. */
export function parseStatusTexture(name: string): { base: string; status: number } | null {
  const i = name.lastIndexOf(SEP);
  if (i <= 0) return null;
  const status = STATUS_KEYS.indexOf(name.slice(i + SEP.length) as (typeof STATUS_KEYS)[number]);
  return status > 0 ? { base: name.slice(0, i), status } : null;
}

/** Bits 13-15 of a voxel (a block with status looks uses all three: 0..4 are defined). */
export const voxelStatus = (v: number): number => (v >> 13) & 7;
export const withStatus = (v: number, status: number): number => (v & ~(7 << 13)) | ((status & 7) << 13);
