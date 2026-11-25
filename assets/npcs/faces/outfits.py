"""Sleepwear and swimwear sprites for the tavern regulars: whole characters (head and body drawn together, no pasted heads).

Each outfit is one generated image (Figma image tool, gpt-image-2.5-flare, 960x1280) in assets/npcs/faces/whole/<id>_<outfit>.png, prompted
with a detailed description of the character's face, hair, skin, eyes and build taken from the day sprite (assets/npcs/<id>.jpg, README) and
the same front-view standing pose on plain light grey; Veyra's swim sprite is the owner's approved concept. Faces drift a little from the day
sprites (accepted by the owner); the day sprites and the faces strips are not touched.

This script only flattens each image onto the plain grey of the other sprites (any transparency onto grey 216; a near-grey background is
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


def main(ids):
    for cid in ids:
        for outfit in ('sleep', 'swim'):
            src = os.path.join(SRC, f'{cid}_{outfit}.png')
            if not os.path.exists(src):
                continue
            Image.fromarray(flatten(src)).save(os.path.join(ROOT, f'{cid}_{outfit}.jpg'), quality=95, subsampling=0)
            print(cid, outfit, 'saved')


if __name__ == '__main__':
    main(sys.argv[1:] or IDS)
