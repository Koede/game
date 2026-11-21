/**
 * Points on an automaton's model the effects hang off (spec 19.5), worked out once per species from its CreatureSpec
 * boxes: where its ember glow sits (the halo), where smoke and idle sparks leave it (a vent, chimney or exhaust), where
 * a crackle or an arc starts (its topmost ember part), and the parts a break-apart scatters (boxes, colours, weights).
 * Pure: no THREE, no DOM. Model space in blocks, feet at the origin, facing north (-Z).
 */
import type { CreaturePart, CreatureSpec } from '../../core/types';
import { PART_GROUP } from './geometry';

const PX = 1 / 16;

export interface Anchor {
  x: number;
  y: number;
  z: number;
  /** Moves with the head (the sentry's kiln turns, a hound's head pitches). */
  head: boolean;
}

export interface GlowAnchor extends Anchor {
  /** Halo diameter in blocks at full glow, and the part's colour 0..1. */
  size: number;
  r: number;
  g: number;
  b: number;
}

export interface AutomatonAnchors {
  halo: GlowAnchor;
  vent: Anchor;
  /** Whether the vent smokes (walkers and turrets); flyers only spark. */
  smokes: boolean;
  arc: Anchor;
  /** Height of the body's middle (hit sparks), blocks. */
  middle: number;
  /** Per part: box min xyz, max xyz (blocks), colour rgb 0..1, 1 if emissive; and the cumulative pick weight. */
  boxes: Float32Array;
  colors: Float32Array;
  emissive: Uint8Array;
  weights: Float32Array;
}

/** Limb parts (legs, arms) never carry the halo or the vent: they swing. */
const onTrunk = (p: CreaturePart): boolean => PART_GROUP[p.anim] <= 1;
const centre = (p: CreaturePart, i: 0 | 1 | 2): number => ((p.from[i] + p.to[i]) / 2) * PX;
const volume = (p: CreaturePart): number => (p.to[0] - p.from[0]) * (p.to[1] - p.from[1]) * (p.to[2] - p.from[2]);

/** The mean centre of `parts`, with y at their top face when `top`. */
function anchorOf(parts: readonly CreaturePart[], top: boolean): Anchor {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of parts) {
    x += centre(p, 0);
    y += top ? p.to[1] * PX : centre(p, 1);
    z += centre(p, 2);
  }
  const n = Math.max(1, parts.length);
  return { x: x / n, y: y / n, z: z / n, head: parts.some((p) => p.anim === 'head') };
}

/** The parts among `parts` whose top is highest (mirrored twins share it, so their mean sits on the middle line). */
function highest(parts: readonly CreaturePart[]): CreaturePart[] {
  let top = -Infinity;
  for (const p of parts) top = Math.max(top, p.to[1]);
  return parts.filter((p) => p.to[1] === top);
}

/** Works out the anchors of an automaton (any CreatureSpec with at least one emissive part). */
export function automatonAnchors(spec: CreatureSpec): AutomatonAnchors {
  const model = spec.model;
  const hot = model.filter((p) => p.emissive);
  const hotTrunk = hot.filter(onTrunk);
  const glowParts = hotTrunk.length > 0 ? hotTrunk : hot.length > 0 ? hot : model;
  let biggest = glowParts[0];
  for (const p of glowParts) if (volume(p) > volume(biggest)) biggest = p;
  const c = biggest.color;
  const dims = [biggest.to[0] - biggest.from[0], biggest.to[1] - biggest.from[1], biggest.to[2] - biggest.from[2]].sort((a, b) => b - a);
  const halo: GlowAnchor = {
    ...anchorOf([biggest], false),
    size: Math.max(0.45, (dims[0] + dims[1]) * PX * 1.6),
    r: ((c >> 16) & 255) / 255,
    g: ((c >> 8) & 255) / 255,
    b: (c & 255) / 255,
  };
  const vents = model.filter((p) => onTrunk(p) && /vent|chimney|exhaust/i.test(p.name));
  const vent = anchorOf(highest(vents.length > 0 ? vents : glowParts), true);
  const arc = anchorOf(highest(hot.length > 0 ? hot : model), true);

  const n = model.length;
  const boxes = new Float32Array(n * 6);
  const colors = new Float32Array(n * 3);
  const emissive = new Uint8Array(n);
  const weights = new Float32Array(n);
  let sum = 0;
  let top = 0;
  model.forEach((p, i) => {
    for (let k = 0; k < 3; k++) {
      boxes[i * 6 + k] = p.from[k] * PX;
      boxes[i * 6 + 3 + k] = p.to[k] * PX;
    }
    colors[i * 3] = ((p.color >> 16) & 255) / 255;
    colors[i * 3 + 1] = ((p.color >> 8) & 255) / 255;
    colors[i * 3 + 2] = (p.color & 255) / 255;
    emissive[i] = p.emissive ? 1 : 0;
    // Big plates give more pieces, but every part (an eye, a knuckle) has a fair chance of showing up.
    sum += Math.pow(volume(p), 0.6) * (p.emissive ? 2 : 1);
    weights[i] = sum;
    top = Math.max(top, p.to[1] * PX);
  });
  return { halo, vent, smokes: !spec.hostile?.flying, arc, middle: top * 0.55, boxes, colors, emissive, weights };
}

/** The part index whose cumulative weight first exceeds `u` x total (u in 0..1). */
export function pickPart(a: AutomatonAnchors, u: number): number {
  const w = a.weights;
  const target = u * w[w.length - 1];
  let lo = 0;
  let hi = w.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (w[mid] > target) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
