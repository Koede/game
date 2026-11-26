# src/ui/kit, src/ui/menus, src/ui/styles.css - the UI kit

Plain TypeScript + DOM widgets, no framework. Import widgets from `src/ui/kit` (index re-exports every file)
and menus from `src/ui/menus`. Menus import nothing from other game modules except `src/core`.
`format.ts` and `layout.ts` are DOM-free (unit-tested in node: `npx vitest run src/ui/kit`).

Visual check (7.4a engineer): every widget, the title screen (with and without a save), the pause menu,
settings, How to Play (both control lists), toasts, banner and tooltip were screenshotted at 390x844 (touch),
844x390 (touch) and 1280x800. They hold up: no clipped text, no page scroll, windows become full-screen sheets
on phones, the title switches to a two-column layout in landscape. Fixed: thermometer minimum width (a
"1250 Flame limit" notch label was truncated), How to Play was missing L / the goal tracker / slot taps.
Added: `Window.whenClosed`, `PauseMenu.window` (both for GameUI).

## Conventions
- Every widget exposes its root element as `el` (`interface Component { readonly el: HTMLElement }`).
  Mount it wherever you like; widgets with listeners/observers have `dispose()`.
- Update methods (`set`, `update`, `setRows`, ...) only write to the DOM what changed: safe at 8-20 Hz.
- CSS: everything is a custom property on `:root` (`--hw-*`), class prefix `hw-`, state as `data-*` attributes.
  Two semantic hues: HEAT (`--hw-heat*`, the temperature ramp from `heatColor`) and POWER (`--hw-power*`).
  Status colours `--hw-good/warn/bad` are separate. Fonts: `--hw-font-display` (Chakra Petch), `--hw-font-body`
  (IBM Plex Sans), `--hw-font-mono` (IBM Plex Mono, class `hw-num` for every reading). `--hw-tap` 44px,
  `--hw-slot` 48px, `--hw-icon` 32px, safe areas `--hw-safe-t/r/b/l`.
- Any element with `data-tone="neutral|heat|power|good|warn|bad"` gets `--hw-tone` / `--hw-tone-wash`.
- Utility classes: `hw-num` (tabular mono numbers), `hw-heading` (small caps section label), `hw-panel` (recessed sub-plate).
- Breakpoint used everywhere: phone = `(max-width: 719.98px), (max-height: 519.98px)`; landscape phone = `(max-height: 519.98px)`.

## dom.ts
- `type Dispose = () => void`; `type Child = Node | string | number | false | null | undefined | readonly Child[]`
- `interface Props { class?: string | (string|false|null|undefined)[]; text?; attrs?: Record<string, string|number|boolean|null|undefined>; style?: Record<string,string> (CSS names); on?: handlers }`
- `h(tag, props?, ...children): HTMLElementTagNameMap[tag]` - create an element.
- `append(parent, ...children)`, `clear(el)`, `setClass(el, name, on)`
- `setText(el, text)` / `setAttr(el, name, value)` / `setFlag(el, name, on)` (`data-<name>` present/absent) - write only on change.
- `listen(target, type, fn, options?): Dispose`; `class Disposer { add(d): Dispose; dispose(): void }` (reverse order)
- `uid(prefix): string`, `prefersReducedMotion(): boolean`

## root.ts
- `LAYER_ORDER = ['hud', 'touch', 'menu', 'windows', 'toasts', 'tooltip']`; `type LayerName`
- `class UIRoot { constructor(app: HTMLElement); el; layers: Record<LayerName, HTMLDivElement>; toasts: Toasts; banner: Banner; tooltip: Tooltip; dispose() }`
  Layers ignore pointer input; content opts back in with `pointer-events: auto` (windows and menus already do).
  The toasts layer reads `--hw-toast-top` (default 64px, 48px in landscape) to start below the HUD's top row.

## press.ts
- `bindPress(el, { primary?, secondary? }, longPressMs = LONG_PRESS_MS): Dispose` - click/Enter/Space = primary;
  right-click or touch/pen long-press (420 ms, 10 px tolerance) = secondary; the click echo after a long-press is ignored.

## icons.ts
- `glyph(name: GlyphName, size = 16): SVGSVGElement` - monochrome inline SVG, takes currentColor. Names:
  close, back, check, lock, bolt, flame, gear, help, warn, info, play, heart, air, home, needle, sun, moon, up, down,
  chevron, bowl (a steaming bowl: food).
- `type IconProvider = (itemKey: string) => HTMLCanvasElement | null`; `setIconProvider(p | null)` - global; icons
  pick it up on their next `set`. Until then a placeholder tile with the item's initials and a hue from the key.
- `class ItemIcon { constructor(itemKey: string | null = null); el; item; set(itemKey | null) }` - copies the provider's canvas.

## controls.ts (+ fields.ts)
- `class Button({ label, kind?: 'default'|'primary'|'power'|'quiet'|'danger', size?: 'sm'|'md'|'lg', icon?, block?, holdMs?, hint?, onClick? })`
  `setLabel(t)`, `setKind(k)`, `setOnClick(fn)`, `setDisabled(disabled, reason = '')` (stays focusable; the reason
  replaces the hint line; a tap on a disabled button plays a refusal nudge), `disabled`, `dispose()`.
- `class IconButton({ icon, label, onClick? })` 44px square; `setDisabled(b)`.
- `class Toggle({ label, value?, tone?: 'neutral'|'heat'|'power', onChange?, onText?, offText? })` - `value`, `set(v)` (silent), `setDisabled(b)`.
- `class Slider({ label, min, max, step?, value?, format?, onChange? })` - `value`, `set(v)`.
- `class Segmented<T>({ label, options: {value, label}[], value, onChange? })` - `value`, `set(v)`.
- `class TextField({ label, placeholder?, value?, maxLength?, mono?, onInput?, onEnter? })` - `input`, `value`, `set(v)`; keystrokes never reach game handlers.

## window.ts (+ tabs.ts)
- `class Window(opts: WindowOptions)` - `el` (scrim, attach point), `frame`, `body`, `tabs: Tabs | null`
  - options: `title, subtitle?, headerRight?, tabs?: { id, label, badge?, panel? }[], activeTab?, onTab?, body?, footer?,
    size?: 'sm'(440)|'md'(720)|'lg'(980), fit?: 'content'|'tall', scroll?: boolean (default true), closable? (default true), onClose?`
  - `open(host)` (closes any other open window first), `close()`, `isOpen`, `whenClosed(fn): Dispose`
  - `setTitle`, `setSubtitle`, `setHeaderRight(el|null)`, `setBody(...children)`, `setFooter(text|null, tone?)`,
    `setAccent(color|null)` (top strip + active tab), `selectTab(id)` (silent)
  - Escape closes (swallowed even when not closable), focus is trapped and restored, outside tap closes.
  - Phones: a full-screen sheet; landscape phones put title, tabs and close on one row.
  - `scroll: false` + panels: the body does not scroll; give your panel `height: 100%` and scroll inside it.
- `currentWindow(): Window | null`
- `class Tabs({ label, tabs, active?, onChange? })` - `active`, `setActive(id)` (silent), `setBadge(id, badge|null)`, `button(id)`.

## slot.ts
- `interface SlotView { item; count?; durability?: number (0..1); name? }`; `type SlotSize = 'sm'|'md'|'lg'`
- `class ItemSlot({ size?, hint?, label?, onPrimary?(slot, ev), onSecondary?(slot, ev) })` - `set(view|null)`,
  `view`, `setSelected(b)`, `setHighlight(b)`, `setDisabled(b)`, `disabled`, `dispose()`. Display only: no inventory logic.
- `class SlotGrid({ count, columns? = 9, size?, minSlotPx? = 44, label, onPrimary?(i, ev), onSecondary?(i, ev) })` -
  `slots: ItemSlot[]`, `set(i, view)`, `setAll(views)`, `setSelected(i|null)`, `dispose()`. Drops columns before a slot gets smaller than minSlotPx.
- For real inventories use the slot-interaction controller in `src/ui/screens/slots.ts` (docs/api/hud.md), which drives ItemSlots.

## recipe.ts (+ recipeList.ts)
- `interface RecipeRowView { id; item; name; count?; category?; requirements?: { text, kind?: 'heat'|'tier'|'power'|'time', met?, tempC? }[];
  ingredients: { item, name, have, need }[]; available: number; reason?; locked?; action? }`
- Requirement kinds `'food'` ("+8 food", "Well-Fed 6 min") and `'note'` ("Returns the bucket") are FACTS about the
  product: no met state, drawn on their own line under the name (`.hw-recipe__facts`, badge `data-kind`).
- `class RecipeRow(view, { onMake(id, count), many? = 5 })` - `update(view)`.
- `class RecipeList({ label, onMake(id, count), categories?: {id, label}[], many?, emptyText?, onCategory? })` -
  `setRows(views)` (rows matched by id and updated in place; scroll and focus survive), `setCategory(id|null)`, `category`, `dispose()`.
  Chips show how many rows of each category can be made now. `setCategory` scrolls the picked chip into view.

## gauges.ts (+ thermometer.ts, sparkline.ts)
- `type Tone = 'neutral'|'heat'|'power'|'good'|'warn'|'bad'`
- `class Badge({ text, tone?, swatch?, icon?, met? })` - `update(opts)`.  `class Chip({ label, count?, selected?, onClick? })` - `setLabel`, `setSelected`, `setCount`.
- `class Meter({ label, tone?, value?, max?, text? })` - `set(value, max?, text?)`, `setLabel`, `setTone`, `setMarker(fraction|null)`.
- `class StatFigure({ caption, reading?, note?, tone?, size?: 'md'|'lg' })` - `set(reading)` ("12.5 kW": unit split off), `setNote`, `setTone`, `setColor(css|null)`.
- `class Thermometer({ min? = 0, max, value?, caption?, notches?: { tempC, label, kind?: 'threshold'|'limit' }[] })` -
  `set(tempC)` (cheap every tick), `setRange(min, max)`, `setNotches(list)`, `setCaption(t)`, `dispose()`. Needs a
  parent with a definite height (it fills it); minimum width 176px. Labels de-clutter themselves.
- `class Sparkline({ label, a: { label, tone, fill? }, b?, max? })` - `set(a: ArrayLike<number>, b?)` (kept by reference, redrawn on resize), `dispose()`.

## feedback.ts (+ tooltip.ts)
- `class Toasts(host, { max? = 4 })` - `show({ text, kind?, item?, durationMs? })` (the bus 'toast' payload fits; identical messages bump a ×N counter), `clear()`, `dispose()`.
- `class Banner(host)` - `show({ title, kicker?, subtitle?, tone?: 'heat'|'power'|'good', size?: 'md'|'lg', durationMs? })` (queued), `clear()`.
- `class Tooltip(host)` - `attach(target, source, { touch?: 'longpress'|'none' }): Dispose` (source may be a function for live numbers),
  `show(anchor: HTMLElement | Box, content)`, `hide()`. Content: string, `{ title, body?, rows?: [label, value][], rarity?,
  lines?: { text, colour, aspect, title?, effect? }[] }`, or a Node. A line's `effect` is a muted one-liner under it
  (`.hw-tooltip__effect`: the enchant's effect at its level).

## format.ts (DOM-free)
- `HEAT_STOPS`, `heatRgb(tempC)`, `heatColor(tempC)` (#rrggbb fill colour), `heatTextColor(tempC)` (lifted for text on dark panels),
  `heatGradient(minC, maxC, direction?)`, `luminance(rgb)`, `rgbToHex(rgb)`
- `formatWatts(w, { fixed? })` "850 W / 1.5 kW / 1 MW"; `formatJoules(j)`; `formatTemp(c)` "1240 °C"; `formatDuration(s)` "3.4 s / 2 m 05 s";
  `formatCount(n)` "999 / 1.2k"; `formatPercent(f)`; `splitUnit("12.5 kW")`; `titleFromKey(key)`; `itemInitials(key)`; `hueFromKey(key)`

## layout.ts (DOM-free)
- `declutter(positions, minGap, lo, hi)`, `placeTooltip(anchor, tip, viewport, margin?, gap?)`, `niceStep(range, maxTicks)`, `ticksBetween(min, max, step)`

## menus
- `class TitleScreen(root, { hasSave, settings, onNewWorld(seed|null), onContinue, onSettingsChange(settings, key), controls?, version?, ages? })` -
  `show()` (menu layer, starts the ember fire), `hide()`, `setHasSave(b)`, `visible`, `dispose()`. With a save, New World is hold-to-confirm.
  The age strip defaults to `DEFAULT_AGES`: the six `AGES` short names (Ember, Bronze, Forge, Current, Atomic, Star).
- `class PauseMenu(root, { settings, onSettingsChange, onResume, onQuit, controls?, openLog? })` - `open()`, `close()`, `isOpen`, `setSettings(s)`,
  `window` (built but not opened; GameUI opens it as its 'pause' screen). With `openLog(section)` the menu shows Journal and
  Achievements entries; GameUI opens the Hearth Log as `{ type: 'log', section }`, scrolled to that section.
- `class SettingsPanel({ settings, onChange(settings, key) })` - `el`, `settings`, `set(s)`; `SETTINGS_LIMITS`.
- `class HowToPlay({ keyboard?, touch?, initial? })`; `DEFAULT_KEYBOARD_CONTROLS`, `DEFAULT_TOUCH_CONTROLS`, `interface ControlLine { keys; action }`
  ('–' and '/' in `keys` are drawn as separators). Sections: The loop (5 steps; step 5 "four times, each inside a bigger hearth"),
  Staying alive (food, cooking, farming, animals and breeding, buckets and bread, cold and rain), Building big (hearths,
  pipes and the wrench, power), then Controls (adds P / B at the furnace, sprint at the stick's edge, double-tap / shift-click
  quick move; review gc-3). The two new sections reuse `.hw-howto__loop` / `.hw-howto__step` with a glyph in the square.
  Later: Working by hand, Tea and coffee, The Emberbound, and "Photo, emotes and what next" (`EXTRAS`: P / Use for a framed shot,
  G or the quick menu's Emote wheel, the "What next?" hint under the goal); the keyboard list gained G (emote) and P (photo).
- `class EmberField(seed?)` (menus/fire.ts) - the title's cellular fire canvas: `start()`, `stop()`, `dispose()`.

## Usage
```ts
const root = new UIRoot(document.getElementById('app')!);
const thermo = new Thermometer({ max: 1500, value: 640, notches: [{ tempC: 700, label: 'Copper' }, { tempC: 1250, label: 'Flame', kind: 'limit' }] });
const list = new RecipeList({ label: 'Forge', onMake: (id, n) => sim.forge(x, y, z, id, n), categories: [{ id: 'tools', label: 'Tools' }] });
const win = new Window({ title: 'Clay Furnace', size: 'lg', fit: 'tall', scroll: false,
  tabs: [{ id: 'forge', label: 'Forge', panel: list.el }] });
win.open(root.layers.windows);
setInterval(() => { thermo.set(view.tempC); list.setRows(rows()); }, 125);
```

## Phone pass additions
- `Button.setHint(text)`: replaces the small second line (shown while enabled).
- `Tabs.setBadge(id, badge, { more?, tone? })`: `more` is extra text shown after the figure only at >= 720 px wide
  ("1" on a phone, "1 done" on a desktop); `tone: 'good'` colours the badge. Tab padding is 10 px under 720 px.
- `edgeFade(el)` / `fadeEdges(scrollLeft, clientWidth, scrollWidth)` (scrollFade.ts): a sideways-scrolling row gets
  `data-fade="left|right|both"` and styles.css fades that edge. Tabs and RecipeList category chips use it.
- `batchNote(view, times)` (recipe.ts): the batch button's label/tooltip ("Make 4 times: 16 Planks, uses 4 Oak Log")
  and, when the batch would use up an ingredient the player holds, a line inside the button ("all 4 Oak Log").
- `Segmented` options carry `data-value` (CSS can point at one option).
- Glyph `bag` (the station screens' backpack button). Token `--hw-ink-muted` for small muted text.
- `.hw-window__subtitle` wraps to two lines instead of an ellipsis.

## Known gaps
- Fonts are linked from Google Fonts by the page; offline the fallback stacks render (checked: still readable).
- Only one Window is open at a time by design (opening one closes the other).
