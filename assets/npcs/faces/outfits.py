"""Sleepwear and swimwear sprites for the tavern regulars, built WITHOUT touching anyone's face.

The generator (Figma image tool, gpt-image-2.5-flare, assets/npcs/faces/gen/<id>_<outfit>.png, 960x1280) only supplies a BODY in the new
outfit. Everything above the neck line -- face, hair, ears, hat/hood, goggles, glasses -- is the original sprite (assets/npcs/<id>.jpg)
pasted back unchanged, so there is zero face drift. `verify` asserts that the pasted head region is pixel-identical to the original.
For Bram the beard (which hangs over the chest) is pasted too.

  python assets/npcs/faces/outfits.py            builds assets/npcs/<id>_sleep.jpg and <id>_swim.jpg, checks drift, writes a preview sheet
  node scripts/npc-art.mjs                       then regenerates src/render/npcs/artManifest.ts

How a body is fitted: its figure is keyed out of the grey (flood fill from the border, like src/render/npcs/art.ts cutOut), rows above its own
neck line (GEN_CUT) are dropped, and the rest is scaled uniformly so that neck line lands on the original's neck line (CUT) and the feet land
on the original's feet; centred on the neck. Then the original head is laid on top, (the neck line is a straight cut across the neck, hidden by the collar/skin of the new body).
The in-game cut-out keys the same plain grey, so the background is the original's corner colour.
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GEN = os.path.join(HERE, 'gen')
TOL = 54

# Per character: CUT = original neck line (px, original sprite coords), HEAD = polygon of the original that is kept (face, hair, hat),
# EXTRA = further original polygons kept on top (Bram's beard), GEN_CUT = neck line in each generated body, DX = fine horizontal nudge.
CFG = {
    'mara': dict(cut=292, head=[(232, 25), (668, 25), (668, 215), (582, 215), (582, 292), (325, 292), (325, 215), (232, 215)],
                 gen_cut={'sleep': 252, 'swim': 252}),
    'rosa': dict(cut=300, head=[(240, 30), (640, 30), (640, 300), (240, 300)],
                 gen_cut={'sleep': 264, 'swim': 268}),
    'gruk': dict(cut=268, head=[(415, 5), (583, 5), (583, 232), (565, 268), (440, 268), (415, 232)], top={'sleep': 222, 'swim': 222}, hw=88,
                 gen_cut={'sleep': 322, 'swim': 322}),
    'orrin': dict(cut=292, head=[(330, 50), (595, 50), (595, 256), (530, 256), (530, 292), (420, 292), (420, 256), (330, 256)],
                  top={'swim': 95}, htop={'swim': 165}, hw=125, gen_cut={'sleep': 260, 'swim': 395}),
    'bram': dict(cut=300, head=[(250, 60), (545, 60), (545, 300), (250, 300)], beard=(360, 300, 540, 700),
                 gen_cut={'sleep': 268, 'swim': 300}),
    'veyra': dict(cut=205, head=[(345, 15), (655, 15), (655, 205), (345, 205)], gen_cut={'sleep': 168, 'swim': 195}),
}


def fg_mask(a):
    """Boolean foreground: not connected-to-border background (flood fill from the border, colour near the corner median)."""
    h, w, _ = a.shape
    bg = np.median(np.array([a[0, 0], a[0, w - 1], a[h - 1, 0], a[h - 1, w - 1]]), axis=0)
    near = np.abs(a - bg).sum(axis=2) < TOL
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    # enclosed pockets of background (between an arm and a parasol, say) that the border fill cannot reach: drop the big ones
    from scipy import ndimage
    lab, n = ndimage.label((np.abs(a - bg).sum(axis=2) < 30) & ~seen)
    if n:
        area = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        for i in np.where(area > 600)[0]:
            seen |= lab == i + 1
    return ~seen, tuple(int(v) for v in bg)


def poly_mask(size, polys):
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon(p, fill=255)
    return np.array(m) > 0


def build(cid, outfit):
    orig = np.array(Image.open(os.path.join(ROOT, f'{cid}.jpg')).convert('RGB'))
    H, W, _ = orig.shape
    ofg, bg = fg_mask(orig.astype(int))
    gen = np.array(Image.open(os.path.join(GEN, f'{cid}_{outfit}.png')).convert('RGB'))
    gfg, _ = fg_mask(gen.astype(int))
    c = CFG[cid]
    cut, gcut = c['cut'], c['gen_cut'][outfit]
    oy, ox = np.where(ofg)
    feet_o = oy.max()
    gy, gx = np.where(gfg)
    feet_g = gy.max()
    s = (feet_o - cut) / (feet_g - gcut)
    # centres of the neck in both images
    head = poly_mask((W, H), [c['head']])
    band = ofg & head
    ocx = np.median(np.where(band[cut - 60:cut - 20])[1])
    gband = gfg[gcut - 60:gcut - 20]
    gcx = np.median(np.where(gband)[1]) if gband.any() else gx.mean()
    # body: rows from gcut down, scaled
    # rows above the neck line are dropped; with TOP/HW only the generated head column (+-HW) goes, so high collars and shoulders stay
    top = c.get('top', {}).get(outfit, gcut)
    hw = c.get('hw', 0)
    galpha = gfg.copy()
    galpha[:top] = False
    if top < gcut:
        htop = c.get('htop', {}).get(outfit, top)
        galpha[htop:gcut, int(gcx - hw):int(gcx + hw)] = False
    body = Image.fromarray(np.dstack([gen, (galpha * 255).astype(np.uint8)]), 'RGBA').crop((0, top, gen.shape[1], feet_g + 2))
    nw, nh = round(body.width * s), round(body.height * s)
    body = body.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), bg + (255,))
    px = round(ocx - gcx * s)
    canvas.paste(body, (px, cut + round((top - gcut) * s)), body)
    out = np.array(canvas.convert('RGB'))
    keep = ofg & head
    if 'beard' in c:  # Bram's beard hangs over the chest: keep the grey pixels connected to the head, so no robe comes along
        from scipy import ndimage
        x0, y0, x1, y1 = c['beard']
        sat = orig.astype(int).max(2) - orig.astype(int).min(2)
        lum = orig.astype(int).mean(2)
        m = np.zeros((H, W), bool)
        m[y0:y1, x0:x1] = ((sat < 26) & (lum > 110) & (lum < 235))[y0:y1, x0:x1]
        lab, _ = ndimage.label(m)
        beard = ndimage.binary_dilation(ndimage.binary_closing(lab == lab[y0 + 80, (x0 + x1) // 2], iterations=2), iterations=2) & ofg
        keep |= beard
    # one pixel of dilation carries the anti-aliased outline; everything kept is the original's own pixels (hard, pixel-identical edge)
    keepi = np.array(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    if 'beard' not in c:
        keepi &= poly_mask((W, H), [c['head']])
    if top < gcut:
        # the generated head column was cut out wider than the original head: close the gap beside it from the surrounding body
        import cv2
        gap = np.zeros((H, W), np.uint8)
        x0, x1 = int(px + (gcx - hw) * s), int(px + (gcx + hw) * s)
        y0 = cut + round((htop - gcut) * s)
        gap[max(y0, 0):cut + 2, max(x0, 0):x1] = 1
        covered = np.array(canvas)[..., :3]
        bgm = (np.abs(covered.astype(int) - np.array(bg)).sum(axis=2) < 12)
        gap = ((gap > 0) & bgm & ~keepi).astype(np.uint8) * 255
        gap = cv2.dilate(gap, np.ones((3, 3), np.uint8))
        out = cv2.inpaint(out.astype(np.uint8), gap, 7, cv2.INPAINT_TELEA)
    # nothing may stand above the original's head (a parasol, a hat brim): the in-game cut-out scales by figure height, so the figure
    # must be exactly as tall as the original sprite
    out[:oy.min()][~keepi[:oy.min()]] = bg
    out = np.where(keepi[..., None], orig, out).astype(np.uint8)
    return out, keepi, orig, (s, px, cut)


def save_jpg(arr, path):
    Image.fromarray(arr).save(path, quality=95, subsampling=0)


def verify(cid, outfit, out, keepi, orig):
    """The kept region of the saved sprite must equal the original (JPEG round trip aside, so compare the arrays before saving)."""
    assert np.array_equal(out[keepi], orig[keepi]), f'{cid} {outfit}: head pixels drifted'
    # and once more from the JPEG on disk: the paste is the original JPEG's pixels; re-encoding may shift them by a few levels at most
    disk = np.array(Image.open(os.path.join(ROOT, f'{cid}_{outfit}.jpg')).convert('RGB')).astype(int)
    d = np.abs(disk[keepi] - orig[keepi].astype(int))
    assert d.mean() < 2.5, f'{cid} {outfit}: head differs after JPEG encode ({d.mean():.2f})'


def main(ids):
    sheet = []
    for cid in ids:
        row = []
        for outfit in ('sleep', 'swim'):
            if not os.path.exists(os.path.join(GEN, f'{cid}_{outfit}.png')):
                continue
            out, keepi, orig, info = build(cid, outfit)
            save_jpg(out, os.path.join(ROOT, f'{cid}_{outfit}.jpg'))
            verify(cid, outfit, out, keepi, orig)
            print(cid, outfit, 'scale %.3f' % info[0], 'ok, head pixels identical')
            row.append(Image.fromarray(out).resize((out.shape[1] // 3, out.shape[0] // 3)))
        sheet.append((cid, row))
    base = Image.new('RGB', (900 * len(sheet), 400), (255, 255, 255))
    for i, (cid, row) in enumerate(sheet):
        o = Image.open(os.path.join(ROOT, f'{cid}.jpg')).convert('RGB').resize((299, 400))
        base.paste(o, (i * 900, 0))
        for j, r in enumerate(row):
            base.paste(r, (i * 900 + 300 * (j + 1), 0))
    base.save(os.environ.get('OUTFIT_SHEET', os.path.join(HERE, 'gen', 'sheet.png')))


if __name__ == '__main__':
    main(sys.argv[1:] or list(CFG))
