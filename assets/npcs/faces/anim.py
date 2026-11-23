"""Dance loops at in-game size: 30 frames at 15 fps per dancer, the moves copied from the reference clip, every pixel the dancer's own.

Each dancer's arms (and props) are cut from their full-size art along hand-placed outlines below. A pose turns each piece at its joint: an upper
arm at the shoulder, a forearm at the elbow (riding on its upper arm), a free piece (Bram's staff, his purse, Mara's braids) at its own joint and
optionally slides it. Props that must stay upright (Rosa's mug) follow a hand without turning. The torso is the art with the moving pieces taken
off and refilled (poses.cut_away). Each pose is built at full size and shrunk to sprite size like the body, so everything shares one pixel grid;
frames then add the bounce, sway and leg lifts. Output: assets/npcs/<id>_anim.png, 30 frames in a row (src/render/npcs/art.ts ANIM_FRAMES).

  python assets/npcs/faces/anim.py [ids...]   then   node scripts/npc-art.mjs"""
import math
import os
import sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import poses

H = 96
FACE = 1

# piece: outline, joint, tip (the far end: elbow for an upper arm, hand for a forearm), parent piece or None
# keep: what colours stay on the body (dropped from the piece): 'red' skirt/bodice reds, 'dark' anything darker than g<82, 'apron' brown leather
CHARS = {
    'rosa': dict(
        cut=['mug', 'free'],
        pieces={
            'Lua': ([(294, 392), (380, 392), (390, 470), (354, 530), (294, 530), (284, 470)], (346, 418), (322, 526), None),
            'Lfa': ([(292, 518), (356, 518), (332, 600), (324, 710), (252, 710), (256, 600), (280, 540)], (322, 526), (288, 692), 'Lua'),
            'Rua': ([(516, 396), (574, 396), (588, 470), (586, 534), (538, 534), (520, 470)], (542, 420), (566, 516), None),
            'Rfa': ([(550, 474), (596, 430), (614, 430), (614, 504), (588, 534), (552, 532)], (566, 516), (606, 446), 'Rua'),
        },
        keep=('red', 'dark'),
        upright={'mug': ([(614, 344), (728, 344), (728, 504), (614, 504)], 'Rfa')},
        poses={
            'chest': dict(Lua=-15, Lfa=117, Rua=15, Rfa=-127),
            'cheek': dict(Lua=-35, Lfa=135, Rua=59, Rfa=117),
            'hips': dict(Lua=-45, Lfa=59, Rua=43, Rfa=-56),
            'up': dict(Lua=-145, Lfa=167, Rua=15, Rfa=-127),
        },
        leg=(456, 866, 541, 1168),
        script=['chest', 'cheek', 'hips', 'up'],
    ),
    'orrin': dict(
        cut=['wrench', 'free'],
        pieces={
            'Lua': ([(205, 300), (300, 300), (326, 420), (304, 556), (212, 556), (196, 420)], (276, 332), (258, 556), None),
            'Lfa': ([(212, 552), (306, 552), (306, 764), (224, 764), (206, 600)], (258, 556), (265, 740), 'Lua'),
            'Rua': ([(568, 300), (642, 300), (692, 430), (692, 556), (598, 556), (574, 430)], (600, 332), (645, 556), None),
            'Rfa': ([(596, 552), (694, 552), (702, 562), (750, 586), (750, 646), (694, 764), (566, 844), (494, 836), (536, 760), (596, 702)],
                    (645, 556), (630, 730), 'Rua'),
        },
        keep=('apron',),
        upright={},
        poses={
            'chest': dict(Lua=-12, Lfa=120, Rua=12, Rfa=-120),
            'cheek': dict(Lua=-120, Lfa=-165, Rua=12, Rfa=10),          # the wave
            'hips': dict(Lua=-42, Lfa=60, Rua=42, Rfa=-60),
            'up': dict(Lua=-42, Lfa=60, Rua=160, Rfa=176),               # wrench up, other hand on the hip
            'wide': dict(Lua=-95, Lfa=-95, Rua=95, Rfa=95),
            'think': dict(Lua=-10, Lfa=150, Rua=42, Rfa=-60),
        },
        leg=(468, 892, 612, 1182),
        script=['chest', 'cheek', 'hips', 'up'],
        # clip 3: hand to the chin with the other hand on the hip and a sway, hands clasped at the chest swaying side to side, a little bow
        frames=[('think', 0, s, 'stand') for s in (0, 0, -1, -1, 0, 0)] + [('think', b, 0, 'stand') for b in (0, 1, 1, 0, 1, 0)] +
               [('chest', 0, s, 'stand') for s in (0, -1, -1, 0, 1, 1, 0, 0)] + [('chest', b, 0, 'stand') for b in (1, 2, 2, 1, 0)] +
               [('think', 0, s, 'stand') for s in (0, 1, 1, 0, 0)],
    ),
    'mara': dict(
        cut=['larm', 'lbraid', 'rbraid'],
        pieces={
            'Lfa': ([(298, 438), (440, 424), (444, 496), (298, 508)], (312, 470), (420, 460), None),
            'Lbr': ([(212, 330), (298, 330), (298, 614), (212, 614)], (262, 334), (262, 600), None),
            'Rbr': ([(602, 330), (688, 330), (688, 614), (602, 614)], (636, 334), (636, 600), None),
        },
        keep=(),
        upright={},
        poses={
            'chest': dict(),
            'cheek': dict(Lfa=154, Lbr=('d', -6, 0, 0), Rbr=('d', -6, 0, 0)),
            'hips': dict(Lfa=27, Lbr=('d', 6, 0, 0), Rbr=('d', 6, 0, 0)),
            'up': dict(Lfa=-175, Lbr=('d', -4, 0, 0), Rbr=('d', -4, 0, 0)),
        },
        leg=(484, 900, 548, 1180),
        script=['chest', 'cheek', 'hips', 'up'],
        # clip 2: hand up by the hat with a bounce, a cross-step sway with knees in, the arm out, the same to the other side
        frames=[('up', b, 0, 'stand') for b in (0, 1, 1)] + [('up', 0, -1, 'knee'), ('up', 1, -1, 'knee')] +
               [('hips', b, 0, 'stand') for b in (0, 1, 2, 1, 0)] + [('cheek', 0, s, 'stand') for s in (0, 1, 1, 1, 0)] +
               [('up', 0, s, 'stand') for s in (0, 1, 1, 0, 0)] + [('cheek', 0, 1, 'knee'), ('cheek', 1, 1, 'knee'), ('cheek', 1, 0, 'stand'), ('chest', 0, 0, 'stand'), ('chest', 1, 0, 'stand')] +
               [('chest', b, 0, 'stand') for b in (0, 1, 2, 1, 0)],
    ),
    'bram': dict(
        cut=['staff', 'purse'],
        pieces={
            'staff': ([(671, 176), (731, 176), (733, 458), (758, 463), (758, 560), (731, 565), (728, 1178), (680, 1178), (677, 565), (650, 555), (650, 465),
                       (674, 457)], (700, 505), (700, 1170), None),
            'purse': ([(245, 570), (392, 570), (392, 756), (330, 791), (221, 791), (221, 690), (245, 640)], (310, 640), (310, 760), None),
        },
        keep=(),
        upright={},
        poses={
            'chest': dict(),
            'cheek': dict(staff=('d', 8, 0, -40)),                       # staff lifted
            'hips': dict(purse=('d', 0, 6, -50)),                         # purse jingled up
            'up': dict(staff=('d', -6, 0, -26), purse=('d', 0, 4, -30)),
        },
        leg=(250, 1040, 406, 1178),
        script=['chest', 'cheek', 'hips', 'up'],
        # clip 4: bounce and sway on the spot, the staff raised high like a pointed finger, a lean with the purse jingling, a jig to finish
        frames=[('chest', b, s, 'stand') for b, s in ((0, 0), (1, 0), (1, -1), (0, -1), (1, 0), (0, 0))] +
               [('cheek', b, 0, 'stand') for b in (0, 1, 1, 0, 1, 0)] + [('up', 0, s, 'stand') for s in (0, 1, 1, 1, 0, 0)] +
               [('hips', b, -1, 'stand') for b in (0, 1, 0, 1, 0, 0)] + [('chest', 0, 0, 'kick'), ('chest', 1, 0, 'kick'), ('chest', 0, 0, 'stand'),
                                                                        ('chest', 0, 0, 'knee'), ('chest', 1, 0, 'knee'), ('chest', 0, 0, 'stand')],
    ),
}


def turn(v, deg):
    """Turn a screen vector (y down) by deg the way PIL's rotate turns a picture (positive: a downward vector swings to the right)."""
    r = math.radians(deg)
    return (v[0] * math.cos(r) + v[1] * math.sin(r), -v[0] * math.sin(r) + v[1] * math.cos(r))


def direction(a, b):
    return math.degrees(math.atan2(b[0] - a[0], b[1] - a[1]))


def cut_piece(a, bg, pts, keep):
    Hf, Wf = a.shape[:2]
    m = np.array(poses.mask_of((Wf, Hf), pts)) > 0
    rgb = a.astype(int)
    if 'red' in keep:
        m &= ~(((rgb[:, :, 0] - rgb[:, :, 1]) > 80) & (rgb[:, :, 2] < 90))
    if 'dark' in keep:
        m &= rgb[:, :, 1] >= 82
    if 'apron' in keep:
        m &= ~((np.abs(rgb[:, :, 0] - 135) < 40) & (np.abs(rgb[:, :, 1] - 82) < 28) & (rgb[:, :, 2] < 70))
    return poses.key_out(Image.fromarray(np.dstack([a, (m * 255).astype(np.uint8)]), 'RGBA'), bg)


def compose(cfg, torso, pieces, upright, pose):
    canvas = torso.copy()
    P = cfg['poses'][pose]
    moved_tip = {}
    for name, (pts, joint, tip, parent) in cfg['pieces'].items():
        jx, jy = joint
        ox, oy = 0.0, 0.0
        if parent:  # carried by the parent: its joint moved with the parent's turn
            px_, py_ = moved_tip[parent][0]
            ox, oy = px_ - jx, py_ - jy
        v = P.get(name)
        if v is None:
            deg, dx, dy = 0.0, 0.0, 0.0
        elif isinstance(v, tuple):
            _, deg, dx, dy = v
        else:
            deg, dx, dy = v - direction(joint, tip), 0.0, 0.0
        tv = turn((tip[0] - jx, tip[1] - jy), deg)
        moved_tip[name] = ((jx + ox + dx + tv[0], jy + oy + dy + tv[1]), deg)
        canvas.alpha_composite(pieces[name].rotate(deg, resample=Image.BICUBIC, center=(jx, jy), translate=(ox + dx, oy + dy)))
    for name, (pts, hand) in cfg['upright'].items():
        (hx, hy), _ = moved_tip[hand]
        rest_tip = cfg['pieces'][hand][2]
        layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
        layer.paste(upright[name], (int(round(hx - rest_tip[0])), int(round(hy - rest_tip[1]))), upright[name])
        canvas.alpha_composite(layer)
    return canvas


def to_sprite(img, top, bot):
    k = H / (bot - top)
    c = img.crop((0, top, img.width, bot))
    a = np.array(c.resize((round(c.width * k), H), Image.BOX))
    a[:, :, 3] = np.where(a[:, :, 3] > 110, 255, 0)
    return a


def frames_for(script):
    """30 frames at 15 fps, the clip's timing: kick + chest, bounce, cheek/wave with a knee up, hips with a sway, up, back to the chest."""
    chest, cheek, hips, up = script
    return ([(chest, 0, 0, 'kick'), (chest, 1, 0, 'kick'), (chest, 1, 0, 'kick'), (chest, 0, 0, 'stand')] +
            [(chest, b, 0, 'stand') for b in (0, 1, 2, 1, 0, 1)] +
            [(cheek, 0, 0, 'knee'), (cheek, 1, 0, 'knee'), (cheek, 1, 0, 'knee'), (cheek, 0, 0, 'knee'),
             (cheek, 0, 0, 'stand'), (cheek, 1, 0, 'stand'), (cheek, 1, 0, 'stand'), (cheek, 0, 0, 'stand')] +
            [(hips, 0, s, 'stand') for s in (0, -1, -1, 0, 1, 1)] +
            [(up, 0, 0, 'stand'), (up, 1, 0, 'stand'), (up, 1, 0, 'stand'), (up, 0, 0, 'stand'), (chest, 1, 0, 'stand'), (chest, 0, 0, 'stand')])


def frame(img, spec, leg_box, legs_top):
    pose, bob, sway, legs = spec
    b = img.copy()
    if legs != 'stand':
        x0, y0, x1, y1 = leg_box
        leg = b[y0:y1, x0:x1].copy()
        b[y0:y1, x0:x1] = 0
        lift = 6 if legs == 'kick' else 8
        shift = 2 if legs == 'kick' else -1
        for yy in range(leg.shape[0]):
            for xx in range(leg.shape[1]):
                Y, X = y0 - lift + yy, x0 + shift + xx
                if leg[yy, xx, 3] and 0 <= Y < H and 0 <= X < b.shape[1]:
                    b[Y, X] = leg[yy, xx]
    out = np.zeros_like(b)
    for y in range(H):
        src = y - bob if y < legs_top else y
        if 0 <= src < H:
            out[y] = np.roll(b[src], sway, axis=0) if sway else b[src]
    return out


def build(id_):
    cfg = CHARS[id_]
    art = poses.load(id_, FACE)
    bg = art.getpixel((2, 2))
    a = np.array(art)
    pieces = {n: cut_piece(a, bg, p[0], cfg['keep']) for n, p in cfg['pieces'].items()}
    upright = {}
    for n, (pts, _) in cfg['upright'].items():
        piece = cut_piece(a, bg, pts, ())
        bx = piece.getbbox()
        upright[n] = piece  # pasted with its own offset relative to the hand (full-size layer, moved by the hand's travel)
    torso, _ = poses.cut_away(id_, FACE, cfg['cut'])
    al = np.array(torso)[:, :, 3] > 8
    ys = np.where(al.any(1))[0]
    top, bot = ys[0], ys[-1] + 1
    k = H / (bot - top)
    posed = {p: to_sprite(compose(cfg, torso, pieces, upright, p), top, bot) for p in cfg['poses']}
    lx0, ly0, lx1, ly1 = cfg['leg']
    leg_box = (int(lx0 * k), int((ly0 - top) * k), int(math.ceil(lx1 * k)) + 1, H)
    legs_top = leg_box[1]
    script = cfg.get('frames') or frames_for(cfg['script'])
    assert len(script) == 30, f'{id_}: {len(script)} frames, the game plays 30'
    frames = [frame(posed[f[0]], f, leg_box, legs_top) for f in script]
    Image.fromarray(np.concatenate(frames, axis=1), 'RGBA').save(os.path.join(HERE, '..', f'{id_}_anim.png'), optimize=True)
    return frames


if __name__ == '__main__':
    for id_ in sys.argv[1:] or list(CHARS):
        print(id_, len(build(id_)), 'frames')
