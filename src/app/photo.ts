/** Photo mode's DOM side: composes the framed shot from the game canvas and hands it to the player as a PNG download. */
import { shotCaption, shotFileName, shotLayout } from '../player/photoCam';

/**
 * Draws `source` (the game canvas, right after it was rendered) into a bordered frame with a caption and saves it.
 * Resolves true when a download was started.
 */
export async function saveShot(source: HTMLCanvasElement, day: number, phase: string): Promise<boolean> {
  const l = shotLayout(source.width, source.height);
  const out = document.createElement('canvas');
  out.width = l.width;
  out.height = l.height;
  const g = out.getContext('2d');
  if (!g) return false;
  g.fillStyle = '#f2ead8';
  g.fillRect(0, 0, l.width, l.height);
  g.drawImage(source, l.picture.x, l.picture.y, l.picture.w, l.picture.h);
  g.fillStyle = '#3a2c20';
  g.font = `${l.captionSize}px Georgia, serif`;
  g.textAlign = 'center';
  g.fillText(shotCaption(day, phase), l.width / 2, l.captionY);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = shotFileName(day, Date.now());
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
