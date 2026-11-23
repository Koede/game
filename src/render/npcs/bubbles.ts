/**
 * Speech bubbles over the tavern's people (docs/api/npcs.md, overheard gossip): a camera-facing sprite with the line wrapped in a
 * rounded box, shown while `NpcView.bubble` is set. Never blocks anything. Textures are drawn once per line and dropped with it.
 */
import * as THREE from 'three';
import type { NpcView } from '../../npcs';

const W = 220;
const LINE_PX = 15;
const WORLD_PER_PX = 0.0085;

/** Wraps `text` to lines of at most `max` characters. */
export function wrapBubble(text: string, max = 26): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if (cur && (cur + ' ' + w).length > max) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

function paint(text: string): { canvas: HTMLCanvasElement; h: number } {
  const lines = wrapBubble(text);
  const h = lines.length * LINE_PX + 22;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = h + 8;
  const g = canvas.getContext('2d')!;
  g.fillStyle = 'rgba(255,248,226,0.95)';
  g.strokeStyle = 'rgba(70,45,25,0.95)';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(2, 2, W - 4, h - 2, 8);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(W / 2 - 6, h - 2);
  g.lineTo(W / 2, h + 6);
  g.lineTo(W / 2 + 6, h - 2);
  g.fill();
  g.fillStyle = '#3a2412';
  g.font = `${LINE_PX - 2}px sans-serif`;
  g.textAlign = 'center';
  lines.forEach((l, i) => g.fillText(l, W / 2, 20 + i * LINE_PX));
  return { canvas, h: h + 8 };
}

export class BubbleLayer {
  private readonly live = new Map<string, { s: THREE.Sprite; text: string }>();

  constructor(private readonly scene: THREE.Scene) {}

  update(views: readonly NpcView[]): void {
    const seen = new Set<string>();
    for (const v of views) {
      if (!v.bubble) continue;
      seen.add(v.id);
      let b = this.live.get(v.id);
      if (!b || b.text !== v.bubble) {
        if (b) this.drop(v.id);
        const { canvas, h } = paint(v.bubble);
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.LinearFilter;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        s.scale.set(W * WORLD_PER_PX, h * WORLD_PER_PX, 1);
        s.center.set(0.5, 0);
        s.renderOrder = 10;
        this.scene.add(s);
        b = { s, text: v.bubble };
        this.live.set(v.id, b);
      }
      b.s.position.set(v.x, v.y + 2.05 * v.scale + 0.15, v.z);
    }
    for (const id of [...this.live.keys()]) if (!seen.has(id)) this.drop(id);
  }

  private drop(id: string): void {
    const b = this.live.get(id);
    if (!b) return;
    this.scene.remove(b.s);
    (b.s.material as THREE.SpriteMaterial).map?.dispose();
    b.s.material.dispose();
    this.live.delete(id);
  }

  dispose(): void {
    for (const id of [...this.live.keys()]) this.drop(id);
  }
}
