/**
 * Styles of the on-screen touch controls. Colours come from the UI kit's custom properties when the kit's
 * stylesheet is present and fall back to matching values when it is not.
 *
 * Layout contract with the HUD: the bottom-centre strip (60% of the width, 64px tall) stays free for the
 * hotbar in both orientations, and the top-right corner (about 112 x 60px) holds the bag and pause buttons.
 */
export const TOUCH_CSS = `
.hw-touch-surface {
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
}
.hw-touch {
  --hw-touch-ink: var(--hw-bone, #f0e8db);
  --hw-touch-accent: var(--hw-heat, #ff8a2b);
  --hw-touch-fill: rgba(24, 18, 14, 0.5);
  --hw-touch-rim: rgba(255, 243, 226, 0.82);
  --hw-touch-edge: 0 0 0 1.5px rgba(0, 0, 0, 0.5), 0 3px 10px rgba(0, 0, 0, 0.35);
  --hw-touch-l: env(safe-area-inset-left, 0px);
  --hw-touch-r: env(safe-area-inset-right, 0px);
  --hw-touch-t: env(safe-area-inset-top, 0px);
  --hw-touch-b: env(safe-area-inset-bottom, 0px);
  --hw-touch-d: 124px;
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  color: var(--hw-touch-ink);
  font-family: var(--hw-font-display, 'Chakra Petch', system-ui, sans-serif);
}
.hw-touch[hidden] { display: none; }

.hw-touch-btn {
  position: absolute;
  box-sizing: border-box;
  width: var(--hw-touch-s);
  height: var(--hw-touch-s);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border: 2px solid var(--hw-touch-rim);
  border-radius: 50%;
  background: var(--hw-touch-fill);
  box-shadow: var(--hw-touch-edge);
  pointer-events: auto;
  touch-action: none;
  cursor: pointer;
  transition: transform 70ms ease-out, background-color 70ms ease-out, border-color 70ms ease-out;
}
/* A larger invisible target than the drawn disc: thumbs are not precise. */
.hw-touch-btn::before { content: ''; position: absolute; inset: -8px; border-radius: inherit; }
.hw-touch-btn svg {
  width: 42%;
  height: 42%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.7));
  pointer-events: none;
}
.hw-touch-label {
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  pointer-events: none;
}
.hw-touch-btn--pressed {
  transform: scale(0.92);
  border-color: #fff;
  background: color-mix(in srgb, var(--hw-touch-accent) 78%, transparent);
}
@supports not (background: color-mix(in srgb, red 50%, transparent)) {
  .hw-touch-btn--pressed { background: rgba(255, 138, 43, 0.78); }
}

/* Landscape (and desktop) cluster: Jump in the corner, Mine beside it under the thumb's arc, Use above. */
.hw-touch-btn--jump { --hw-touch-s: 76px; right: calc(20px + var(--hw-touch-r)); bottom: calc(16px + var(--hw-touch-b)); }
.hw-touch-btn--mine { --hw-touch-s: 72px; right: calc(110px + var(--hw-touch-r)); bottom: calc(72px + var(--hw-touch-b)); }
.hw-touch-btn--use { --hw-touch-s: 62px; right: calc(26px + var(--hw-touch-r)); bottom: calc(110px + var(--hw-touch-b)); }
/* Place: a small toggle up and to the left of Use; armed, the next Use places the held block. */
.hw-touch-btn--place { --hw-touch-s: 46px; right: calc(100px + var(--hw-touch-r)); bottom: calc(158px + var(--hw-touch-b)); }
.hw-touch-btn--place .hw-touch-label { font-size: 8px; }
.hw-touch-btn--armed { border-color: var(--hw-touch-accent); color: var(--hw-touch-accent); background: rgba(24, 18, 14, 0.78); }
.hw-touch-btn--pause,
.hw-touch-btn--bag { --hw-touch-s: 44px; top: calc(10px + var(--hw-touch-t)); border-radius: 13px; }
.hw-touch-btn--pause { right: calc(10px + var(--hw-touch-r)); }
.hw-touch-btn--bag { right: calc(64px + var(--hw-touch-r)); }
.hw-touch-btn--pause svg,
.hw-touch-btn--bag svg { width: 56%; height: 56%; }
.hw-touch-btn--pause svg { fill: currentColor; stroke: none; }

.hw-touch-stick {
  position: absolute;
  left: calc(34px + var(--hw-touch-l));
  bottom: calc(22px + var(--hw-touch-b));
  box-sizing: border-box;
  width: var(--hw-touch-d);
  height: var(--hw-touch-d);
  border: 2px solid var(--hw-touch-rim);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(24, 18, 14, 0.2) 0%, rgba(24, 18, 14, 0.5) 100%);
  box-shadow: var(--hw-touch-edge);
  opacity: 0.72;
  transition: opacity 140ms ease-out;
}
.hw-touch-knob {
  position: absolute;
  left: 28%;
  top: 28%;
  width: 44%;
  height: 44%;
  border-radius: 50%;
  background: var(--hw-touch-rim);
  box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.4);
  will-change: transform;
}
/* While a thumb is down the base sits under it: JS moves it with a transform from the top-left corner. */
.hw-touch-stick--active {
  left: 0;
  top: 0;
  bottom: auto;
  margin: calc(var(--hw-touch-d) / -2) 0 0 calc(var(--hw-touch-d) / -2);
  opacity: 1;
  transition: none;
  will-change: transform;
}
.hw-touch-stick--sprint { border-color: var(--hw-touch-accent); }
.hw-touch-stick--sprint .hw-touch-knob { background: var(--hw-touch-accent); }

/* Ring under a finger that is holding still on the world: closes in while charging, solid while mining. */
.hw-touch-hold {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  width: 84px;
  height: 84px;
  margin: -42px 0 0 -42px;
  border: 3px solid var(--hw-touch-rim);
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.45), inset 0 0 0 1.5px rgba(0, 0, 0, 0.35);
  opacity: 0;
  will-change: transform, opacity;
}
.hw-touch-hold--mining { border-color: var(--hw-touch-accent); }

@media (orientation: portrait) {
  /* Everything is lifted clear of the hotbar strip, which spans most of a narrow screen. */
  .hw-touch-btn--jump { --hw-touch-s: 72px; right: calc(16px + var(--hw-touch-r)); bottom: calc(88px + var(--hw-touch-b)); }
  .hw-touch-btn--mine { --hw-touch-s: 70px; right: calc(100px + var(--hw-touch-r)); bottom: calc(138px + var(--hw-touch-b)); }
  .hw-touch-btn--use { --hw-touch-s: 60px; right: calc(20px + var(--hw-touch-r)); bottom: calc(178px + var(--hw-touch-b)); }
  .hw-touch-btn--place { right: calc(94px + var(--hw-touch-r)); bottom: calc(222px + var(--hw-touch-b)); }
  .hw-touch-stick { left: calc(26px + var(--hw-touch-l)); bottom: calc(96px + var(--hw-touch-b)); }
}
/*
 * UI size Large (Settings.uiScale, review ui-10): every button grows about a fifth and the captions to 13px, the
 * cluster spreads to keep the gaps between thumbs' targets. The hotbar strip and the top-right corner stay free.
 */
/* One-handed, left thumb: the cluster is mirrored to the left edge. Right thumb: it stays right and the stick rests beside it. */
.hw-touch--one-left .hw-touch-btn--jump { right: auto; left: calc(20px + var(--hw-touch-l)); }
.hw-touch--one-left .hw-touch-btn--mine { right: auto; left: calc(110px + var(--hw-touch-l)); }
.hw-touch--one-left .hw-touch-btn--use { right: auto; left: calc(26px + var(--hw-touch-l)); }
.hw-touch--one-left .hw-touch-btn--place { right: auto; left: calc(100px + var(--hw-touch-l)); }
.hw-touch--one-left .hw-touch-stick { left: calc(190px + var(--hw-touch-l)); }
.hw-touch--one-right .hw-touch-stick { left: auto; right: calc(190px + var(--hw-touch-r)); }
@media (orientation: portrait) {
  .hw-touch--one-left .hw-touch-btn--jump { right: auto; left: calc(16px + var(--hw-touch-l)); }
  .hw-touch--one-left .hw-touch-btn--mine { right: auto; left: calc(100px + var(--hw-touch-l)); }
  .hw-touch--one-left .hw-touch-btn--use { right: auto; left: calc(20px + var(--hw-touch-l)); }
  .hw-touch--one-left .hw-touch-btn--place { right: auto; left: calc(94px + var(--hw-touch-l)); }
  .hw-touch--one-left .hw-touch-stick { left: calc(180px + var(--hw-touch-l)); }
  .hw-touch--one-right .hw-touch-stick { left: auto; right: calc(180px + var(--hw-touch-r)); }
}
.hw-touch--large .hw-touch-label { font-size: 13px; letter-spacing: 0.06em; }
.hw-touch--large .hw-touch-btn--place .hw-touch-label { font-size: 10px; }
.hw-touch--large .hw-touch-btn--jump { --hw-touch-s: 90px; right: calc(16px + var(--hw-touch-r)); bottom: calc(12px + var(--hw-touch-b)); }
.hw-touch--large .hw-touch-btn--mine { --hw-touch-s: 86px; right: calc(124px + var(--hw-touch-r)); bottom: calc(74px + var(--hw-touch-b)); }
.hw-touch--large .hw-touch-btn--use { --hw-touch-s: 74px; right: calc(22px + var(--hw-touch-r)); bottom: calc(120px + var(--hw-touch-b)); }
.hw-touch--large .hw-touch-btn--place { --hw-touch-s: 54px; right: calc(112px + var(--hw-touch-r)); bottom: calc(182px + var(--hw-touch-b)); }
.hw-touch--large .hw-touch-btn--pause,
.hw-touch--large .hw-touch-btn--bag { --hw-touch-s: 52px; border-radius: 15px; }
.hw-touch--large .hw-touch-btn--bag { right: calc(72px + var(--hw-touch-r)); }
@media (orientation: portrait) {
  .hw-touch--large .hw-touch-btn--jump { --hw-touch-s: 84px; right: calc(12px + var(--hw-touch-r)); bottom: calc(96px + var(--hw-touch-b)); }
  .hw-touch--large .hw-touch-btn--mine { --hw-touch-s: 82px; right: calc(108px + var(--hw-touch-r)); bottom: calc(150px + var(--hw-touch-b)); }
  .hw-touch--large .hw-touch-btn--use { --hw-touch-s: 70px; right: calc(16px + var(--hw-touch-r)); bottom: calc(196px + var(--hw-touch-b)); }
  .hw-touch--large .hw-touch-btn--place { --hw-touch-s: 52px; right: calc(104px + var(--hw-touch-r)); bottom: calc(248px + var(--hw-touch-b)); }
  .hw-touch--large .hw-touch-stick { bottom: calc(104px + var(--hw-touch-b)); }
}
/* Quick menu entry. Portrait: the hotbar is a full-width strip at the bottom, so the entry sits just above the stick at the left
   edge (12 px gap). Landscape: the hotbar is centred, so the entry sits above the stick in the left corner. Left-handed layouts
   move the thumb cluster to the left, so the entry goes to the right corner there. */
.hw-touch-btn[hidden] { display: none; }
.hw-touch-btn--menu { --hw-touch-s: 56px; left: calc(12px + var(--hw-touch-l)); bottom: calc(232px + var(--hw-touch-b)); }
.hw-touch-btn--menu .hw-touch-label { font-size: 9px; }
@media (orientation: landscape) {
  .hw-touch-btn--menu { left: calc(34px + var(--hw-touch-l)); bottom: calc(158px + var(--hw-touch-b)); }
}
.hw-touch--one-left .hw-touch-btn--menu { left: auto; right: calc(12px + var(--hw-touch-r)); bottom: calc(232px + var(--hw-touch-b)); }
@media (orientation: landscape) {
  .hw-touch--one-left .hw-touch-btn--menu { right: calc(20px + var(--hw-touch-r)); bottom: calc(16px + var(--hw-touch-b)); }
}
.hw-touch--large .hw-touch-btn--menu { --hw-touch-s: 66px; }
.hw-touch--large .hw-touch-btn--menu .hw-touch-label { font-size: 11px; }
@media (orientation: portrait) {
  /* The large stick sits 8 px higher (bottom 104), so the larger entry lifts with it. */
  .hw-touch--large .hw-touch-btn--menu { bottom: calc(244px + var(--hw-touch-b)); }
}

/* The radial ring: large round items on an arc above the entry button (positions are set inline by quickMenuView.ts). */
.hw-touch-radial { position: absolute; inset: 0; pointer-events: none; }
.hw-touch-radial[hidden] { display: none; }
.hw-touch-radial__item {
  position: absolute;
  box-sizing: border-box;
  margin: -32px 0 0 -32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid var(--hw-touch-rim);
  border-radius: 50%;
  background: var(--hw-touch-fill);
  box-shadow: var(--hw-touch-edge);
  color: var(--hw-touch-ink);
  font: 700 11px / 1.1 var(--hw-font-display, 'Chakra Petch', system-ui, sans-serif);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  pointer-events: auto;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}
.hw-touch-radial__item::before { content: ''; position: absolute; inset: -8px; border-radius: inherit; }
.hw-touch-radial__item:active { transform: scale(0.92); }
.hw-touch-radial__item--on { border-color: var(--hw-touch-accent); color: var(--hw-touch-accent); background: rgba(24, 18, 14, 0.82); }
.hw-touch-radial__item--off { opacity: 0.4; }
.hw-touch-radial--animated .hw-touch-radial__item { animation: hw-touch-radial-in 140ms ease-out both; }
@keyframes hw-touch-radial-in {
  from { opacity: 0; scale: 0.5; }
  to { opacity: 1; scale: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .hw-touch-radial--animated .hw-touch-radial__item { animation: none; }
}

@media (prefers-reduced-motion: reduce) {
  .hw-touch-btn, .hw-touch-stick { transition: none; }
}
`;
