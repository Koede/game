/**
 * Marks a horizontally scrolling row (tabs, filter chips) with data-fade = 'left' | 'right' | 'both' while part of
 * it is out of view on that side; styles.css fades that edge, so the player can see there is more to swipe to.
 */
import { setAttr } from './dom';

/** Which edges of a scroller hide content. 1 px of slack absorbs sub-pixel layout. */
export function fadeEdges(scrollLeft: number, clientWidth: number, scrollWidth: number): 'left' | 'right' | 'both' | null {
  const left = scrollLeft > 1;
  const right = scrollLeft + clientWidth < scrollWidth - 1;
  return left && right ? 'both' : left ? 'left' : right ? 'right' : null;
}

export function edgeFade(el: HTMLElement): void {
  const update = (): void => setAttr(el, 'data-fade', fadeEdges(el.scrollLeft, el.clientWidth, el.scrollWidth));
  el.addEventListener('scroll', update, { passive: true });
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(update);
    observer.observe(el);
    // Children growing (a badge appearing) changes scrollWidth without resizing the row itself.
    for (const child of Array.from(el.children)) observer.observe(child);
  }
  update();
}
