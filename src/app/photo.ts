/** Photo mode's DOM side: composes the framed shot or postcard from the game canvas, and hands it to the player (share sheet or download). */
import { postcardCaption, postcardFileName, type Postcard } from '../game/postcards';
import { shotCaption, shotFileName, shotLayout } from '../player/photoCam';

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> => new Promise((resolve) => c.toBlob(resolve, type, quality));

/** Draws `source` into a bordered frame with a caption. `filter` is a CSS filter list ('none' for natural); unsupported browsers save it unfiltered. */
function frame(source: HTMLCanvasElement, caption: string, filter: string): HTMLCanvasElement | null {
  const l = shotLayout(source.width, source.height);
  const out = document.createElement('canvas');
  out.width = l.width;
  out.height = l.height;
  const g = out.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#f2ead8';
  g.fillRect(0, 0, l.width, l.height);
  if (filter !== 'none' && 'filter' in g) g.filter = filter;
  g.drawImage(source, l.picture.x, l.picture.y, l.picture.w, l.picture.h);
  g.filter = 'none';
  g.fillStyle = '#3a2c20';
  g.font = `${l.captionSize}px Georgia, serif`;
  g.textAlign = 'center';
  g.fillText(caption, l.width / 2, l.captionY);
  return out;
}

export type Delivery = 'shared' | 'downloaded' | 'failed';

/** Opens the system share sheet with the picture when the browser can share files, otherwise downloads it. A cancelled share counts as shared (nothing to retry). */
export async function deliver(blob: Blob, fileName: string, title: string, preferShare: boolean): Promise<Delivery> {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (preferShare && nav && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    try {
      const file = new File([blob], fileName, { type: blob.type });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title });
        return 'shared';
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
      // Anything else: fall through to a plain download.
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** The framed shot as a PNG, or null. */
export async function composeShot(source: HTMLCanvasElement, day: number, phase: string, filter = 'none'): Promise<Blob | null> {
  const out = frame(source, shotCaption(day, phase), filter);
  return out ? toBlob(out, 'image/png') : null;
}

/**
 * Saves the framed shot (downloads it, or shares it when `share` is set and the browser can). Resolves 'failed' when nothing was produced.
 */
export async function saveShot(source: HTMLCanvasElement, day: number, phase: string, filter = 'none', share = false): Promise<Delivery> {
  const blob = await composeShot(source, day, phase, filter);
  if (!blob) return 'failed';
  return deliver(blob, shotFileName(day, Date.now()), 'Hearthwatt', share);
}

const CARD_WIDTH = 640;

/** A finished postcard from the game canvas (call right after the frame was rendered): a small JPEG data URL. Null when the canvas cannot be read. */
export function makePostcard(source: HTMLCanvasElement, age: number, ageName: string, day: number): Postcard | null {
  const scale = Math.min(1, CARD_WIDTH / source.width);
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(source.width * scale));
  small.height = Math.max(1, Math.round(source.height * scale));
  const g = small.getContext('2d');
  if (!g) return null;
  g.drawImage(source, 0, 0, small.width, small.height);
  const framed = frame(small, postcardCaption(ageName, day), 'none');
  if (!framed) return null;
  const image = framed.toDataURL('image/jpeg', 0.8);
  return image.startsWith('data:image/jpeg') ? { age, ageName, day, image } : null;
}

/** Turns a stored postcard back into a PNG and saves/shares it. */
export async function sendPostcard(card: Postcard, share: boolean): Promise<Delivery> {
  try {
    const blob = await (await fetch(card.image)).blob();
    return deliver(blob, postcardFileName(card.age, card.day), `Hearthwatt - ${card.ageName}`, share);
  } catch {
    return 'failed';
  }
}
