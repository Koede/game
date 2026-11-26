# Accessibility options (Settings > Accessibility, plus Text and button size)

All of them are `Settings` fields (`src/core/context.ts`), saved with the other settings (`src/save/document.ts` clamps and
repairs them) and applied at once through the `settings:changed` event. None needs a restart.

| Setting | Values | What it does |
| --- | --- | --- |
| `colorMode` | `off`, `red-green`, `blue-yellow` | Swaps status colours (good / warning / bad, health, food) and every colour ramp for palettes that stay apart for protan / deutan (red-green) or tritan (blue-yellow) players. Old saves with `colorSafe: true` read as `red-green`. |
| `textScale` | 0.85 - 1.6 | Multiplies every `--hw-fs-*` text token (`--hw-text-scale` on `.hw-root`). Stacks with `uiScale: 'large'`. |
| `hudScale` | 0.8 - 1.5 | Zooms the HUD (`--hw-hud-scale`); from 1.2 up the touch buttons use their large layout. The phone hotbar already spans the screen, so it ignores this. |
| `tapToMove` | on / off | A still tap on the world walks there (`src/player/tapMove.ts`). Stick, keys, a jump or sitting cancels it at once; a wall hops once then gives up. A tap no longer presses Use (the Use button still does); holding still still mines. |
| `reduceMotion` | on / off | Already there: no bob, sprint zoom, landing dip, flashes, pulses or sliding. Starts on when the OS asks for less motion. |

## For overlays (heat, power grid, anything drawn as a ramp)

Do not hard-code a colour ramp. Ask `src/ui/kit/palette.ts`:

```ts
import { rampFor, sampleRamp, rampGradient } from '../ui/kit';
const stops = rampFor(settings.colorMode, 'heat'); // or 'power'
const [r, g, b] = sampleRamp(stops, t);            // t 0..1
legend.style.background = rampGradient(stops);
```

Every ramp rises steadily in lightness (a test enforces it), so "more" is also "brighter" for low-vision and greyscale
players: never carry meaning in hue alone. DOM overlays can also follow `data-color-mode` on `.hw-root` and the
`--hw-temp-*` / `--hw-power-*` custom properties, which `styles.css` redefines per mode. Re-read the ramp when
`settings:changed` fires.

## Checks

`npx vitest run` (palette, tap-to-move, input and settings tests) and `node scripts/e2e-a11y.mjs` (phone portrait: sizes,
palettes, a real touch tap that walks, persistence over a reload).
