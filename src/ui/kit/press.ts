/** Primary / secondary activation that works the same with a mouse, a keyboard and a finger. */
import { Disposer, listen, type Dispose } from './dom';

export interface PressHandlers {
  /** Click, tap, Enter or Space. */
  primary?: (ev: Event) => void;
  /** Right-click, or a long-press with a finger or pen. */
  secondary?: (ev: Event) => void;
}

export const LONG_PRESS_MS = 420;
const MOVE_TOLERANCE_PX = 10;
/** After a long-press fires, the click / contextmenu the browser may still deliver for it is ignored for this long. */
const ECHO_MS = 700;

export function bindPress(el: HTMLElement, handlers: PressHandlers, longPressMs = LONG_PRESS_MS): Dispose {
  const d = new Disposer();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firedAt = -Infinity;
  let startX = 0;
  let startY = 0;

  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const isEcho = (): boolean => performance.now() - firedAt < ECHO_MS;

  d.add(
    listen(el, 'click', (ev) => {
      if (isEcho()) return;
      handlers.primary?.(ev);
    }),
  );
  d.add(
    listen(el, 'contextmenu', (ev) => {
      ev.preventDefault();
      cancel();
      if (isEcho()) return;
      handlers.secondary?.(ev);
    }),
  );
  if (handlers.secondary) {
    d.add(
      listen(el, 'pointerdown', (ev) => {
        if (ev.pointerType === 'mouse') return;
        cancel();
        startX = ev.clientX;
        startY = ev.clientY;
        timer = setTimeout(() => {
          timer = null;
          firedAt = performance.now();
          handlers.secondary?.(ev);
        }, longPressMs);
      }),
    );
    d.add(
      listen(el, 'pointermove', (ev) => {
        if (timer !== null && Math.hypot(ev.clientX - startX, ev.clientY - startY) > MOVE_TOLERANCE_PX) cancel();
      }),
    );
    d.add(listen(el, 'pointerup', cancel));
    d.add(listen(el, 'pointercancel', cancel));
    d.add(listen(el, 'pointerleave', cancel));
  }
  d.add(cancel);
  return () => d.dispose();
}
