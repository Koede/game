/**
 * Essentia aspects (docs/OVERHAUL_PLAN.md B.1): six primal aspects, twelve compounds (each two primals) and three late
 * aspects (each two compounds). Two aspects are "kin" when equal or when one is a direct component of the other; the
 * research board links aspects only through kin neighbours. Pure data, no registry import.
 */
export const PRIMALS = ['cinder', 'loam', 'brook', 'gale', 'rune', 'rift'] as const;
export const COMPOUNDS = [
  'glow', 'spring', 'vein', 'frost', 'ash', 'wane', 'drive', 'craft', 'mind', 'ward', 'steam', 'clarity',
] as const;
export const LATE = ['spark', 'soul', 'void'] as const;

export type Aspect = (typeof PRIMALS)[number] | (typeof COMPOUNDS)[number] | (typeof LATE)[number];
export type Aspects = Partial<Record<Aspect, number>>;

export const ASPECT_LIST: readonly Aspect[] = [...PRIMALS, ...COMPOUNDS, ...LATE];

export interface AspectInfo {
  key: Aspect;
  name: string;
  tier: 1 | 2 | 3;
  parts: readonly [Aspect, Aspect] | null;
  meaning: string;
  color: string;
}

const P = (key: Aspect, name: string, meaning: string, color: string): AspectInfo => ({ key, name, tier: 1, parts: null, meaning, color });
const C = (key: Aspect, name: string, a: Aspect, b: Aspect, meaning: string, color: string, tier: 2 | 3 = 2): AspectInfo =>
  ({ key, name, tier, parts: [a, b], meaning, color });

export const ASPECTS: readonly AspectInfo[] = [
  P('cinder', 'Cinder', 'heat and fire', '#e8622a'),
  P('loam', 'Loam', 'solid ground', '#8a6a3c'),
  P('brook', 'Brook', 'flowing water', '#3f8fd8'),
  P('gale', 'Gale', 'air and motion', '#cfe6ee'),
  P('rune', 'Rune', 'order and structure', '#a77fe0'),
  P('rift', 'Rift', 'breaking and entropy', '#5a3a6e'),
  C('glow', 'Glow', 'cinder', 'gale', 'light and energy', '#ffd95a'),
  C('spring', 'Spring', 'loam', 'brook', 'growth and life', '#5cc060'),
  C('vein', 'Vein', 'loam', 'rune', 'metal and crystal', '#c7a24a'),
  C('frost', 'Frost', 'brook', 'gale', 'cold and mist', '#9fd6ff'),
  C('ash', 'Ash', 'cinder', 'rift', 'ruin and cinders', '#8b8580'),
  C('wane', 'Wane', 'brook', 'rift', 'decay and rot', '#7d8a3a'),
  C('drive', 'Drive', 'gale', 'rift', 'force and motion', '#e0a060'),
  C('craft', 'Craft', 'rune', 'cinder', 'making and tools', '#d88a3a'),
  C('mind', 'Mind', 'rune', 'gale', 'thought and scrying', '#b8c4ff'),
  C('ward', 'Ward', 'loam', 'rift', 'shelter and defence', '#6f8fa8'),
  C('steam', 'Steam', 'cinder', 'brook', 'pressure and boil', '#dfe7ea'),
  C('clarity', 'Clarity', 'brook', 'rune', 'glass and purity', '#bff2f0'),
  C('spark', 'Spark', 'glow', 'drive', 'electric current', '#6ae0ff', 3),
  C('soul', 'Soul', 'spring', 'mind', 'creatures and servants', '#ff9ad0', 3),
  C('void', 'Void', 'wane', 'ward', 'emptiness and storage', '#3a2a55', 3),
];

const INFO = new Map<Aspect, AspectInfo>(ASPECTS.map((a) => [a.key, a]));
export const aspectInfo = (a: Aspect): AspectInfo => INFO.get(a) as AspectInfo;
export const isAspect = (s: string): s is Aspect => INFO.has(s as Aspect);
export const aspectOrder = (a: Aspect): number => ASPECT_LIST.indexOf(a);

/** Equal, or one is a direct component of the other. */
export function kin(a: Aspect, b: Aspect): boolean {
  if (a === b) return true;
  const pa = INFO.get(a)?.parts;
  const pb = INFO.get(b)?.parts;
  return (pa?.includes(b) ?? false) || (pb?.includes(a) ?? false);
}

/** Aspects an aspect is kin to (excluding itself). */
export const kinOf = (a: Aspect): Aspect[] => ASPECT_LIST.filter((b) => b !== a && kin(a, b));

/** "cinder 2, vein 3" */
export const aspectsText = (as: Aspects): string =>
  ASPECT_LIST.filter((a) => (as[a] ?? 0) > 0).map((a) => `${aspectInfo(a).name} ${as[a]}`).join(', ');
