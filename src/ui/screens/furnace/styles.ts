/** Injects the furnace, machine and pipe screens' stylesheet once (it uses only the kit's --hw-* tokens). */
import furnaceCss from './furnace.css';
import furnaceTabsCss from './furnaceTabs.css';
import structureCss from './structure.css';
import machinesCss from '../machines/machines.css';
import pipeCss from '../pipe/pipe.css';

const STYLE_ID = 'hw-station-css';

export function injectStationCss(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `${furnaceCss}\n${furnaceTabsCss}\n${structureCss}\n${machinesCss}\n${pipeCss}`;
  document.head.appendChild(style);
}
