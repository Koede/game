/** Injects the furnace and machine screens' stylesheet once (it uses only the kit's --hw-* tokens). */
import furnaceCss from './furnace.css';
import machinesCss from '../machines/machines.css';

const STYLE_ID = 'hw-station-css';

export function injectStationCss(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `${furnaceCss}\n${machinesCss}`;
  document.head.appendChild(style);
}
