/**
 * Tiles and icons of the glass distillery (docs/DISTILLERY_PLAN.md 2, 2.1). Every module face is one painter: a brass
 * frame with rivets around a see-through glass pane (the liquid inside is drawn live by src/render/distill), the
 * module's emblem etched on the glass, and a status lamp in the top-right corner. The lamp is how a step shows its
 * completion without a screen: dark = idle, amber = working (`_on`), green = done (`_done`), red = blocked
 * (`_blocked`). Icons: beakers of each liquid, steel canisters with a coloured band.
 */
import { CHEM, STATEFUL, type ChemKind } from '../../core/distill';
import type { Canvas, PainterSet } from './canvas';
import * as P from './palette';
import { icon } from './shapes';

type RGB = P.RGB;
const BRASS = [P.rgb(0x5a4020), P.rgb(0x83602a), P.rgb(0xab8338), P.rgb(0xcca44d), P.rgb(0xebd17e)] as const;
const GLASS = P.GLASS;
const ETCH = P.rgb(0xe8f6fa);
const COPPER = P.COPPER;
const IRON = P.IRON_METAL;

type Lamp = 'off' | 'amber' | 'green' | 'red';
const LAMP: Record<Lamp, [RGB, RGB]> = {
  off: [P.rgb(0x2a2622), P.rgb(0x4a443c)],
  amber: [P.rgb(0xd88a12), P.rgb(0xffd060)],
  green: [P.rgb(0x2f9a3a), P.rgb(0x9cf08a)],
  red: [P.rgb(0xb3261e), P.rgb(0xff8a78)],
};

/** Glass pane alpha: see-through, like the glass block's pane but a little more present. */
const PANE_A = 44;

function frame(c: Canvas): void {
  c.fill(GLASS[2], PANE_A);
  c.rect(0, 0, 16, 1, BRASS[3]);
  c.rect(0, 0, 1, 16, BRASS[3]);
  c.rect(0, 15, 16, 1, BRASS[1]);
  c.rect(15, 0, 1, 16, BRASS[1]);
  c.rect(1, 1, 14, 1, BRASS[2]);
  c.rect(1, 14, 14, 1, BRASS[0]);
  for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]] as const) c.set(x, y, BRASS[4]);
  // A glint on the pane.
  for (let i = 0; i < 3; i++) c.set(3 + i, 5 - i, GLASS[4], 150);
}

function lamp(c: Canvas, state: Lamp): void {
  const [dark, light] = LAMP[state];
  c.rect(10, 2, 4, 4, BRASS[0]);
  c.rect(11, 2, 3, 3, dark);
  c.set(11, 2, light);
  c.set(12, 2, light);
  c.set(11, 3, light);
  if (state === 'off') return;
  // The inner rim takes the lamp's colour too, so a module's state reads from across the room.
  c.rect(1, 1, 14, 1, light);
  c.rect(1, 14, 14, 1, dark);
  c.rect(1, 2, 1, 12, dark);
  c.rect(14, 2, 1, 12, dark);
}

const etch = (c: Canvas, x: number, y: number, a = 210): void => c.set(x, y, ETCH, a);
function etchRect(c: Canvas, x: number, y: number, w: number, h: number, a = 210): void {
  for (let i = x; i < x + w; i++) {
    etch(c, i, y, a);
    etch(c, i, y + h - 1, a);
  }
  for (let j = y; j < y + h; j++) {
    etch(c, x, j, a);
    etch(c, x + w - 1, j, a);
  }
}

const EMBLEMS: Record<ChemKind, (c: Canvas, lit: boolean) => void> = {
  still_base(c, lit) {
    // A copper burner plate with a row of jets; flames when it is firing.
    c.rect(2, 9, 12, 2, COPPER[2]);
    c.rect(2, 9, 12, 1, COPPER[3]);
    c.rect(2, 11, 12, 3, COPPER[1]);
    for (let x = 3; x < 13; x += 2) c.set(x, 8, COPPER[0]);
    if (lit) for (let x = 3; x < 13; x += 2) {
      c.set(x, 7, P.rgb(0xffb040));
      c.set(x, 6, P.rgb(0xffe08a), 220);
    }
  },
  boiling_flask(c) {
    // A round-bottomed flask: neck and bulb.
    etchRect(c, 7, 3, 2, 5);
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      etch(c, Math.round(7.5 + Math.cos(t) * 4.5), Math.round(10.5 + Math.sin(t) * 3.2));
    }
  },
  reaction_vessel(c) {
    etchRect(c, 3, 5, 10, 9);
    for (let x = 4; x < 12; x++) etch(c, x, 5, 120);
  },
  column_segment(c) {
    etchRect(c, 5, 1, 6, 14);
    for (const y of [4, 7, 10, 13]) for (let x = 6; x < 10; x++) etch(c, x, y, 150);
  },
  condenser_coil(c) {
    for (let y = 3; y < 14; y++) etch(c, (Math.floor(y / 2) % 2 === 0 ? 5 : 10) + (y % 2), y);
    for (const y of [4, 8, 12]) for (let x = 5; x <= 11; x++) etch(c, x, y, 170);
  },
  cooling_jacket(c) {
    etchRect(c, 2, 3, 12, 11);
    etchRect(c, 5, 5, 6, 7, 160);
    c.rect(3, 12, 10, 1, P.rgb(0x3a86b4), 150);
  },
  receiver(c) {
    etchRect(c, 4, 6, 8, 8);
    for (let x = 6; x < 10; x++) etch(c, x, 5);
    etch(c, 11, 5);
  },
  glass_tube(c) {
    for (let x = 1; x < 15; x++) {
      etch(c, x, 6);
      etch(c, x, 9);
    }
  },
  airlock_cap(c) {
    c.rect(2, 9, 12, 5, BRASS[2]);
    c.rect(2, 9, 12, 1, BRASS[4]);
    for (const [x, y] of [[6, 8], [7, 7], [8, 7], [9, 8]] as const) etch(c, x, y);
  },
  chem_port(c) {
    c.rect(4, 4, 8, 8, IRON[2]);
    c.frame(4, 4, 8, 8, IRON[4]);
    c.rect(6, 6, 4, 4, IRON[0]);
    for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 10]] as const) c.set(x, y, IRON[3]);
  },
  reflux_head(c) {
    etchRect(c, 4, 3, 8, 10);
    for (const y of [5, 8, 11]) for (let x = 5; x < 11; x++) etch(c, x, y, 160);
    etch(c, 8, 2);
    etch(c, 7, 13);
  },
  filter_bed(c) {
    etchRect(c, 3, 4, 10, 9);
    for (let y = 6; y < 12; y += 2) for (let x = 4; x < 12; x++) etch(c, x, y, 140);
  },
  separatory_funnel(c) {
    // A pear-shaped bulb over a brass tap and a stem: two etched layers inside.
    etchRect(c, 5, 3, 6, 3, 150);
    etchRect(c, 6, 6, 4, 3, 210);
    c.rect(5, 9, 6, 1, BRASS[3]);
    etch(c, 8, 10);
    etch(c, 8, 11);
    etch(c, 8, 12);
  },
  vacuum_cap(c) {
    c.rect(3, 8, 10, 5, BRASS[2]);
    c.rect(3, 8, 10, 1, BRASS[4]);
    etchRect(c, 6, 3, 4, 5, 180);
    etch(c, 8, 2);
  },
};

function face(kind: ChemKind, state: Lamp): (c: Canvas) => void {
  return (c) => {
    frame(c);
    EMBLEMS[kind](c, state === 'amber');
    lamp(c, state);
  };
}

function top(c: Canvas): void {
  frame(c);
  c.rect(5, 5, 6, 6, GLASS[3], 110);
  c.frame(5, 5, 6, 6, BRASS[2]);
}

const tiles: Record<string, (c: Canvas) => void> = { chem_top: top };
for (const kind of Object.values(CHEM)) {
  tiles[`chem_${kind}`] = face(kind, 'off');
  tiles[`chem_${kind}_on`] = face(kind, 'amber');
  if (STATEFUL.includes(kind)) {
    tiles[`chem_${kind}_done`] = face(kind, 'green');
    tiles[`chem_${kind}_blocked`] = face(kind, 'red');
  }
}

// ---- icons --------------------------------------------------------------------------------------

function ramp(hex: number): RGB[] {
  const base = P.rgb(hex);
  return [P.shade(base, -0.45), P.shade(base, -0.2), base, P.shade(base, 0.2), P.shade(base, 0.45)];
}

function beaker(c: Canvas, fill: RGB[]): void {
  c.rect(4, 2, 8, 1, GLASS[3]);
  c.rect(5, 3, 6, 10, GLASS[1]);
  c.rect(5, 3, 1, 10, GLASS[4]);
  c.rect(10, 3, 1, 10, GLASS[0]);
  c.rect(5, 13, 6, 1, GLASS[0]);
  c.rect(6, 4, 4, 8, GLASS[2]);
  c.rect(6, 6, 4, 7, fill[2]);
  c.rect(6, 6, 4, 1, fill[4]);
  c.rect(9, 7, 1, 6, fill[1]);
  c.set(7, 9, fill[3]);
}

function canister(c: Canvas, band: RGB[] | null): void {
  // A steel jerrycan: body, handle, spout, a coloured band for its contents.
  c.rect(3, 4, 10, 10, IRON[2]);
  c.rect(3, 4, 1, 10, IRON[4]);
  c.rect(12, 4, 1, 10, IRON[0]);
  c.rect(3, 13, 10, 1, IRON[1]);
  c.rect(5, 2, 4, 2, IRON[3]);
  c.rect(6, 3, 2, 1, IRON[0]);
  c.rect(10, 2, 2, 2, IRON[4]);
  for (let i = 0; i < 5; i++) c.set(5 + i, 6 + i, IRON[3]);
  if (band) {
    c.rect(4, 8, 8, 3, band[2]);
    c.rect(4, 8, 8, 1, band[4]);
    c.rect(4, 10, 8, 1, band[1]);
  }
}

const ICONS: Record<string, (c: Canvas) => void> = {
  item_syrup_beaker: icon((c) => beaker(c, ramp(0xb8661a))),
  item_wash_beaker: icon((c) => beaker(c, ramp(0xc9a87c))),
  item_low_wines_beaker: icon((c) => beaker(c, ramp(0xa9c0b8))),
  item_spirit_beaker: icon((c) => beaker(c, ramp(0xd8ecf6))),
  item_fuel_ethanol_beaker: icon((c) => beaker(c, ramp(0xd8f0a0))),
  item_empty_canister: icon((c) => canister(c, null)),
  item_crude_canister: icon((c) => canister(c, ramp(0x2a221c))),
  item_gasoline_canister: icon((c) => canister(c, ramp(0xf2d24a))),
  item_kerosene_canister: icon((c) => canister(c, ramp(0x6fa8e0))),
  item_diesel_canister: icon((c) => canister(c, ramp(0xc98f2e))),
  item_residue_canister: icon((c) => canister(c, ramp(0x5a4a40))),
  item_slop_canister: icon((c) => canister(c, ramp(0x7a8a50))),
  item_lube_base_canister: icon((c) => canister(c, ramp(0x6020a0))),
  item_bitumen_canister: icon((c) => canister(c, ramp(0x103060))),
  item_lubricant_canister: icon((c) => canister(c, ramp(0x20ff80))),
  item_tincture_beaker: icon((c) => beaker(c, ramp(0xc02080))),
  item_clear_tincture_beaker: icon((c) => beaker(c, ramp(0x66ffcc))),
  asphalt(c) {
    const dark = P.rgb(0x1a1c20);
    const mid = P.rgb(0x2c3036);
    const grit = P.rgb(0x6a624e);
    const sand = P.rgb(0x8a7a58);
    const tar = P.rgb(0x0e1014);
    c.fill(mid);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const n = (x * 13 + y * 7) % 11;
      if (n === 0) c.set(x, y, grit);
      else if (n === 1) c.set(x, y, sand);
      else if (n === 2) c.set(x, y, tar);
      else if ((x + y) % 5 === 0) c.set(x, y, dark);
    }
  },
};

const BUFFS = ['spring', 'hearthkept', 'mending', 'swift', 'vigor', 'lasting'] as const;
const ESSENCE_HEX = [0x9ad27a, 0xc46a3a, 0xd24a6a, 0xf0d060, 0x8a4a28, 0x6a8a4a];
const ELIXIR_HEX = [0x40e0a0, 0xff8844, 0xff6688, 0xffee88, 0xc08040, 0xa0c060];

function vial(c: Canvas, fill: RGB[], mark: number): void {
  c.rect(6, 1, 4, 2, P.rgb(0x6a3a1a));
  c.rect(6, 1, 2, 1, P.rgb(0xc08050));
  c.rect(5, 3, 6, 11, GLASS[1]);
  c.rect(5, 3, 1, 11, GLASS[4]);
  c.rect(10, 3, 1, 11, GLASS[0]);
  c.rect(5, 13, 6, 1, GLASS[0]);
  c.rect(6, 5, 4, 8, fill[2]);
  c.rect(6, 5, 4, 1, fill[4]);
  c.rect(9, 6, 1, 7, fill[1]);
  c.set(7, 8, fill[3]);
  c.set(6 + (mark % 4), 6 + Math.floor(mark / 2), fill[0]);
}

for (let i = 0; i < BUFFS.length; i++) {
  const b = BUFFS[i];
  ICONS[`item_essence_${b}`] = icon((c) => vial(c, ramp(ESSENCE_HEX[i]), i));
  ICONS[`item_elixir_${b}`] = icon((c) => vial(c, ramp(ELIXIR_HEX[i]), i + 3));
}

export const DISTILL_TEXTURES: PainterSet = { ...tiles, ...ICONS };
