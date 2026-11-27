"""Orrin (S=4). His mouth is the small teeth sliver under the moustache (r2, cols 3-8) with the lip band under it (r3); the dash lower down (r6) is his chin dimple.
Eyes: region x398..502, y160..208, 26 cols x 12 rows, left eye cols 2-7, right 17-22 (axis 24): r2-r4 brow, r5-r6 lid skin, r7 dark lash band (y188),
r8-r9 whites and pupils, r10 lower lid, r11 cheek. Mouth: region x426..474, y238..270, 12 cols x 8 rows."""
from cells import Region, render

EYE = dict(A=(22, 10, 13), B=(47, 24, 20), C=(59, 24, 21), D=(73, 37, 31), E=(90, 49, 41), F=(124, 85, 73), G=(155, 105, 92), H=(170, 103, 86),
           I=(175, 115, 96), J=(188, 131, 106), K=(197, 157, 135), L=(217, 154, 122), M=(241, 183, 144), N=(205, 193, 188), O=(235, 193, 163),
           P=(236, 219, 203), r=(200, 125, 103))
MOU = dict(a=(51, 27, 24), B=(64, 34, 28), C=(92, 54, 44), E=(107, 61, 46), F=(133, 76, 64), G=(161, 114, 92), H=(196, 135, 110), I=(186, 165, 155),
           N=(241, 226, 209), M=(241, 184, 148), o=(70, 30, 28), u=(186, 96, 88), h=(196, 120, 98), g=(148, 92, 78))
AX = 24


def regions(img):
    return Region(img, 398, 160, 4, 26, 12, EYE, min_luma=130), Region(img, 426, 238, 4, 12, 8, MOU)


def neutral(e, m): pass


def happy(e, m):
    e.mir(9, 2, 'LPBBCL', AX)
    e.mir(10, 2, 'LLLLLL', AX)
    e.mir(11, 3, 'rrrr', AX)
    m.put(2, 1, 'G.INNNNI.G')
    m.put(3, 2, 'GhhhhhhG')


def laugh(e, m):
    for r, s in ((7, '~~~~~~'), (8, '~~AA~~'), (9, '~A~~A~'), (10, 'A~~~~A')):
        e.mir(r, 2, s, AX)
    m.put(2, 3, 'INNNNI')
    m.put(3, 2, 'GooooooG')
    m.put(4, 3, 'GouuoG')
    m.put(5, 4, 'hhhh')


def surprised(e, m):
    for r in (2, 3, 4):
        e.mir(r, 1, '^' * 9, AX)
    e.mir(5, 1, '~~~~~~~~~', AX)
    e.mir(6, 3, 'AAAAA', AX)
    e.mir(7, 3, 'NPPPN', AX)
    m.put(2, 3, 'GoooG')
    m.put(3, 3, 'GoooG')
    m.put(4, 4, 'GoG')
    m.put(5, 4, 'hhh')


def annoyed(e, m):
    e.mir(2, 4, '~~~~', AX)
    e.mir(3, 6, '~~', AX)
    e.mir(5, 5, 'BDDDB', AX)
    e.mir(6, 7, 'DD', AX)
    e.mir(8, 3, 'AAAAA', AX)
    m.put(2, 4, 'BBB')
    m.put(3, 2, 'gggggggg')
    m.put(4, 2, 'g')
    m.put(4, 9, 'g')


def smirk(e, m):
    for r in (2, 3, 4):
        e.put(r, 1, '^' * 9)
    e.put(5, 1, '~~~~~~~~~')
    e.put(8, 17, 'AAAAA')
    m.put(2, 4, 'BBNNI')
    m.put(2, 8, 'GG')
    m.put(3, 8, 'MM')


KINDS = [neutral, happy, laugh, surprised, annoyed, smirk]


def face(i):
    def go():
        def fill(img):
            e, m = regions(img)
            KINDS[i](e, m)
            return [e, m]
        return render('orrin', fill)
    return go


FACES = [face(i) for i in range(6)]
