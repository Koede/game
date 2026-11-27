# Photo mode

P (`CMD_PHOTO`, `intent.photo`, `requestPhoto()`) toggles it; Escape also leaves. `PhotoCamera` (src/player/photoCam.ts) is a free eye: move/strafe along the view, Jump rises, Sprint is 3x. The body stays put and the controller skips everything else. Use (click / tap) emits `photo:snap`; `Game` then saves the next rendered frame via `saveShot` (src/app/photo.ts): bordered frame, caption "Hearthwatt - Day N, phase", PNG download. `photo:mode` toggles the `hw-root--photo` class (hides the hud and touch layers). There is no touch button for entering it yet.
