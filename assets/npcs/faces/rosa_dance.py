"""Rosa's dance at her in-game size (77 x 96 px): 30 frames at 15 fps, the moves copied from the reference clip (hands to chest and bounce, a
kick back, hand to cheek with the mug arm out and a knee up, hands on hips with a hip sway, fist up, back to the chest).

Every pixel is hers. Her arms are cut from her full-size art in four pieces along hand-placed outlines (each upper arm with its puffed sleeve,
each forearm with its hand) plus the mug; for a pose each upper arm turns at the shoulder, its forearm turns at the elbow and rides along, and the
mug stays upright in her right hand. The torso is her art with the arms taken off and refilled (poses.cut_away). Each pose is put together at
full size and shrunk to sprite size exactly like her body, so arms and body share one pixel grid. Frames then add the bounce, sway and leg lifts.
Output: assets/npcs/rosa_anim.png, 30 frames in a row (src/render/npcs/art.ts ANIM_FRAMES)."""
import math
import os
import sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import poses

W, H = 77, 96
FACE = 1

# her arm pieces in full-size blueprint pixels: outline, joint; and the rest direction of each segment (degrees from straight down, + to the right)
PIECES = {
    'Lua': ([(294, 392), (380, 392), (390, 470), (354, 530), (294, 530), (284, 470)], (346, 418)),
    'Lfa': ([(292, 518), (356, 518), (332, 600), (324, 710), (252, 710), (256, 600), (280, 540)], (322, 526)),
    'Rua': ([(516, 396), (574, 396), (588, 470), (586, 534), (538, 534), (520, 470)], (542, 420)),
    'Rfa': ([(550, 474), (596, 430), (614, 430), (614, 504), (588, 534), (552, 532)], (566, 516)),
    'mug': ([(614, 344), (728, 344), (728, 504), (614, 504)], None),
}
ELBOW = {'L': (322, 526), 'R': (566, 516)}
HAND = {'L': (288, 692), 'R': (606, 446)}
SHOULDER = {'L': (346, 418), 'R': (542, 420)}
REST = {k: math.degrees(math.atan2(e[0] - s[0], e[1] - s[1])) for k, s, e in (('Lua', SHOULDER['L'], ELBOW['L']), ('Rua', SHOULDER['R'], ELBOW['R']))}
REST.update({k: math.degrees(math.atan2(h[0] - e[0], h[1] - e[1])) for k, e, h in (('Lfa', ELBOW['L'], HAND['L']), ('Rfa', ELBOW['R'], HAND['R']))})
MUG_FROM_HAND = (614 - HAND['R'][0], 344 - HAND['R'][1])

# poses: direction of each segment (degrees from straight down, + to the viewer's right), copied from the reference poses
POSES = {
    'rest': None,
    'chest': dict(Lua=-15, Lfa=117, Rua=15, Rfa=-127),
    'cheek': dict(Lua=-35, Lfa=135, Rua=59, Rfa=117),
    'hips': dict(Lua=-45, Lfa=59, Rua=43, Rfa=-56),
    'up': dict(Lua=-145, Lfa=167, Rua=15, Rfa=-127),
}

# 30 frames at 15 fps: pose, bounce (px down), sway (px right), legs ('stand', 'kick' right foot back up, 'knee' right knee up)
FRAMES = (
    [('chest', 0, 0, 'kick'), ('chest', 1, 0, 'kick'), ('chest', 1, 0, 'kick'), ('chest', 0, 0, 'stand')] +
    [('chest', b, 0, 'stand') for b in (0, 1, 2, 1, 0, 1)] +
    [('cheek', 0, 0, 'knee'), ('cheek', 1, 0, 'knee'), ('cheek', 1, 0, 'knee'), ('cheek', 0, 0, 'knee'),
     ('cheek', 0, 0, 'stand'), ('cheek', 1, 0, 'stand'), ('cheek', 1, 0, 'stand'), ('cheek', 0, 0, 'stand')] +
    [('hips', 0, s, 'stand') for s in (0, -1, -1, 0, 1, 1)] +
    [('up', 0, 0, 'stand'), ('up', 1, 0, 'stand'), ('up', 1, 0, 'stand'), ('up', 0, 0, 'stand'), ('chest', 1, 0, 'stand'), ('chest', 0, 0, 'stand')]
)


def turn(v, deg):
    """Turn a screen vector (y down) by deg, positive the way PIL's rotate turns a picture (a downward vector swings to the right)."""
    r = math.radians(deg)
    return (v[0] * math.cos(r) + v[1] * math.sin(r), -v[0] * math.sin(r) + v[1] * math.cos(r))


def load_pieces():
    img = poses.load('rosa', FACE)
    Wf, Hf = img.size
    bg = img.getpixel((2, 2))
    a = np.array(img)
    out = {}
    for name, (pts, _) in PIECES.items():
        m = np.array(poses.mask_of((Wf, Hf), pts)) > 0
        if name != 'mug':
            # an arm piece keeps arm and sleeve only: the red of her skirt and bodice, and her pouch, stay on the body
            rgb = a.astype(int)
            m &= ~(((rgb[:, :, 0] - rgb[:, :, 1]) > 80) & (rgb[:, :, 2] < 90))
            m &= rgb[:, :, 1] >= 82  # her belt pouch and strap are darker than any arm pixel (skin outline included)
        piece = Image.fromarray(np.dstack([a, (m * 255).astype(np.uint8)]), 'RGBA')
        out[name] = poses.key_out(piece, bg)
    torso, _ = poses.cut_away('rosa', FACE, ['mug', 'free'])
    return torso, out


def compose(torso, pieces, pose):
    """Her full-size picture in a pose: torso, then each arm (upper arm turned at the shoulder, forearm turned at the elbow and carried), then the mug."""
    canvas = torso.copy()
    P = POSES[pose]
    if P is None:
        for k in ('Lua', 'Lfa', 'Rua', 'Rfa', 'mug'):
            canvas.alpha_composite(pieces[k])
        return canvas
    hands = {}
    for side in ('L', 'R'):
        ua, fa = side + 'ua', side + 'fa'
        su = P[ua] - REST[ua]
        sx, sy = SHOULDER[side]
        ex, ey = ELBOW[side]
        nx, ny = turn((ex - sx, ey - sy), su)
        elbow = (sx + nx, sy + ny)
        canvas.alpha_composite(pieces[ua].rotate(su, resample=Image.BICUBIC, center=(sx, sy)))
        sf = P[fa] - REST[fa]
        hx, hy = HAND[side]
        hv = turn((hx - ex, hy - ey), sf)
        hands[side] = (elbow[0] + hv[0], elbow[1] + hv[1])
        moved = pieces[fa].rotate(sf, resample=Image.BICUBIC, center=(ex, ey), translate=(elbow[0] - ex, elbow[1] - ey))
        canvas.alpha_composite(moved)
    mug = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    hx, hy = hands['R']
    mug.paste(pieces['mug'], (int(round(hx + MUG_FROM_HAND[0] - 614)), int(round(hy + MUG_FROM_HAND[1] - 344))), pieces['mug'])
    canvas.alpha_composite(mug)
    return canvas


def to_sprite(img, top, bot):
    k = H / (bot - top)
    c = img.crop((0, top, img.width, bot))
    small = c.resize((round(c.width * k), H), Image.BOX)
    a = np.array(small)
    a[:, :, 3] = np.where(a[:, :, 3] > 110, 255, 0)  # crisp edges: a pixel is in or out
    return a


def frame(pose_img, spec):
    pose, bob, sway, legs = spec
    b = pose_img.copy()
    if legs != 'stand':
        leg = b[70:96, 40:49].copy()
        b[70:96, 40:49] = 0
        lift = 6 if legs == 'kick' else 8
        shift = 2 if legs == 'kick' else -1
        for yy in range(leg.shape[0]):
            for xx in range(leg.shape[1]):
                if leg[yy, xx, 3] and 0 <= 70 - lift + yy < H:
                    b[70 - lift + yy, 40 + shift + xx] = leg[yy, xx]
    out = np.zeros_like(b)
    for y in range(H):
        src = y - bob if y < 70 else y
        if 0 <= src < H:
            out[y] = np.roll(b[src], sway, axis=0) if sway else b[src]
    return out


def build():
    torso, pieces = load_pieces()
    al = np.array(torso)[:, :, 3] > 8
    ys = np.where(al.any(1))[0]
    top, bot = ys[0], ys[-1] + 1
    posed = {p: to_sprite(compose(torso, pieces, p), top, bot) for p in POSES}
    frames = [frame(posed[f[0]], f) for f in FRAMES]
    Image.fromarray(np.concatenate(frames, axis=1), 'RGBA').save(os.path.join(HERE, '..', 'rosa_anim.png'), optimize=True)
    return frames


if __name__ == '__main__':
    print(len(build()), 'frames')
