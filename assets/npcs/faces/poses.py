"""Dance poses: each dancer's blueprint body with a limb (and whatever it holds) cut along a hand-placed outline and swung about its joint.
Uncovered body is refilled from the same row's nearest body pixel towards the middle (cloth behind an arm continues), anything off the body
becomes background. Output: assets/npcs/<id>_dance.png, a transparent atlas of FRAMES cells (frame 0 = standing), all cells one size with the
feet on the bottom edge; the body (blueprint rows BODY_TOP..BODY_BOTTOM) fills BODY_FRAC of the cell height (src/render/npcs/art.ts)."""
import os
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = 5
PAD_TOP, PAD_SIDE = 160, 120          # room for raised arms
CELL_H = 216                          # output cell height (px)
# body centre line and half-width of the torso (behind an arm, the torso is refilled from its mirror image across the centre)
BODY = {'mara': (440, 120), 'rosa': (448, 78), 'orrin': (448, 112), 'bram': (448, 230)}
# how the gap a part leaves is filled: 'mirror' (torso, from the other side), 'row' (nearest body pixel along the row), 'bg' (background)
FILL = {'larm': 'down', 'skirt': 'bg', 'lbraid': 'bg', 'rbraid': 'bg', 'pony': 'row', 'fore': 'row', 'staff': 'row', 'lleg': 'bg', 'rleg': 'bg', 'mug': 'mirror', 'free': 'mirror', 'wrench': 'mirror', 'purse': 'mirror', 'foot': 'bg'}

# part: (outline points, pivot) in blueprint pixels
PARTS = {
    'mara': {
        'staff': ([(398, 330), (488, 330), (488, 480), (482, 480), (482, 1175), (452, 1175), (452, 480), (398, 480)], (442, 450)),
        'larm': ([(298, 438), (440, 424), (444, 496), (298, 508)], (312, 470)),
        'skirt': ([(360, 560), (545, 560), (600, 620), (662, 700), (662, 742), (238, 742), (238, 700), (300, 620)], (448, 560)),
        'lbraid': ([(212, 330), (298, 330), (298, 614), (212, 614)], (262, 334)),
        'rbraid': ([(602, 330), (688, 330), (688, 614), (602, 614)], (636, 334)),
        'lleg': ([(338, 715), (432, 715), (430, 1180), (338, 1180)], (385, 715)),
        'rleg': ([(484, 715), (548, 715), (548, 1180), (484, 1180)], (515, 715)),
    },
    'rosa': {
        'mug': ([(520, 395), (570, 395), (598, 378), (598, 348), (724, 348), (724, 500), (600, 500), (580, 528), (545, 528), (518, 480)], (536, 420)),
        'free': ([(298, 395), (376, 395), (386, 470), (342, 520), (320, 600), (320, 706), (256, 706), (260, 600), (288, 520), (294, 470)], (346, 420)),
        'lleg': ([(344, 866), (424, 866), (424, 1168), (342, 1168)], (385, 868)),
        'skirt': ([(330, 532), (556, 532), (600, 650), (656, 800), (662, 872), (244, 872), (250, 800), (300, 650)], (448, 532)),
        'fore': ([(288, 470), (386, 470), (344, 520), (322, 600), (322, 708), (254, 708), (258, 600), (286, 520)], (330, 482)),
        'pony': ([(248, 40), (392, 40), (384, 180), (350, 300), (334, 402), (248, 402)], (460, 105)),
        'rleg': ([(456, 866), (541, 866), (542, 1168), (454, 1168)], (498, 868)),
    },
    'orrin': {
        'wrench': ([(560, 300), (640, 300), (690, 450), (700, 560), (748, 585), (748, 645), (692, 762), (565, 842), (496, 834), (538, 760),
                    (598, 700), (580, 560), (560, 450)], (574, 345)),
        'free': ([(205, 300), (300, 300), (332, 450), (305, 560), (305, 762), (226, 762), (208, 560), (196, 450)], (298, 345)),
        'lleg': ([(296, 892), (446, 892), (446, 1182), (288, 1182)], (372, 892)),
        'rleg': ([(468, 892), (612, 892), (614, 1182), (462, 1182)], (540, 892)),
    },
    'bram': {
        'staff': ([(671, 176), (731, 176), (733, 458), (758, 463), (758, 560), (731, 565), (728, 1178), (680, 1178), (677, 565), (650, 555), (650, 465), (674, 457)], (700, 505)),
        'purse': ([(245, 570), (392, 570), (392, 756), (330, 791), (221, 791), (221, 690), (245, 640)], (310, 680)),
        'foot': ([(250, 1040), (406, 1040), (406, 1178), (250, 1178)], (330, 1040)),
    },
}

# pose: list of (part, degrees counter-clockwise, dx, dy) applied in order
POSES = {
    'mara': [(0, []),
             (1, [('skirt', 'shear', 0.14), ('lbraid', -6, 0, 0), ('rbraid', -6, 0, 0)]),
             (2, [('skirt', 'shear', -0.14), ('lbraid', 6, 0, 0), ('rbraid', 6, 0, 0), ('lleg', -30, 0, -8)]),
             (1, [('skirt', 'shear', 0.1), ('lbraid', -5, 0, 0), ('rbraid', -5, 0, 0), ('rleg', 30, 0, -8)]),
             (2, [('skirt', 'shear', -0.1), ('lbraid', 5, 0, 0), ('rbraid', 5, 0, 0), ('lleg', -12, 0, -14)])],
    'rosa': [(0, []),
             (1, [('skirt', 'shear', 0.12), ('pony', -6, 0, 0), ('free', -85, 0, 0), ('mug', 26, 0, -10)]),
             (2, [('skirt', 'shear', -0.12), ('pony', 6, 0, 0), ('mug', 26, 0, -10), ('free', -50, 0, 0)]),
             (1, [('skirt', 'shear', 0.1), ('pony', -5, 0, 0), ('lleg', -22, 0, -4), ('free', -35, 0, 0)]),
             (2, [('skirt', 'shear', -0.1), ('pony', 5, 0, 0), ('rleg', 22, 0, -4), ('mug', 26, 0, -10)])],
    'orrin': [(0, []), (1, [('wrench', 115, 0, 0)]), (2, [('free', -115, 0, 0)]), (2, [('wrench', 115, 0, 0), ('free', -115, 0, 0)]),
              (1, [('lleg', -18, 0, -6), ('free', -60, 0, 0)])],
    'bram': [(0, []), (1, [('staff', 8, 0, -36)]), (2, [('staff', -5, 0, -24), ('foot', 18, 0, -24)]), (2, [('purse', 0, 6, -50)]),
             (1, [('foot', 18, 0, -24), ('purse', 0, 6, -30)])],
}


def load(id_, face=0):
    """The blueprint with the given expression (faces/<id>.py; 0 neutral, 1 happy, 2 laughing - dancers close their eyes and smile)."""
    import importlib, sys
    sys.path.insert(0, HERE)
    return importlib.import_module(id_).FACES[face]().convert('RGB')


def mask_of(size, pts):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def is_bg(px, bg):
    return abs(int(px[0]) - bg[0]) + abs(int(px[1]) - bg[1]) + abs(int(px[2]) - bg[2]) < 54


def pose(id_, spec):
    face, steps = spec
    base = load(id_, face)
    W, H = base.size
    bg = base.getpixel((2, 2))
    a = np.array(base)
    parts = PARTS[id_]
    out = a.copy()
    layers = []
    # cut every moving part out, refill behind it
    for step in steps:
        name = step[0]
        pts, pivot = parts[name]
        m = np.array(mask_of((W, H), pts)) > 0
        piece = np.dstack([a, (m * 255).astype(np.uint8)])
        layers.append((Image.fromarray(piece, 'RGBA'), pivot, step[1:]))
    allm = np.zeros((H, W), bool)
    for step in steps:
        name = step[0]
        allm |= np.array(mask_of((W, H), parts[name][0])) > 0
    mid, half = BODY[id_]
    for step in steps:
        name = step[0]
        m = np.array(mask_of((W, H), parts[name][0])) > 0
        mode = FILL[name]
        ys, xs = np.where(m)
        for y, x in zip(ys, xs):
            src = None
            toward = 1 if x < mid else -1
            if mode == 'mirror' and abs(x - mid) < half:
                mx = int(2 * mid - x)
                if 0 <= mx < W and not allm[y, mx]:
                    src = a[y, mx]
            if mode == 'down':
                yy = y + 1
                while yy < H and allm[yy, x]:
                    yy += 1
                if yy < H:
                    src = a[yy, x]
            if src is None and mode in ('mirror', 'row'):
                # the part sits in front of cloth when the cloth shows on its far side: carry that cloth across; else it hung in the open
                xx = x - toward
                while 0 <= xx < W and allm[y, xx]:
                    xx -= toward
                if 0 <= xx < W and not is_bg(a[y, xx], bg):
                    src = a[y, xx]
                elif mode == 'row':
                    xx = x + toward
                    while 0 <= xx < W and allm[y, xx]:
                        xx += toward
                    if 0 <= xx < W:
                        src = a[y, xx]
            out[y, x] = bg if src is None or is_bg(src, bg) else src
    img = Image.fromarray(out).convert('RGBA')
    for piece, (px, py), mv in layers:
        if mv[0] == 'shear':
            k = mv[1]  # the hem swings: x shifts by k per pixel below the waist
            rot = piece.transform(piece.size, Image.AFFINE, (1, -k, k * py, 0, 1, 0), resample=Image.NEAREST)
        else:
            deg, dx, dy = mv
            rot = piece.rotate(deg, resample=Image.NEAREST, center=(px, py), translate=(dx, dy))
        img.alpha_composite(rot)
    return img, bg


def key_out(img, bg):
    """Background to transparent: every pixel close to the corner colour and connected to the edge (like cutOut in art.ts)."""
    a = np.array(img)
    rgb = a[:, :, :3].astype(int)
    near = (np.abs(rgb - np.array(bg)).sum(axis=2) < 54) | (a[:, :, 3] == 0)
    from scipy import ndimage
    lab, _ = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    a[np.isin(lab, list(edge)), 3] = 0
    return Image.fromarray(a)


def frames(id_):
    out = []
    for spec in POSES[id_]:
        img, bg = pose(id_, spec)
        padded = Image.new('RGBA', (img.width + 2 * PAD_SIDE, img.height + PAD_TOP), tuple(bg) + (255,))
        padded.paste(img, (PAD_SIDE, PAD_TOP), img)
        out.append(key_out(padded, bg))
    return out


def body_rows(img):
    al = np.array(img)[:, :, 3] > 8
    ys = np.where(al.any(axis=1))[0]
    return ys[0], ys[-1]


def build(id_):
    fr = frames(id_)
    top0, bot0 = body_rows(fr[0])
    tops = [body_rows(f)[0] for f in fr]
    top = min(tops)
    bottom = bot0 + 1
    k = CELL_H / (bottom - top)
    cells = [f.crop((0, top, f.width, bottom)) for f in fr]
    cw = int(round(cells[0].width * k))
    atlas = Image.new('RGBA', (cw * FRAMES, CELL_H), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        atlas.alpha_composite(c.resize((cw, CELL_H), Image.LANCZOS), (i * cw, 0))
    atlas.save(os.path.join(HERE, '..', f'{id_}_dance.png'), optimize=True)
    return atlas, (bot0 + 1 - top0) / (bottom - top)


if __name__ == '__main__':
    for id_ in POSES:
        atlas, frac = build(id_)
        print(id_, atlas.size, 'body fraction', round(frac, 3))


def cut_away(id_, face, names):
    """The blueprint (with a face) with the named parts removed and their gap refilled, and the removed parts on their own (both RGBA)."""
    base = load(id_, face)
    W, H = base.size
    bg = base.getpixel((2, 2))
    a = np.array(base)
    parts = PARTS[id_]
    allm = np.zeros((H, W), bool)
    for n in names:
        allm |= np.array(mask_of((W, H), parts[n][0])) > 0
    mid, half = BODY[id_]
    out = a.copy()
    for n in names:
        m = np.array(mask_of((W, H), parts[n][0])) > 0
        mode = FILL[n]
        for y, x in zip(*np.where(m)):
            src = None
            toward = 1 if x < mid else -1
            if mode == 'mirror' and abs(x - mid) < half:
                mx = int(2 * mid - x)
                if 0 <= mx < W and not allm[y, mx]:
                    src = a[y, mx]
            if src is None and mode in ('mirror', 'row'):
                xx = x - toward
                while 0 <= xx < W and allm[y, xx]:
                    xx -= toward
                if 0 <= xx < W and not is_bg(a[y, xx], bg):
                    src = a[y, xx]
            out[y, x] = bg if src is None or is_bg(src, bg) else src
    body = key_out(Image.fromarray(out).convert('RGBA'), bg)
    arms = key_out(Image.fromarray(np.dstack([a, (allm * 255).astype(np.uint8)]), 'RGBA'), bg)
    return body, arms
