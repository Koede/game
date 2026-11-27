/** The Journal section of the Hearth Log: the map that fills in as you walk, then the diary, newest first. */
import type { IWorld } from '../../../core/types';
import { journalSummary, type Journal } from '../../../game/journal';
import { h, setText } from '../../kit/dom';
import { MAP_PX, paintMap } from './journalMap';

export class JournalView {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly list: HTMLOListElement;
  private readonly summary: HTMLParagraphElement;
  private readonly places: HTMLUListElement;
  private shown = -1;
  private mapAt = -1;
  private readonly img: ImageData | null;

  constructor(
    private readonly journal: Journal,
    private readonly world: Pick<IWorld, 'surfaceY'>,
    private readonly feet: () => { x: number; z: number },
    private readonly markers?: () => readonly { x: number; z: number; name: string }[],
  ) {
    this.canvas = h('canvas', { class: 'hw-journal__map', attrs: { width: String(MAP_PX), height: String(MAP_PX), 'aria-label': 'Explored map' } });
    this.summary = h('p', { class: 'hw-journal__summary' });
    this.places = h('ul', { class: 'hw-journal__places' });
    this.list = h('ol', { class: 'hw-journal__list' });
    this.el = h('section', { class: 'hw-journal' }, h('h3', { class: 'hw-journal__title', text: 'Journal' }), this.canvas, this.places, this.summary, this.list);
    this.img = typeof ImageData === 'function' ? new ImageData(MAP_PX, MAP_PX) : null;
  }

  refresh(): void {
    const now = performance.now();
    if (this.img && now - this.mapAt > 1000) {
      this.mapAt = now;
      const f = this.feet();
      paintMap(this.journal, f.x, f.z, MAP_PX, (x, z) => this.world.surfaceY(x, z), this.img.data, this.markers?.() ?? []);
      this.canvas.getContext('2d')?.putImageData(this.img, 0, 0);
    }
    const f = this.feet();
    const spots = this.markers?.() ?? [];
    this.places.replaceChildren(...spots.map((m) => h('li', { class: 'hw-journal__place', text: `${m.name} \u00b7 ${Math.round(Math.hypot(m.x - f.x, m.z - f.z))} blocks` })));
    const key = this.journal.entries.length * 1000 + this.journal.seenCells;
    if (key === this.shown) return;
    this.shown = key;
    setText(this.summary, journalSummary(this.journal));
    this.list.replaceChildren(
      ...[...this.journal.entries].reverse().slice(0, 40).map((e) => h('li', { class: `hw-journal__entry hw-journal__entry--${e.kind}` }, h('span', { class: 'hw-journal__day hw-num', text: `Day ${e.day}` }), h('span', { text: e.text }))),
    );
  }
}
