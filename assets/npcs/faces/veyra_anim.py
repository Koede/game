"""Veyra's dance loop, built from her full-size sprite (assets/npcs/veyra.jpg) with whole-body moves: two hops per loop, a sway at the hip,
a lean, alternate foot lifts, and the coat hem swinging. 30 frames at 15 fps, 101 x 128 each, in a row (src/render/npcs/art.ts ANIM_FRAMES).
Unlike the hand-cut loops of the others (anim.py), her arms stay with her body: the pose is the sprite's own (flask raised, hand on hip).

  python assets/npcs/faces/veyra_anim.py   then   node scripts/npc-art.mjs"""
import math
import os
from collections import deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FRAMES, FW, FH = 30, 101, 128
BODY_H = 120
S = FH / 96


def key_out(path):
    """The sprite with its plain background removed (flood fill from the border, like src/render/npcs/art.ts cutOut)."""
    im = Image.open(path).convert('RGB')
    a = np.array(im).astype(int)
    h, w, _ = a.shape
    corners = np.array([a[0, 0], a[0, w - 1], a[h - 1, 0], a[h - 1, w - 1]])
    bg = np.median(corners, axis=0)
    near = np.abs(a - bg).sum(axis=2) < 54
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
    rgba = np.dstack([a.astype(np.uint8), np.where(seen, 0, 255).astype(np.uint8)])
    out = Image.fromarray(rgba, 'RGBA')
    return out.crop(out.getbbox())


def base_sprite():
    fig = key_out(os.path.join(ROOT, 'veyra.jpg'))
    scale = BODY_H / fig.height
    fig = fig.resize((max(1, round(fig.width * scale)), BODY_H), Image.LANCZOS)
    cell = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    cell.paste(fig, ((FW - fig.width) // 2, FH - BODY_H - 1), fig)
    return cell


def frame(base, i):
    t = i / FRAMES
    a = np.array(base)
    # alternate foot lifts: the legs below the hip, left half then right half, with the coat hem swinging a little the other way
    lift = 3.0 * S * max(0.0, math.sin(2 * math.pi * 2 * t))
    lift2 = 3.0 * S * max(0.0, -math.sin(2 * math.pi * 2 * t))
    out = a.copy()
    y0 = round(66 * S)
    cx = FW // 2
    for side, amount in ((slice(0, cx), lift), (slice(cx, FW), lift2)):
        k = int(round(amount))
        if k <= 0:
            continue
        part = a[y0:FH - 1, side].copy()
        out[y0:FH, side] = 0
        out[y0 - k:FH - 1 - k, side] = np.maximum(out[y0 - k:FH - 1 - k, side], part)
    img = Image.fromarray(out, 'RGBA')
    # lean and sway about the feet: a shear that grows towards the head
    sway = 2.2 * S * math.sin(2 * math.pi * t)
    k = sway / FH
    img = img.transform((FW, FH), Image.AFFINE, (1, k, -sway * 0.5, 0, 1, 0), resample=Image.NEAREST)
    img = img.rotate(1.5 * math.sin(2 * math.pi * t + 1.0), resample=Image.NEAREST, center=(FW / 2, FH - 1))
    # two hops per loop
    hop = round(2.0 * S * abs(math.sin(2 * math.pi * t * 2)))
    shifted = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    shifted.paste(img, (0, -hop), img)
    return shifted


def main():
    base = base_sprite()
    strip = Image.new('RGBA', (FW * FRAMES, FH), (0, 0, 0, 0))
    for i in range(FRAMES):
        strip.paste(frame(base, i), (i * FW, 0))
    out = os.path.join(ROOT, 'veyra_anim.png')
    strip.save(out)
    print('wrote', out, strip.size)


if __name__ == '__main__':
    main()
