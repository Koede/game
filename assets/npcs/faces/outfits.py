"""Sleepwear and swimwear sprites for the tavern regulars: whole characters (head and body drawn together, no pasted heads).

Each outfit is one generated image (Figma image tool, gpt-image-2.5-flare, 960x1280) in assets/npcs/faces/whole/<id>_<outfit>.png, prompted
with a detailed description of the character's face, hair, skin, eyes and build taken from the day sprite (assets/npcs/<id>.jpg, README) and
the same front-view standing pose on plain light grey; Veyra's swim sprite is the owner's approved concept. Faces drift a little from the day
sprites (accepted by the owner); the day sprites and the faces strips are not touched.

Then the FACE (eyes, brows, nose, mouth, cheeks; Gruk's tusks; Veyra's glasses and fringe) of the day sprite is transplanted onto each
generated face: a soft ellipse around the day face, scaled, rotated and moved so the day sprite's eye centres land on the generated sprite's
eye centres (both hand-set below, EYES), the day face's skin tone shifted to the generated skin round the edge, and the edge feathered.
Hair, hats, ears and the head outline stay the generated sprite's, so the head stays joined to the body. Veyra's generated sleep sprite has
her fringe on the other side, so it is mirrored first (FLIP).

The script also flattens each image onto the plain grey of the other sprites (any transparency onto grey 216; a near-grey background is
evened out to exactly that grey by a flood fill from the border, like src/render/npcs/art.ts cutOut) and saves assets/npcs/<id>_<outfit>.jpg.

  python assets/npcs/faces/outfits.py [id ...]
  node scripts/npc-art.mjs
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'whole')
IDS = ['mara', 'rosa', 'gruk', 'orrin', 'bram', 'veyra']
GREY = (216, 216, 216)
TOL = 54


def flatten(path):
    im = Image.open(path).convert('RGBA')
    base = Image.new('RGBA', im.size, GREY + (255,))
    base.alpha_composite(im)
    a = np.array(base.convert('RGB')).astype(int)
    h, w, _ = a.shape
    bg = np.median(np.array([a[0, 0], a[0, w - 1], a[h - 1, 0], a[h - 1, w - 1]]), axis=0)
    near = np.abs(a - bg).sum(axis=2) < TOL
    seen = np.zeros((h, w), bool)
    q = deque((y, x) for x in range(w) for y in (0, h - 1) if near[y, x])
    q.extend((y, x) for y in range(h) for x in (0, w - 1) if near[y, x])
    for y, x in q:
        seen[y, x] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    a[seen] = GREY
    return a.astype(np.uint8)


# Eye centres (x, y): left eye then right eye as seen in the picture. Day sprites in assets/npcs/<id>.jpg pixels, outfits in the 960x1280
# generated pixels (after FLIP). Veyra's left eye is under her fringe: the centre of that glasses lens.
EYES = {
    'mara': {'day': ((418, 223), (477, 223)), 'sleep': ((437, 235), (507, 235)), 'swim': ((437, 240), (507, 240))},
    'rosa': {'day': ((412, 232), (475, 232)), 'sleep': ((432, 187), (505, 187)), 'swim': ((427, 187), (500, 187))},
    'gruk': {'day': ((433, 168), (483, 168)), 'sleep': ((450, 147), (505, 147)), 'swim': ((450, 152), (505, 152))},
    'orrin': {'day': ((417, 195), (477, 195)), 'sleep': ((437, 142), (497, 142)), 'swim': ((397, 217), (462, 217))},
    'bram': {'day': ((413, 202), (473, 202)), 'sleep': ((415, 212), (510, 212)), 'swim': ((445, 202), (515, 202))},
    'veyra': {'day': ((448, 130), (507, 128)), 'sleep': ((447, 112), (507, 112)), 'swim': ((440, 145), (500, 142))},
}
FLIP = {('veyra', 'sleep')}
# The face ellipse on the day sprite, in eye distances d from the eyes' midpoint: centre drop, half width, half height, feather.
FACE = {
    'mara': (0.3, 0.95, 0.75, 0.16), 'rosa': (0.3, 0.85, 0.78, 0.16), 'gruk': (0.55, 1.05, 1.25, 0.16),
    'orrin': (0.5, 0.95, 1.1, 0.16), 'bram': (0.45, 1.0, 1.0, 0.16), 'veyra': (0.3, 1.05, 0.72, 0.14),
}


def transplant(cid, outfit, gen):
    """The day sprite's face, eye-aligned, tone-matched and feathered, over the generated face."""
    import cv2

    day = np.array(Image.open(os.path.join(ROOT, f'{cid}.jpg')).convert('RGB')).astype(np.float32)
    (dl, dr), (gl, gr) = EYES[cid]['day'], EYES[cid][outfit]
    dl, dr, gl, gr = (np.array(p, np.float32) for p in (dl, dr, gl, gr))
    d_day = np.linalg.norm(dr - dl)
    k = np.linalg.norm(gr - gl) / d_day
    ang = np.arctan2(*(gr - gl)[::-1]) - np.arctan2(*(dr - dl)[::-1])
    c, s_ = np.cos(ang) * k, np.sin(ang) * k
    mid_d, mid_g = (dl + dr) / 2, (gl + gr) / 2
    M = np.array([[c, -s_, 0], [s_, c, 0]], np.float32)
    M[:, 2] = mid_g - M[:, :2] @ mid_d
    h, w, _ = gen.shape
    warped = cv2.warpAffine(day, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    drop, ax, ay, fe = FACE[cid]
    mask = np.zeros(day.shape[:2], np.float32)
    cv2.ellipse(mask, (int(mid_d[0]), int(mid_d[1] + drop * d_day)), (int(ax * d_day), int(ay * d_day)), 0, 0, 360, 1.0, -1)
    mask = cv2.warpAffine(mask, M, (w, h), flags=cv2.INTER_LINEAR)
    sig = fe * d_day * k
    soft = cv2.GaussianBlur(mask, (0, 0), sig)
    soft = np.clip((soft - 0.15) / 0.7, 0, 1)
    # skin tone: match the day face to the generated face in the ring where the two meet
    ring = (soft > 0.05) & (soft < 0.6)
    g = gen.astype(np.float32)
    delta = np.median(g[ring], axis=0) - np.median(warped[ring], axis=0)
    edge = np.clip(1 - soft, 0, 1)[..., None] * 0.5 + 0.5  # the whole face shifts half way, the edge all the way
    warped = np.clip(warped + delta * edge, 0, 255)
    out = g * (1 - soft[..., None]) + warped * soft[..., None]
    return out.round().astype(np.uint8)


def main(ids):
    for cid in ids:
        for outfit in ('sleep', 'swim'):
            src = os.path.join(SRC, f'{cid}_{outfit}.png')
            if not os.path.exists(src):
                continue
            flat = flatten(src)
            if (cid, outfit) in FLIP:
                flat = flat[:, ::-1].copy()
            flat = transplant(cid, outfit, flat)
            Image.fromarray(flat).save(os.path.join(ROOT, f'{cid}_{outfit}.jpg'), quality=95, subsampling=0)
            print(cid, outfit, 'saved')


if __name__ == '__main__':
    main(sys.argv[1:] or IDS)
