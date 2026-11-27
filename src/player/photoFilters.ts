/** Photo mode's simple filters: a CSS `filter` string each, used for the live preview and again when the picture is saved. DOM-free. */
export interface PhotoFilter {
  id: string;
  label: string;
  /** A CSS filter list ("none" for the natural look). */
  css: string;
}

export const PHOTO_FILTERS: readonly PhotoFilter[] = [
  { id: 'natural', label: 'Natural', css: 'none' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.35) saturate(1.25) contrast(1.05)' },
  { id: 'faded', label: 'Faded', css: 'sepia(0.55) contrast(0.9) brightness(1.08)' },
  { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.12)' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.55) contrast(1.1)' },
  { id: 'dusk', label: 'Dusk', css: 'hue-rotate(-14deg) saturate(1.3) brightness(0.92) contrast(1.1)' },
];

export const filterById = (id: string): PhotoFilter => PHOTO_FILTERS.find((f) => f.id === id) ?? PHOTO_FILTERS[0];

/** The filter after `id`, wrapping round (an unknown id gives the first). */
export function nextFilter(id: string): PhotoFilter {
  const i = PHOTO_FILTERS.findIndex((f) => f.id === id);
  return PHOTO_FILTERS[(i + 1) % PHOTO_FILTERS.length];
}
