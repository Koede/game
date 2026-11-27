# Touch controls and settings

## Goal

Everything you can do on desktop is one tap or hold away on a phone, and every setting has a control. The owner plays mostly on a phone.

## What is fun

Emotes and photo mode are play, not chores, and they only get used if reaching them is one tap. Sneak and sprint should feel natural under a
thumb.

## What exists

Emotes, photo mode and the sneak toggle exist as logic and keyboard bindings; the graphics setting exists without a control. The settings
panel and touch layout live under `src/ui` and `src/player/input`.

## Design

1. **Radial quick menu.** One touch button (bottom corner) opens a radial menu: emote wheel, photo mode, sneak toggle, sprint lock.
2. **Photo mode controls.** Hide HUD, filter strip, a capture button that shares a PNG; reduces to two taps.
3. **Sneak and sprint.** A sprint lock (double-tap the stick) and a sneak toggle with a clear lit state.
4. **Graphics setting.** A three-step control (Low, Medium, High) in the settings panel, showing what it changes (fog, water waves, loot
   beams, liquid animation rate), applied live.
5. **Left-handed and one-handed layouts** keep the same menu reachable.

## Phases

1. Graphics control in settings (smallest, ships alone).
2. Radial menu with emotes and sneak.
3. Photo mode controls and capture.
4. Layout variants.

## Tests

Settings round trip; radial menu opens and closes by tap; each action fires its existing handler; e2e on the phone layout (buttons
reachable, no overlap with the hotbar).

## Risks

Too many buttons crowd the screen: keep one entry button and everything else inside the menu. Accidental taps while building: the button
sits clear of the build and hotbar zones.
