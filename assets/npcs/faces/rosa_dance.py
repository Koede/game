"""Rosa's dance, drawn at her in-game size (77 x 96 px) frame by frame: 30 frames at 15 fps, the moves copied from the reference clip
(hands to chest and bounce, a kick back, hand to cheek with the mug arm out and a knee up, hands on hips with a hip sway, fist up).

The base is her blueprint at sprite size with both arms taken off (poses.cut_away). Her puffed sleeves and her mug are her own pixels, copied
back at the shoulders and into her right hand. The forearms are drawn here per pose: a 3-4 px limb with a dark outline, a light and a mid skin
tone and a shaded underside, ending in a small hand. Each frame lists its pose, its bounce (px down), its sway (px sideways) and its legs.
Output: assets/npcs/rosa_anim.png, 30 frames in a row (src/render/npcs/art.ts ANIM_FRAMES)."""
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import poses

W, H = 77, 96
SKIN = dict(J=(150, 92, 72), M=(192, 138, 110), O=(219, 170, 138), P=(234, 196, 164))


def base_parts():
    body, arms = poses.cut_away('rosa', 1, ['mug', 'free'])
    al = np.array(body)[:, :, 3] > 8
    ys = np.where(al.any(1))[0]
    top, bot = ys[0], ys[-1] + 1
    k = H / (bot - top)

    def small(img):
        c = img.crop((0, top, img.width, bot))
        return c.resize((round(c.width * k), H), Image.BOX)

    b, a = small(body), small(arms)
    full = np.array(Image.alpha_composite(b, a))
    # her own pieces, cut from the sprite-size arms: the two puffed sleeves and the mug (with the hand that holds it)
    sleeve_l = full[29:41, 22:33].copy(); sleeve_l[:, :, 3] = np.where(np.array(a)[29:41, 22:33, 3] > 100, 255, 0)
    sleeve_r = full[25:41, 43:52].copy(); sleeve_r[:, :, 3] = np.where(np.array(a)[25:41, 43:52, 3] > 100, 255, 0)
    mug = full[25:39, 52:64].copy(); mug[:, :, 3] = np.where(np.array(a)[25:39, 52:64, 3] > 100, 255, 0)
    return np.array(b), sleeve_l, sleeve_r, mug


def paste(canvas, piece, x, y):
    h, w = piece.shape[:2]
    for yy in range(h):
        for xx in range(w):
            if piece[yy, xx, 3] > 100 and 0 <= y + yy < canvas.shape[0] and 0 <= x + xx < canvas.shape[1]:
                canvas[y + yy, x + xx] = piece[yy, xx]


def forearm(canvas, x0, y0, x1, y1, width=3.0, hand=True):
    """A forearm from the elbow (x0,y0) to the hand (x1,y1): outline on the edge, light on the upper/left side, shade under, then the hand."""
    dx, dy = x1 - x0, y1 - y0
    n = max(1e-6, (dx * dx + dy * dy) ** 0.5)
    nx, ny = -dy / n, dx / n                      # across the limb
    for y in range(int(min(y0, y1) - 4), int(max(y0, y1) + 5)):
        for x in range(int(min(x0, x1) - 4), int(max(x0, x1) + 5)):
            t = ((x - x0) * dx + (y - y0) * dy) / (n * n)
            if t < 0 or t > 1:
                continue
            d = (x - x0) * nx + (y - y0) * ny       # signed distance across
            if abs(d) > width / 2 + 0.5:
                continue
            if abs(d) > width / 2 - 0.5:
                c = SKIN['J']
            elif d < -0.3:
                c = SKIN['P'] if ny < 0 or nx < 0 else SKIN['M']
            elif d > 0.3:
                c = SKIN['M'] if ny < 0 or nx < 0 else SKIN['P']
            else:
                c = SKIN['O']
            if 0 <= y < H and 0 <= x < W:
                canvas[y, x] = (*c, 255)
    if not hand:
        return
    # the hand: a small rounded block of skin with an outline
    for yy, row in enumerate(['.JJ.', 'JPOJ', 'JOMJ', '.JJ.']):
        for xx, ch in enumerate(row):
            if ch != '.':
                X, Y = int(round(x1)) - 2 + xx, int(round(y1)) - 2 + yy
                if 0 <= Y < H and 0 <= X < W:
                    canvas[Y, X] = (*SKIN[ch], 255)


import math


def limb(canvas, x0, y0, x1, y1, width=3.0):
    forearm(canvas, x0, y0, x1, y1, width, hand=False)


PUFF = dict(L=(148, 104, 92), z=(206, 180, 160), s=(232, 214, 190), S=(246, 236, 222))


def puff(canvas, sx, sy, ex, ey, length=7.0, r=3.4):
    """Her puffed sleeve, drawn: a rounded capsule from the shoulder along the upper arm, outlined, lit from the upper left."""
    d = math.hypot(ex - sx, ey - sy)
    ux, uy = (ex - sx) / d, (ey - sy) / d
    x1, y1 = sx + ux * length, sy + uy * length
    for y in range(int(min(sy, y1) - r - 1), int(max(sy, y1) + r + 2)):
        for x in range(int(min(sx, x1) - r - 1), int(max(sx, x1) + r + 2)):
            t = max(0.0, min(1.0, ((x - sx) * ux + (y - sy) * uy) / length))
            px, py = sx + ux * length * t, sy + uy * length * t
            dist = math.hypot(x - px, y - py)
            if dist > r:
                continue
            if dist > r - 1.0:
                c = PUFF['L']
            else:
                lit = ((x - px) * -0.6 + (y - py) * -0.8) / max(dist, 0.5)
                c = PUFF['S'] if lit > 0.35 else PUFF['s'] if lit > -0.35 else PUFF['z']
            if 0 <= y < H and 0 <= x < W:
                canvas[y, x] = (*c, 255)


def sleeve_at(canvas, sleeve, attach, sx, sy, ex, ey):
    """Her own puffed sleeve, turned to point from the shoulder (sx,sy) towards the elbow; attach = the sleeve's shoulder point."""
    ang = math.degrees(math.atan2(ex - sx, ey - sy))   # 0 = hanging straight down
    img = Image.fromarray(sleeve, 'RGBA')
    big = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    big.paste(img, (20 - attach[0], 20 - attach[1]), img)
    rot = np.array(big.rotate(ang, resample=Image.NEAREST, center=(20, 20)))
    paste(canvas, rot, int(sx) - 20, int(sy) - 20)


# joints per pose, by hand (sprite pixels): shoulder fixed, elbow and hand placed; the mug's top-left goes where her right hand holds it
SHOULDER_L, SHOULDER_R = (28, 31), (47, 29)
POSES = {
    'rest':  None,
    'chest': dict(L=((24, 43), (34, 38)), R=((51, 43), (43, 37)), mug=(36, 27)),
    'cheek': dict(L=((19, 37), (30, 26)), R=((57, 35), (65, 31)), mug=(62, 21)),
    'hips':  dict(L=((18, 41), (28, 47)), R=((58, 41), (49, 47)), mug=(48, 45)),
    'up':    dict(L=((21, 21), (24, 8)), R=((51, 43), (43, 37)), mug=(36, 27)),
}
SLEEVE_ATTACH_L, SLEEVE_ATTACH_R = (6, 1), (4, 3)
SLEEVE_LEN = 9

# 30 frames at 15 fps: pose, bounce (px down), sway (px right), legs ('stand', 'kick' right foot back up, 'knee' right knee up)
FRAMES = (
    [('chest', 0, 0, 'kick'), ('chest', 1, 0, 'kick'), ('chest', 1, 0, 'kick'), ('chest', 0, 0, 'stand')] +
    [('chest', b, 0, 'stand') for b in (0, 1, 2, 1, 0, 1)] +
    [('cheek', 0, 0, 'knee'), ('cheek', 1, 0, 'knee'), ('cheek', 1, 0, 'knee'), ('cheek', 0, 0, 'knee'),
     ('cheek', 0, 0, 'stand'), ('cheek', 1, 0, 'stand'), ('cheek', 1, 0, 'stand'), ('cheek', 0, 0, 'stand')] +
    [('hips', 0, s, 'stand') for s in (0, -1, -1, 0, 1, 1)] +
    [('up', 0, 0, 'stand'), ('up', 1, 0, 'stand'), ('up', 1, 0, 'stand'), ('up', 0, 0, 'stand'), ('chest', 1, 0, 'stand'), ('chest', 0, 0, 'stand')]
)


def frame(body, sleeve_l, sleeve_r, mug, spec):
    pose, bob, sway, legs = spec
    c = np.zeros((H, W, 4), np.uint8)
    b = body.copy()
    if legs != 'stand':
        leg = b[70:96, 40:49].copy()
        b[70:96, 40:49] = 0
        lift = 6 if legs == 'kick' else 8
        shift = 2 if legs == 'kick' else -1
        paste(b, leg, 40 + shift, 70 - lift)
    sh = np.zeros_like(b)
    for y in range(H):
        src = y - bob if y < 70 else y
        if 0 <= src < H:
            sh[y] = np.roll(b[src], sway, axis=0) if sway else b[src]
    c[:] = sh
    P = POSES[pose]
    if P is None:
        return c
    for side, sleeve, attach, (sx, sy) in (('L', sleeve_l, SLEEVE_ATTACH_L, SHOULDER_L), ('R', sleeve_r, SLEEVE_ATTACH_R, SHOULDER_R)):
        (ex, ey), (hx, hy) = P[side]
        sx, sy, ex, ey, hx, hy = sx + sway, sy + bob, ex + sway, ey + bob, hx + sway, hy + bob
        d = math.hypot(ex - sx, ey - sy)
        # upper arm skin shows from the end of the sleeve to the elbow
        ux, uy = sx + (ex - sx) * SLEEVE_LEN / d, sy + (ey - sy) * SLEEVE_LEN / d
        limb(c, ux, uy, ex, ey)
        forearm(c, ex, ey, hx, hy, 3.0)
        puff(c, sx, sy, ex, ey)
    mx, my = P['mug']
    paste(c, mug, mx + sway, my + bob)
    return c


def build():
    body, sl, sr, mug = base_parts()
    frames = [frame(body, sl, sr, mug, f) for f in FRAMES]
    atlas = np.concatenate(frames, axis=1)
    Image.fromarray(atlas, 'RGBA').save(os.path.join(HERE, '..', 'rosa_anim.png'), optimize=True)
    return frames


if __name__ == '__main__':
    fr = build()
    print(len(fr), 'frames')
