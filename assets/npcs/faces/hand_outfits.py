"""Hand-painted sleep and swim sprites for the tavern regulars, built from each character's DAY sprite.

Per character (assets/npcs/<id>.jpg, 896x1200 or 960x1280 pixel art on light grey):

- Head: everything above the collar line is copied from the day sprite at full resolution, so the head, face, hair, hat and glasses
  are the same pixels. Props that the outfit drops (a hammer, a staff, a vapour flask) are erased; the rest of the head stays.
- Body: below the collar the figure is repainted on an 8 px working grid (the day art is blocky at about that size). Each outfit is a
  set of row-band and column rules (torso, sleeves, trousers, slippers, ...) in colours sampled from the day sprite where they exist
  (skin, hair, boots), with row-wise three-tone cel shading, dark seams between parts, an outline on the silhouette and simple prints
  (stars, stripes, dots, leaves). Hair locks that hang below the collar are kept from the day sprite.

  python assets/npcs/faces/hand_outfits.py [id ...]     (writes assets/npcs/<id>_sleep.jpg and <id>_swim.jpg)
  node scripts/npc-art.mjs
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IDS = ['mara', 'rosa', 'gruk', 'orrin', 'bram', 'veyra']
C = 8  # working grid cell in px of the day art
GREY = np.array([216, 216, 216])


def hx(s):
    return np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])


def tone(c, k):
    """Lighter (k > 0) or darker (k < 0) version of a colour, for ramps made from one base colour."""
    c = np.asarray(c, float)
    return np.clip(c + (255 - c) * k if k > 0 else c * (1 + k), 0, 255).astype(int)


class Sprite:
    def __init__(self, cid):
        im = Image.open(os.path.join(ROOT, f'{cid}.jpg')).convert('RGB')
        self.full = np.array(im).astype(int)
        self.H, self.W, _ = self.full.shape
        self.h, self.w = self.H // C, self.W // C
        self.grid = np.array(im.resize((self.w, self.h), Image.BOX)).astype(int)
        corners = np.stack([self.full[0, 0], self.full[0, -1], self.full[-1, 0], self.full[-1, -1]])
        self.bg = np.median(corners, axis=0)
        self.fig_full = np.abs(self.full - self.bg).sum(axis=2) > 24  # background varies by <= 12 here; light garments sit above 24
        self.fig = np.abs(self.grid - self.bg).sum(axis=2) > 24
        self.Y, self.X = np.mgrid[0:self.h, 0:self.w]
        self.lum = self.grid.mean(axis=2)


def _runs(row):
    idx = np.flatnonzero(row)
    if idx.size == 0:
        return []
    br = np.flatnonzero(np.diff(idx) > 1)
    starts = np.r_[idx[0], idx[br + 1]]
    ends = np.r_[idx[br], idx[-1]]
    return list(zip(starts.tolist(), ends.tolist()))


class Canvas:
    """Body layer on the grid. `on` marks painted cells, `keep` cells are copied from the day sprite and never repainted."""

    def __init__(self, sp, collar, keep, allow, silh_to=80):
        self.sp = sp
        self.X, self.Y = sp.X, sp.Y
        self.col = np.zeros((sp.h, sp.w, 3), int)
        self.on = np.zeros((sp.h, sp.w), bool)
        self.zid = np.zeros((sp.h, sp.w), int)
        self.nz = 1
        self.collar = collar
        self.allow = allow.copy()
        # Above row 80 the zones are clipped to the day sprite's own silhouette (shoulders, arms, torso follow its shape); lower down
        # the legs are painted by their own rules, since the thin day stockings would leave holes.
        self.silh = sp.fig & (self.Y >= collar) & (self.Y < silh_to)
        self.free = self.Y >= silh_to
        self.keep = keep & (self.Y >= collar)
        self.col[self.keep] = sp.grid[self.keep]
        self.on[self.keep] = True

    def _ok(self, mask):
        return mask & (self.silh | self.free | self.allow) & ~self.keep

    def set(self, mask, colour):
        m = self._ok(mask)
        self.col[m] = np.asarray(colour)
        self.on[m] = True
        self.zid[m] = self.nz
        self.nz += 1
        return m

    def ramp(self, mask, base, light, shade, t=0.3):
        """Three-tone cel shade per horizontal run: the left edge of each run is lit, the right edge shaded."""
        m = self.set(mask, base)
        for y in range(self.sp.h):
            for a, b in _runs(m[y]):
                n = b - a + 1
                if n < 4:
                    continue
                k = max(1, round(t * n))
                self.col[y, a:a + k] = np.asarray(light)
                self.col[y, b - k + 1:b + 1] = np.asarray(shade)
        return m

    def flat(self, mask, colour):
        return self.set(mask, colour)

    def pattern(self, mask, colour, cells):
        m = self._ok(mask & cells)
        self.col[m] = np.asarray(colour)
        return m

    def line(self, mask, colour):
        m = self._ok(mask) & self.on
        self.col[m] = np.asarray(colour)

    def seams(self, colour):
        """Dark line on the upper/left cell wherever two painted parts meet."""
        z, on = self.zid, self.on
        down = np.zeros_like(on)
        down[:-1] = on[:-1] & on[1:] & (z[:-1] != z[1:])
        right = np.zeros_like(on)
        right[:, :-1] = on[:, :-1] & on[:, 1:] & (z[:, :-1] != z[:, 1:])
        m = (down | right) & ~self.keep
        self.col[m] = np.asarray(colour)

    def despeckle(self, n=6):
        """Drops small detached clusters (stray cells left by the clip) so only the figure's parts remain."""
        on, H, W = self.on, self.on.shape[0], self.on.shape[1]
        seen = np.zeros_like(on)
        for y in range(H):
            for x in range(W):
                if on[y, x] and not seen[y, x]:
                    comp, stack = [], [(y, x)]
                    seen[y, x] = True
                    while stack:
                        cy, cx = stack.pop()
                        comp.append((cy, cx))
                        for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                            if 0 <= ny < H and 0 <= nx < W and on[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                stack.append((ny, nx))
                    if len(comp) < n:
                        for cy, cx in comp:
                            self.on[cy, cx] = False

    def outline(self, colour):
        on = self.on
        p = np.pad(on, 1)
        inner = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        self.col[on & ~inner] = np.asarray(colour)

    def compose(self, erase, out_path=None):
        sp = self.sp
        cut = self.collar * C
        out = np.tile(GREY, (sp.H, sp.W, 1)).astype(np.uint8)
        erase_full = np.repeat(np.repeat(erase, C, 0), C, 1)
        head = sp.fig_full & ~erase_full
        head[cut:] = False
        out[head] = sp.full[head].astype(np.uint8)
        on_full = np.repeat(np.repeat(self.on, C, 0), C, 1)
        col_full = np.repeat(np.repeat(self.col, C, 0), C, 1)
        out[on_full] = col_full[on_full].astype(np.uint8)
        img = Image.fromarray(out)
        if out_path:
            img.save(out_path, quality=95, subsampling=0)
        return img


def torso(cv, bands):
    """Union of row bands (y0, y1, left, right) in grid cells."""
    m = np.zeros_like(cv.on)
    for y0, y1, l, r in bands:
        m |= (cv.Y >= y0) & (cv.Y <= y1) & (cv.X >= l) & (cv.X <= r)
    return m


def rows(cv, y0, y1):
    return (cv.Y >= y0) & (cv.Y <= y1)


def cols(cv, *spans):
    m = np.zeros_like(cv.on)
    for l, r in spans:
        m |= (cv.X >= l) & (cv.X <= r)
    return m


def speck(cv, p, seed):
    """Sparse scattered single cells (stars, flecks), deterministic per seed."""
    return np.random.default_rng(seed).random(cv.on.shape) < p


def stripes_h(cv, period, duty=1, off=0):
    return ((cv.Y + off) % period) < duty


def stripes_v(cv, period, duty=1, off=0):
    return ((cv.X + off) % period) < duty


def dots(cv, p=4):
    return ((cv.Y % p) == 0) & (((cv.X + (cv.Y // p) * 2) % p) == 0)


SKIN = hx('#f5cdbd')
SKIN_S = hx('#e7a69f')


# ---------------------------------------------------------------- MARA
SKIN = np.array([245, 205, 189])
SKIN_S = np.array([231, 166, 159])


def skin_ramp(cv, mask):
    cv.ramp(mask, SKIN, SKIN + np.array([6, 6, 4]), SKIN_S)


def mara(cv, outfit, sp):
    LN = hx('#2a1d4d')
    VB, VL, VS, GOLD = hx('#6b56a8'), hx('#8f7fca'), hx('#4a3a80'), hx('#f4e7a4')
    if outfit == 'sleep':
        top = torso(cv, [(38, 38, 49, 62), (39, 41, 42, 70), (42, 50, 40, 72), (51, 66, 41, 71), (67, 80, 42, 71)])
        sleeves = rows(cv, 42, 70) & cols(cv, (37, 40), (72, 75))
        legs = rows(cv, 81, 135) & cols(cv, (42, 52), (59, 68))
        feet = rows(cv, 136, 146) & cols(cv, (41, 53), (58, 69))
        cv.ramp(top | sleeves, VB, VL, VS)
        cv.pattern(top | sleeves, GOLD, speck(cv, 0.04, 1))
        cv.ramp(legs, VB, VL, VS)
        cv.pattern(legs, GOLD, speck(cv, 0.04, 4))
        cv.line(cols(cv, (56, 56)) & rows(cv, 40, 80) & top, LN)
        cv.line(rows(cv, 81, 81) & (top | legs), LN)
        F_B, F_L, F_S = hx('#cbbcea'), hx('#efe7fb'), hx('#9a86c8')
        cv.ramp(feet, F_B, F_L, F_S)
        cv.pattern(feet, F_L, speck(cv, 0.12, 9))
        cv.line(rows(cv, 146, 146) & feet, hx('#4a3a80'))
        cv.seams(LN)
        finish(cv, LN)
    else:
        cv.allow |= rows(cv, 42, 46) & cols(cv, (42, 69))
        bra = rows(cv, 42, 46) & cols(cv, (42, 53), (58, 69))
        bra_c = rows(cv, 42, 46) & cols(cv, (42, 53), (58, 69)) & (cv.Y >= 46)
        torso_skin = rows(cv, 42, 72) & cols(cv, (42, 69))
        arms = rows(cv, 42, 70) & cols(cv, (37, 40), (71, 74))
        briefs = rows(cv, 73, 80) & cols(cv, (42, 69))
        legs = rows(cv, 81, 136) & cols(cv, (42, 52), (59, 68))
        feet = rows(cv, 137, 146) & cols(cv, (41, 53), (58, 69))
        skin_ramp(cv, torso_skin)
        skin_ramp(cv, rows(cv, 37, 38) & cols(cv, (50, 61)))
        skin_ramp(cv, arms)
        skin_ramp(cv, legs)
        skin_ramp(cv, feet)
        cv.ramp(bra, VB, VL, VS)
        cv.pattern(bra, GOLD, speck(cv, 0.12, 2))
        cv.ramp(briefs, VB, VL, VS)
        cv.pattern(briefs, GOLD, speck(cv, 0.12, 5))
        sarong = rows(cv, 80, 99) & cols(cv, (40, 71)) & ((cv.X + cv.Y // 2) < 110)
        P_B, P_L, P_S = hx('#7a3f8f'), hx('#9a5cb0'), hx('#55276a')
        cv.ramp(sarong, P_B, P_L, P_S)
        cv.line(rows(cv, 99, 99) & sarong, P_S)
        cv.line(rows(cv, 139, 139) & feet, GOLD)
        cv.line(rows(cv, 145, 146) & feet, hx('#7e4c43'))
        cv.seams(LN)
        finish(cv, LN)
    return cv


# ---------------------------------------------------------------- ROSA
def rosa(cv, outfit, sp):
    LN = hx('#5a1f1f')
    RED, RED_L, RED_S = hx('#b5382f'), hx('#d4574b'), hx('#7a2320')
    CR, CR_L, CR_S = hx('#f3e6cf'), hx('#fff7e8'), hx('#c9b28f')
    if outfit == 'sleep':
        gown = torso(cv, [(42, 44, 44, 68), (45, 50, 41, 71), (51, 66, 40, 72), (67, 74, 40, 72), (75, 85, 40, 72), (86, 99, 38, 74)])
        sleeves = rows(cv, 46, 78) & cols(cv, (36, 41), (70, 75))
        cv.ramp(gown | sleeves, RED, RED_L, RED_S)
        cv.pattern(gown | sleeves, RED_S, (cv.X + cv.Y) % 6 == 0)
        cv.flat(rows(cv, 47, 99) & cols(cv, (54, 57)) & gown, CR)
        cv.flat(rows(cv, 73, 74) & gown, CR_S)
        cv.flat(rows(cv, 76, 77) & sleeves, CR)
        cv.ramp(rows(cv, 78, 81) & sleeves, SKIN, SKIN + 6, SKIN_S)
        lace = rows(cv, 100, 101) & cols(cv, (40, 71))
        cv.flat(lace, CR_L)
        cv.pattern(lace, CR, (cv.X % 2) == 0)
        legs = rows(cv, 102, 136) & cols(cv, (46, 54), (58, 67))
        cv.ramp(legs, CR, CR_L, CR_S)
        feet = rows(cv, 137, 146) & cols(cv, (44, 55), (57, 68))
        cv.ramp(feet, CR, CR_L, CR_S)
        cv.line(rows(cv, 146, 146) & feet, CR_S)
        cv.seams(LN)
        finish(cv, LN)
    else:
        halter = rows(cv, 43, 49) & cols(cv, (47, 66))
        straps = rows(cv, 39, 43) & cols(cv, (49, 50), (62, 63))
        torso_skin = rows(cv, 50, 74) & cols(cv, (42, 70))
        arms = rows(cv, 44, 81) & cols(cv, (36, 41), (70, 75))
        cv.ramp(torso_skin | arms, SKIN, SKIN + 6, SKIN_S)
        cv.ramp(halter | straps, RED, RED_L, RED_S)
        cv.pattern(halter | straps, CR, dots(cv, 3))
        bottoms = rows(cv, 75, 81) & cols(cv, (43, 69))
        cv.ramp(bottoms, RED, RED_L, RED_S)
        cv.pattern(bottoms, CR, dots(cv, 3))
        towel = rows(cv, 42, 62) & cols(cv, (33, 40))
        cv.flat(towel & ((cv.X + cv.Y) % 4 < 2), hx('#3f6fb5'))
        cv.flat(towel & ((cv.X + cv.Y) % 4 >= 2), CR)
        legs = rows(cv, 82, 136) & cols(cv, (46, 54), (58, 67))
        cv.ramp(legs, SKIN, SKIN + 6, SKIN_S)
        sandal = rows(cv, 137, 146) & cols(cv, (44, 55), (57, 68))
        cv.ramp(sandal, hx('#8a5a44'), hx('#a56d52'), hx('#5a3a2e'))
        cv.line(rows(cv, 140, 140) & sandal, hx('#4a2c22'))
        cv.line(rows(cv, 144, 144) & sandal, hx('#4a2c22'))
        cv.seams(LN)
        finish(cv, LN)
    return cv


# ---------------------------------------------------------------- GRUK
GR, GR_L, GR_S = hx('#618049'), hx('#7d9e5c'), hx('#4c6a3d')
BL, BL_L, BL_S = hx('#2f5fa8'), hx('#4a7fc0'), hx('#244a80')
WH = hx('#eef1f5')


def gruk(cv, outfit, sp):
    LN = hx('#22331e')
    cv.allow |= (cv.Y >= 22) & (cv.Y <= 29) & ((cv.X <= 37) | (cv.X >= 67))
    top = torso(cv, [(30, 34, 30, 74), (35, 50, 29, 75), (51, 66, 31, 72), (67, 72, 33, 70)])
    if outfit == 'sleep':
        sleeves = rows(cv, 30, 76) & cols(cv, (16, 29), (75, 86))
        cv.ramp(top | sleeves, BL, BL_L, BL_S)
        cv.pattern(top | sleeves, WH, stripes_h(cv, 4, 2))
        hands = rows(cv, 72, 82) & cols(cv, (16, 27), (78, 86))
        cv.ramp(hands, GR, GR_L, GR_S)
        trousers = rows(cv, 77, 118) & cols(cv, (30, 50), (54, 74))
        cv.ramp(trousers, BL, BL_L, BL_S)
        cv.pattern(trousers, WH, stripes_v(cv, 5, 2))
        cv.flat(rows(cv, 77, 78) & cols(cv, (30, 74)), BL_S)
        ankle = rows(cv, 119, 127) & cols(cv, (30, 48), (54, 72))
        cv.ramp(ankle, hx('#7a5238'), hx('#9a6a48'), hx('#4f3322'))
        slip = rows(cv, 128, 146) & cols(cv, (24, 48), (52, 76))
        cv.ramp(slip, hx('#7a5238'), hx('#9a6a48'), hx('#4f3322'))
        cv.line(rows(cv, 136, 136) & slip, hx('#4f3322'))
    else:
        cv.ramp(top, GR, GR_L, GR_S)
        cv.line(cols(cv, (52, 52)) & rows(cv, 36, 66) & top, GR_S)
        cv.line(rows(cv, 46, 46) & cols(cv, (38, 48), (56, 66)) & top, GR_S)
        cv.line(rows(cv, 58, 58) & cols(cv, (38, 48), (56, 66)) & top, GR_S)
        arms = rows(cv, 30, 82) & cols(cv, (16, 29), (75, 86))
        cv.ramp(arms, GR, GR_L, GR_S)
        towel = rows(cv, 28, 56) & cols(cv, (21, 30))
        cv.flat(towel & ((cv.X + cv.Y) % 4 < 2), hx('#2a8c9a'))
        cv.flat(towel & ((cv.X + cv.Y) % 4 >= 2), WH)
        cord = rows(cv, 70, 70) & cols(cv, (34, 70))
        cv.flat(cord, hx('#b08850'))
        cv.pattern(cord, hx('#7a5a30'), (cv.X % 2) == 0)
        cloth = (rows(cv, 71, 74) & cols(cv, (36, 68))) | (rows(cv, 75, 86) & cols(cv, (38, 66)))
        cv.ramp(cloth, hx('#d9557a'), hx('#ec7a9a'), hx('#a33a5c'))
        cv.pattern(cloth, hx('#f7c948'), dots(cv, 5))
        cv.pattern(cloth, hx('#2f6b3a'), speck(cv, 0.06, 3))
        legs = rows(cv, 87, 120) & cols(cv, (38, 50), (54, 66))
        cv.ramp(legs, GR, GR_L, GR_S)
        sandal = rows(cv, 121, 146) & cols(cv, (24, 48), (52, 76))
        cv.ramp(sandal, hx('#7a5238'), hx('#9a6a48'), hx('#4f3322'))
        cv.line(rows(cv, 132, 132) & sandal, hx('#4f3322'))
        cv.line(rows(cv, 138, 138) & sandal, hx('#4f3322'))
    cv.seams(LN)
    finish(cv, LN)
    return cv


# ---------------------------------------------------------------- ORRIN
ORS, ORS_S = hx('#e9ad89'), hx('#c98a68')


def orrin(cv, outfit, sp):
    LN = hx('#2a3a4a')
    if outfit == 'sleep':
        shirt = torso(cv, [(37, 40, 33, 73), (41, 64, 31, 76), (65, 80, 33, 79), (81, 108, 30, 82)])
        sleeves = rows(cv, 41, 66) & cols(cv, (27, 34), (74, 81))
        m = shirt | sleeves
        cv.ramp(m, BL, BL_L, BL_S)
        cv.pattern(m, WH, stripes_h(cv, 4, 2))
        cv.ramp(rows(cv, 67, 72) & cols(cv, (27, 34), (74, 81)), ORS, ORS + 6, ORS_S)
        cv.ramp(rows(cv, 109, 130) & cols(cv, (42, 53), (59, 70)), ORS, ORS + 6, ORS_S)
        slip = rows(cv, 131, 146) & cols(cv, (40, 54), (57, 72))
        cv.ramp(slip, hx('#7a5238'), hx('#9a6a48'), hx('#4f3322'))
        cv.line(rows(cv, 146, 146) & slip, hx('#4f3322'))
    else:
        chest = torso(cv, [(37, 40, 36, 76), (41, 71, 35, 77)])
        cv.ramp(chest, ORS, ORS + 6, ORS_S)
        arms = rows(cv, 40, 72) & cols(cv, (27, 34), (74, 81))
        cv.ramp(arms, ORS, ORS + 6, ORS_S)
        shorts = rows(cv, 72, 94) & cols(cv, (38, 69))
        cv.ramp(shorts, hx('#2e7b5a'), hx('#4a9a72'), hx('#1f5a40'))
        cv.pattern(shorts, hx('#9bd17e'), speck(cv, 0.10, 6))
        cv.pattern(shorts, hx('#6fb35c'), ((cv.X + cv.Y) % 9) == 0)
        legs = rows(cv, 95, 136) & cols(cv, (42, 53), (59, 70))
        cv.ramp(legs, ORS, ORS + 6, ORS_S)
        flip = rows(cv, 137, 146) & cols(cv, (40, 54), (57, 72))
        cv.ramp(flip, hx('#7e4c43'), hx('#9a6558'), hx('#5a3228'))
        cv.line(rows(cv, 140, 140) & flip, hx('#f2c94c'))
        duck = (rows(cv, 68, 74) & cols(cv, (79, 87))) | (rows(cv, 64, 67) & cols(cv, (81, 84)))
        cv.ramp(duck, hx('#f5d33a'), hx('#fff1a0'), hx('#c9a21f'))
        cv.flat(rows(cv, 66, 66) & cols(cv, (85, 87)), hx('#f29b38'))
        snork = rows(cv, 70, 92) & cols(cv, (25, 26))
        cv.ramp(snork, hx('#4a4f57'), hx('#7a818c'), hx('#2e3238'))
        cv.flat(rows(cv, 70, 71) & cols(cv, (25, 26)), hx('#cfd6dd'))
    cv.seams(LN)
    finish(cv, LN)
    return cv


# ---------------------------------------------------------------- BRAM
OL, OL_L, OL_S = hx('#5e6b3a'), hx('#7a8650'), hx('#414b27')
PATCH = hx('#3e4a2a')
ROPE = hx('#8a6a3c')


def bram(cv, outfit, sp):
    LN = hx('#262d18')
    if outfit == 'sleep':
        dome = ((cv.X - 54) / 13.0) ** 2 + ((cv.Y - 14) / 9.0) ** 2 <= 1.0
        cv.allow |= dome & (cv.Y <= 19)
        cv.ramp(dome & (cv.Y <= 19), hx('#a6a6a1'), hx('#c4c4bf'), hx('#7d7d79'))
        body = torso(cv, [(36, 44, 28, 80), (45, 80, 30, 78), (81, 124, 25, 81)])
        sleeves = rows(cv, 40, 82) & cols(cv, (22, 31), (77, 86))
        cv.ramp(body | sleeves, OL, OL_L, OL_S)
        cv.flat(rows(cv, 57, 62) & cols(cv, (40, 46)), PATCH)
        cv.flat(rows(cv, 100, 106) & cols(cv, (62, 70)), PATCH)
        cv.flat(rows(cv, 88, 92) & cols(cv, (30, 34)), PATCH)
        cv.ramp(rows(cv, 74, 75) & cols(cv, (30, 76)), ROPE, hx('#a68450'), hx('#5e4520'))
        cv.flat(rows(cv, 76, 78) & cols(cv, (52, 56)), hx('#5e4520'))
        cv.ramp(rows(cv, 125, 129) & cols(cv, (36, 70)), hx('#efe7d2'), hx('#fff8e6'), hx('#c9bca0'))
        slip = rows(cv, 130, 146) & cols(cv, (36, 50), (56, 71))
        cv.ramp(slip, hx('#7a5238'), hx('#9a6a48'), hx('#4f3322'))
        cv.line(rows(cv, 146, 146) & slip, hx('#4f3322'))
    else:
        cv.allow |= rows(cv, 34, 36) & cols(cv, (22, 34), (74, 86))
        chest = torso(cv, [(36, 44, 36, 70), (45, 72, 33, 75)])
        cv.ramp(chest, SKIN, SKIN + 6, SKIN_S)
        arms = rows(cv, 40, 84) & cols(cv, (24, 33), (75, 84))
        cv.ramp(arms, SKIN, SKIN + 6, SKIN_S)
        brief = rows(cv, 73, 86) & cols(cv, (38, 70))
        cv.ramp(brief, hx('#e0743a'), hx('#f29a5a'), hx('#a84c26'))
        cv.pattern(brief, hx('#f2c94c'), stripes_h(cv, 6, 1, 1))
        cv.pattern(brief, hx('#2f5a3a'), speck(cv, 0.12, 8))
        legs = rows(cv, 87, 130) & cols(cv, (42, 52), (56, 66))
        cv.ramp(legs, SKIN, SKIN + 6, SKIN_S)
        sandal = rows(cv, 131, 146) & cols(cv, (40, 54), (54, 68))
        cv.ramp(sandal, hx('#7a5238'), hx('#9a6a48'), hx('#4f3322'))
        cv.line(rows(cv, 138, 138) & sandal, hx('#4f3322'))
        fan = (((cv.X - 80) / 6.0) ** 2 + ((cv.Y - 66) / 9.0) ** 2 <= 1.0) & (cv.X >= 74)
        cv.allow |= fan
        cv.ramp(fan, hx('#4f8a3a'), hx('#7fb060'), hx('#2f5a22'))
        cv.pattern(fan, hx('#a8d88a'), stripes_v(cv, 3, 1))
    cv.seams(LN)
    finish(cv, LN)
    return cv


# ---------------------------------------------------------------- VEYRA
TEAL, TEAL_L, TEAL_S = hx('#2f6f6b'), hx('#3f8c86'), hx('#1f4f4c')
GOLD, GOLD_L, GOLD_S = hx('#d9b23a'), hx('#f0d46a'), hx('#a8862a')
WHT, WHT_L, WHT_S = hx('#e8e6ee'), hx('#ffffff'), hx('#b9b3c9')
PUR, PUR_L, PUR_S = hx('#6a1a5a'), hx('#7f2870'), hx('#3a0a35')


def veyra(cv, outfit, sp):
    LN = hx('#2a0a2a')
    if outfit == 'sleep':
        top = torso(cv, [(31, 33, 49, 68), (34, 50, 48, 70), (51, 66, 48, 70), (67, 76, 49, 69)])
        cv.ramp(top, TEAL, TEAL_L, TEAL_S)
        cv.flat(cols(cv, (59, 59)) & rows(cv, 31, 70) & top, GOLD)
        cv.flat(rows(cv, 31, 31) & top, GOLD)
        legs = rows(cv, 77, 134) & cols(cv, (50, 58), (61, 69))
        cv.ramp(legs, TEAL, TEAL_L, TEAL_S)
        robe = torso(cv, [(36, 40, 41, 79), (41, 69, 40, 79), (70, 72, 43, 76), (73, 100, 40, 80), (101, 108, 39, 81)])
        robe &= ~(cols(cv, (55, 63)) & (cv.Y <= 100))
        cv.ramp(robe, WHT, WHT_L, WHT_S)
        cv.pattern(robe, WHT_S, (cv.X + cv.Y) % 9 == 0)
        cv.flat(rows(cv, 69, 71) & cols(cv, (46, 72)) & robe, GOLD)
        cv.flat(rows(cv, 70, 70) & cols(cv, (57, 61)), GOLD_S)
        feet = rows(cv, 136, 146) & cols(cv, (49, 58), (61, 70))
        cv.ramp(feet, TEAL, TEAL_L, TEAL_S)
        cv.line(rows(cv, 145, 145) & feet, GOLD)
    else:
        lens_zone = (cv.Y >= 8) & (cv.Y <= 10) & (((cv.X >= 46) & (cv.X <= 55)) | ((cv.X >= 60) & (cv.X <= 68)))
        cv.allow |= lens_zone
        gold = (cv.Y >= 13) & (cv.Y <= 19) & (cv.X >= 44) & (cv.X <= 66)
        gold &= (sp.grid[..., 0] > 140) & (sp.grid[..., 1] > 100) & (sp.grid[..., 2] < 130)
        cv.allow |= gold
        cv.flat(gold, PUR)
        cv.flat(lens_zone, hx('#15151f'))
        cv.flat((cv.Y == 9) & (cv.X >= 56) & (cv.X <= 59), GOLD)
        bandeau = rows(cv, 40, 46) & cols(cv, (48, 70))
        cv.ramp(bandeau, TEAL, TEAL_L, TEAL_S)
        cv.flat(rows(cv, 45, 46) & cols(cv, (56, 62)) & bandeau, GOLD)
        ring = (np.abs(cv.X - 59) <= 1) & (np.abs(cv.Y - 43) <= 1) & ~((cv.X == 59) & (cv.Y == 43))
        cv.flat(ring, GOLD)
        skin = rows(cv, 47, 70) & cols(cv, (49, 69))
        cv.ramp(skin, PUR, PUR_L, PUR_S)
        arms = rows(cv, 36, 72) & cols(cv, (40, 47), (71, 78))
        cv.ramp(arms, PUR, PUR_L, PUR_S)
        coat = rows(cv, 36, 104) & cols(cv, (40, 48), (71, 79))
        coat &= ~((cv.Y >= 100) & ((cv.X * 3) % 4 == 0))
        cv.ramp(coat, WHT, WHT_L, WHT_S)
        cv.pattern(coat, WHT_S, (cv.X + cv.Y) % 11 == 0)
        belt = rows(cv, 66, 68) & cols(cv, (48, 70))
        cv.ramp(belt, hx('#7a4a2a'), hx('#9a6040'), hx('#4a2a18'))
        cv.flat(rows(cv, 66, 68) & cols(cv, (56, 61)), GOLD)
        for vx, vy in ((50, 67), (53, 69), (64, 67), (67, 69)):
            cv.flat((cv.X == vx) & (np.abs(cv.Y - vy) <= 1), hx('#b8e04a'))
        skull = rows(cv, 72, 76) & cols(cv, (57, 60))
        cv.flat(skull, hx('#e8e0c8'))
        cv.flat(((cv.X == 57) | (cv.X == 60)) & (cv.Y == 73), PUR_S)
        briefs = rows(cv, 75, 80) & cols(cv, (49, 69))
        cv.ramp(briefs, TEAL, TEAL_L, TEAL_S)
        cv.line(rows(cv, 80, 80) & briefs, GOLD)
        legs = rows(cv, 81, 134) & cols(cv, (50, 58), (61, 69))
        cv.ramp(legs, PUR, PUR_L, PUR_S)
        sandal = rows(cv, 136, 146) & cols(cv, (48, 59), (60, 71))
        cv.ramp(sandal, GOLD, GOLD_L, GOLD_S)
        cv.line(rows(cv, 145, 146) & sandal, GOLD_S)
    cv.seams(LN)
    finish(cv, LN)
    return cv


# ---------------------------------------------------------------- driver
def finish(cv, ln):
    cv.despeckle()
    cv.outline(ln)


def _zeros(sp):
    return np.zeros((sp.h, sp.w), bool)


SPECS = {
    'mara': dict(collar=37, keep=lambda sp: (sp.Y >= 37) & (sp.Y <= 76) & ((sp.X <= 36) | (sp.X >= 76)) & (sp.lum < 120)),
    'rosa': dict(collar=42, keep=lambda sp: (sp.Y >= 42) & (sp.Y <= 49) & (sp.X <= 33) & (sp.lum < 150)),
    'gruk': dict(collar=30, erase=lambda sp, o: ((sp.Y < 30) & ((sp.X < 38) | (sp.X > 62)))
                 | ((sp.Y < 30) & (sp.grid[..., 0] > sp.grid[..., 1] + 8) & (sp.lum < 130))),
    'orrin': dict(collar=36),
    'bram': dict(collar=36, keep=lambda sp: (sp.Y >= 26) & (sp.Y <= 86) & (sp.lum > 140) & (sp.X >= 34) & (sp.X <= 70),
                 erase=lambda sp, o: (sp.X >= 84) | ((o == 'sleep') & (((sp.Y <= 18) & (sp.X >= 30) & (sp.X <= 78)) |
                                                                     ((sp.Y <= 35) & ((sp.X <= 39) | (sp.X >= 70)))))),
    'veyra': dict(collar=31, silh_to=0, keep=lambda sp: (sp.Y >= 31) & (sp.Y <= 60) & (sp.grid[..., 2] > sp.grid[..., 0] + 10) & (sp.lum < 90) &
                  (((sp.X >= 36) & (sp.X <= 39)) | ((sp.X >= 73) & (sp.X <= 80))),
                  erase=lambda sp, o: (sp.Y <= 34) & (sp.X <= 36)),
}
PAINTERS = {'mara': mara, 'rosa': rosa, 'gruk': gruk, 'orrin': orrin, 'bram': bram, 'veyra': veyra}


def build(cid, outfit):
    sp = Sprite(cid)
    s = SPECS[cid]
    keep = s['keep'](sp) if 'keep' in s else _zeros(sp)
    cv = Canvas(sp, s['collar'], keep, _zeros(sp), s.get('silh_to', 80))
    erase = s['erase'](sp, outfit) if 'erase' in s else _zeros(sp)
    PAINTERS[cid](cv, outfit, sp)
    return cv.compose(erase)


def main(argv):
    for cid in argv or IDS:
        for outfit in ('sleep', 'swim'):
            build(cid, outfit).save(os.path.join(ROOT, f'{cid}_{outfit}.jpg'), quality=95, subsampling=0)
            print(cid, outfit, 'saved')


if __name__ == '__main__':
    main(sys.argv[1:])
