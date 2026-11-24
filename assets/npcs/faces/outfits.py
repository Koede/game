"""Sleepwear and swimwear sprites for the tavern regulars, built WITHOUT touching anyone's face.

The generator (Figma image tool, gpt-image-2.5-flare, assets/npcs/faces/gen/<id>_<outfit>.png, 960x1280) only supplies a BODY in the new
outfit. The head (face, hair, hat/hood, ears, beard) is the original sprite's (assets/npcs/<id>.jpg), pasted by its SILHOUETTE (the original's
own alpha, never a rectangle), so there is zero face drift; `verify` asserts every face pixel is identical.

  python assets/npcs/faces/outfits.py [id ...]   builds assets/npcs/<id>_sleep.jpg and <id>_swim.jpg and checks drift
  node scripts/npc-art.mjs                       then regenerates src/render/npcs/artManifest.ts

Steps per outfit: (1) key both images to alpha masks (flood fill from the border, like src/render/npcs/art.ts cutOut); (2) erase the
generated body's own head: everything above its chin line, hair, hat and all (a window around the head only, for people whose shoulders rise
beside the jaw, and for Orrin's parasol); (3) scale the body so ITS head (top of head to chin) is as big as the original's and put chin on chin,
centre on centre (the figure may end taller or shorter than the day sprite); (4) lay the original silhouette (down to a cut line 6 px under
the chin, limited to a head polygon so shoulders and props stay out) over it; (5) blend the last 3 rows above the cut into the body's neck so
no seam shows; (6) flat background colour of the original, like the other sprites.
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GEN = os.path.join(HERE, 'gen')
TOL = 54
CUT = 6  # rows under the chin where the original head ends
RING = 5  # rows above the cut that fade into the body

# Per character, original sprite coordinates: top of head/hat, chin line, chin centre x, head polygon (silhouette = polygon AND alpha).
# 'gen': per outfit, in the generated body (960x1280): chin line, optionally the head's top (when a parasol covers it), and for people whose
# shoulders rise beside the jaw 'keep' (rows above the chin from which the sides stay) and 'hw' (half width of the erased head window).
CFG = {
    'mara': dict(top=33, chin=272, cx=452, head=[(232, 25), (668, 25), (668, 215), (582, 215), (582, 278), (325, 278), (325, 215), (232, 215)],
                 gen={'sleep': dict(chin=225), 'swim': dict(chin=225)}),
    'rosa': dict(gen_hair_rows=60, top=42, chin=280, cx=470, head=[(240, 30), (640, 30), (640, 262), (545, 262), (545, 286), (400, 286), (400, 262), (240, 262)],
                 hair=([[(240, 262), (410, 262), (410, 345), (240, 345)]], 'auburn'),
                 gen={'sleep': dict(chin=235), 'swim': dict(chin=238)}),
    'gruk': dict(top=13, chin=255, cx=500, head=[(405, 5), (565, 5), (565, 125), (597, 125), (597, 235), (575, 261), (430, 261), (405, 235)], nobrown=100,
                 gen={'sleep': dict(chin=297, keep=70, hw=95), 'swim': dict(chin=288, keep=70, hw=95)}),
    'orrin': dict(top=59, chin=273, cx=470, head=[(330, 50), (595, 50), (595, 279), (330, 279)],
                  gen={'sleep': dict(chin=262), 'swim': dict(chin=355, top=178, keep=90, hw=125, kstart=95)}),
    'bram': dict(top=66, chin=262, cx=440, head=[(250, 60), (545, 60), (545, 268), (250, 268)], beard=(360, 268, 540, 700),
                 gen={'sleep': dict(chin=185), 'swim': dict(chin=182)}),
    'veyra': dict(top=25, chin=178, cx=500, head=[(345, 15), (655, 15), (655, 184), (345, 184)],
                  hair=([[(330, 184), (440, 184), (440, 330), (330, 330)], [(560, 184), (670, 184), (670, 330), (560, 330)]], 'navy'),
                  gen={'sleep': dict(chin=176), 'swim': dict(chin=173)}),
}


def fg_mask(a, pocket=600):
    """Boolean foreground: not connected-to-border background (flood fill from the border, colour near the corner median)."""
    from scipy import ndimage

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
    lab, n = ndimage.label((np.abs(a - bg).sum(axis=2) < 30) & ~seen)
    if n:
        area = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        for i in np.where(area > pocket)[0]:
            seen |= lab == i + 1
    return ~seen, tuple(int(v) for v in bg)


def poly_mask(size, polys):
    m = Image.new('L', size, 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon(p, fill=255)
    return np.array(m) > 0


def head_silhouette(c, orig, ofg):
    """Boolean mask of the original's head: its own alpha inside the head polygon (plus Bram's beard, which hangs over the chest)."""
    H, W, _ = orig.shape
    keep = ofg & poly_mask((W, H), [c['head']])
    keep[round(c['chin'] + CUT):] = False
    if 'nobrown' in c:  # Gruk: the hammer handle and vest straps beside the jaw are wood and leather, not head
        o = orig.astype(int)
        brown = (o[..., 0] > o[..., 1] + 8) & (o[..., 0] > o[..., 2] + 8)
        dx = np.abs(np.arange(W)[None, :] - c['cx'])
        rows = np.arange(H)[:, None]
        keep &= ~(brown & (((dx > 85) & (rows >= c['nobrown'])) | ((dx > 40) & (rows >= 212))))
    if 'hair' in c:  # hair that hangs past the cut line stays from the original (roots over the shoulders), picked by colour
        o = orig.astype(int)
        r, g, b = o[..., 0], o[..., 1], o[..., 2]
        test = {'auburn': (r >= 130) & (g >= 60) & (g <= 140) & (b < 100) & (r - b > 70), 'navy': (np.maximum(np.maximum(r, g), b) < 150) & (((b >= r + 8) & (g <= b - 10)) | (np.maximum(np.maximum(r, g), b) < 40))}[c['hair'][1]]
        keep |= ofg & test & poly_mask((W, H), c['hair'][0])
    if 'beard' in c:  # grey pixels connected to the head, so no robe comes along
        from scipy import ndimage

        x0, y0, x1, y1 = c['beard']
        o = orig.astype(int)
        sat = o.max(2) - o.min(2)
        lum = o.mean(2)
        m = np.zeros((H, W), bool)
        m[y0:y1, x0:x1] = ((sat < 26) & (lum > 110) & (lum < 235))[y0:y1, x0:x1]
        lab, _ = ndimage.label(m)
        keep |= ndimage.binary_dilation(ndimage.binary_closing(lab == lab[y0 + 80, (x0 + x1) // 2], iterations=2), iterations=1) & ofg
    return keep


def place(dst, src, ox, oy):
    """Copies src into dst with its top-left corner at (ox, oy), clipped to dst (the offsets can be negative)."""
    h, w = src.shape[:2]
    X0, Y0 = max(ox, 0), max(oy, 0)
    X1, Y1 = min(ox + w, dst.shape[1]), min(oy + h, dst.shape[0])
    if X1 > X0 and Y1 > Y0:
        dst[Y0:Y1, X0:X1] = src[Y0 - oy:Y1 - oy, X0 - ox:X1 - ox]


def tone_match(gen, gfg, orig, ofg, c, chin_g, s, cx_g):
    """Shifts the generated body's skin colours (pixels near the skin tone of its own chin) by the difference to the original's chin skin."""
    ry, rx = slice(c['chin'] - 40, c['chin'] - 4), slice(c['cx'] - 30, c['cx'] + 30)
    # the original's chin and cheek skin, from the lower face
    sk_o = np.median(orig[ry, rx].reshape(-1, 3), axis=0)
    gy, gx = slice(int(chin_g - 40 / s), int(chin_g - 4 / s)), slice(int(cx_g - 30 / s), int(cx_g + 30 / s))
    sk_g = np.median(gen[gy, gx].reshape(-1, 3), axis=0)
    delta = sk_o - sk_g
    d = np.linalg.norm(gen.astype(float) - sk_g, axis=2)
    w = np.clip(1 - d / 70.0, 0, 1)[..., None]
    out = np.clip(gen.astype(float) + delta * w, 0, 255)
    return out.round().astype(np.uint8)


def build(cid, outfit):
    orig = np.array(Image.open(os.path.join(ROOT, f'{cid}.jpg')).convert('RGB'))
    H, W, _ = orig.shape
    ofg, bg = fg_mask(orig.astype(int), 80)
    gen = np.array(Image.open(os.path.join(GEN, f'{cid}_{outfit}.png')).convert('RGB'))
    gfg, _ = fg_mask(gen.astype(int))
    c = CFG[cid]
    g = c['gen'][outfit]
    chin_g = g['chin']
    # the head's top in the generated body: the first rows round the face column (or given when a parasol covers it)
    gcx0 = 480
    col = gfg[:chin_g, gcx0 - 100:gcx0 + 100]
    top_g = g.get('top', int(np.where(col.any(axis=1))[0][0]))
    band = gfg[chin_g - 50:chin_g - 10, gcx0 - 140:gcx0 + 140]
    cx_g = float(np.median(np.where(band)[1])) + gcx0 - 140
    s = (c['chin'] - c['top']) / (chin_g - top_g)
    cut_g = chin_g + CUT / s
    # the generated body's skin takes on the original face's skin tone, so neck, chest and arms match the pasted head
    body_rgb = tone_match(gen, gfg, orig, ofg, c, chin_g, s, cx_g)
    # (2) erase the generated head
    galpha = gfg.copy()
    if 'keep' in g:
        k0 = g.get('kstart', chin_g - g['keep'])
        galpha[:k0] = False
        galpha[k0:int(cut_g - RING / s) - 1, int(cx_g - g['hw']):int(cx_g + g['hw'])] = False
    else:
        galpha[: int(round(cut_g - RING / s)) - 1] = False
    if c.get('gen_hair_rows'):  # loose strands of the generated hair lying on the shoulders would float without their head: drop them
        gy = np.arange(gen.shape[0])[:, None]
        gi = gen.astype(int)
        hairy = (gi[..., 0] >= 110) & (gi[..., 1] >= 62) & (gi[..., 1] <= 130) & (gi[..., 0] - gi[..., 1] < 105) & (gi[..., 2] < 80) & (gi[..., 0] - gi[..., 2] > 60)
        galpha &= ~(hairy & (gy < cut_g + c['gen_hair_rows']))
    body = Image.fromarray(np.dstack([body_rgb, (galpha * 255).astype(np.uint8)]), 'RGBA')
    nw, nh = round(gen.shape[1] * s), round(gen.shape[0] * s)
    body = body.resize((nw, nh), Image.LANCZOS)
    bx, by = round(c['cx'] - cx_g * s), round(c['chin'] - chin_g * s)
    # (4) the silhouette of the original head, down to the cut line (Bram's beard continues below it)
    sil = head_silhouette(c, orig, ofg)
    ba = np.array(body)[..., 3] > 8
    bys, bxs = np.where(ba)
    hys, hxs = np.where(sil)
    x0 = min(bx + bxs.min(), hxs.min()) - 8
    y0 = min(by + bys.min(), hys.min()) - 8
    x1 = max(bx + bxs.max(), hxs.max()) + 9
    y1 = max(by + bys.max(), hys.max()) + 9
    CW, CH = x1 - x0, y1 - y0
    canvas = Image.new('RGBA', (CW, CH), bg + (255,))
    canvas.paste(body, (bx - x0, by - y0), body)
    out = np.array(canvas.convert('RGB')).astype(float)
    la = Image.new('L', (CW, CH), 0)
    la.paste(body.getchannel('A'), (bx - x0, by - y0))
    bodyA = np.array(la) > 8
    alpha = np.zeros((CH, CW))
    place(alpha, sil.astype(float), -x0, -y0)
    # (5) the last RING rows above the cut fade into the body underneath
    cut = round(c['chin'] + CUT) - y0
    if 'beard' not in c:
        for i in range(RING):
            r = cut - 1 - i
            w = 1.0 - (i + 1) / (RING + 1)  # how much of the body shows: 0.83 just above the cut, 0.17 five rows up
            alpha[r] = np.where(bodyA[r], alpha[r] * (1 - w), alpha[r])
    padded = np.zeros((CH, CW, 3))
    place(padded, orig.astype(float), -x0, -y0)
    res = (padded * alpha[..., None] + out * (1 - alpha[..., None])).round().astype(np.uint8)
    full = alpha >= 1.0
    return res, full, padded.astype(np.uint8), s, (CH, CW), round(c['chin']) - y0


def verify(cid, outfit, res, full, padded, chin):
    """Every face pixel (the silhouette down to the chin) is the original's, bit for bit; the saved JPEG stays within encoder noise."""
    face = full.copy()
    face[chin:] = False
    assert face.sum() > 5000, f'{cid} {outfit}: no face'
    assert np.array_equal(res[face], padded[face]), f'{cid} {outfit}: face pixels drifted'
    disk = np.array(Image.open(os.path.join(ROOT, f'{cid}_{outfit}.jpg')).convert('RGB')).astype(int)
    d = np.abs(disk[face] - padded[face].astype(int))
    assert d.mean() < 2.5, f'{cid} {outfit}: face differs after JPEG encode ({d.mean():.2f})'


def main(ids):
    for cid in ids:
        for outfit in ('sleep', 'swim'):
            if not os.path.exists(os.path.join(GEN, f'{cid}_{outfit}.png')):
                continue
            res, full, padded, s, size, chin = build(cid, outfit)
            Image.fromarray(res).save(os.path.join(ROOT, f'{cid}_{outfit}.jpg'), quality=95, subsampling=0)
            verify(cid, outfit, res, full, padded, chin)
            print(cid, outfit, 'body scale %.3f' % s, 'canvas', size, 'ok, face pixels identical')


if __name__ == '__main__':
    main(sys.argv[1:] or list(CFG))
