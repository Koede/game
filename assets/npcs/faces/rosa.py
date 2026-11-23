"""Rosa (S=5). Eyes: region x395..505, y205..255, 22 cols x 10 rows, left eye cols 1-7, right 14-20 (axis 21): r0 brow, r3-r4 dark lash band (y220-229),
r5-r6 iris and whites, r7 lower lid. Mouth: region x415..485, y262..297, 14 cols x 7 rows: the smile is the corner at (r2 c2)-(r3 c3-4), the bottom line
r4 c4-8, the right corner (r3 c8-9)-(r2 c10); centre col 6."""
from cells import Region, render

EYE = dict(A=(53, 14, 17), B=(68, 23, 23), C=(92, 37, 30), E=(140, 72, 52), K=(225, 147, 115), N=(239, 172, 137), O=(236, 179, 149), P=(241, 182, 145),
           U=(246, 212, 193), V=(254, 240, 230), r=(205, 120, 96))
MOU = dict(A=(126, 63, 56), B=(177, 93, 70), D=(200, 122, 95), E=(225, 159, 125), T=(246, 232, 222), o=(122, 44, 44), g=(190, 90, 84), h=(214, 130, 112))
AX = 21


def regions(img):
    return Region(img, 395, 205, 5, 22, 10, EYE, min_luma=140), Region(img, 415, 262, 5, 14, 7, MOU, min_luma=150)


def neutral(e, m): pass


def happy(e, m):
    e.mir(7, 2, 'NONON', AX)
    m.put(3, 3, 'BDTTTEB')


def laugh(e, m):
    for r, s in ((3, '>>>>>>>'), (4, '>>AAA>>'), (5, '>A>>>A>'), (6, 'B~~~~~B'), (7, '~~~~~~~')):
        e.mir(r, 1, s, AX)
    for r in (5, 6, 7):
        e.mir(r, 0, '~', AX)
        e.mir(r, 8, '~', AX)
    m.put(2, 4, 'TTTTT')
    m.put(3, 3, 'BoooooB')
    m.put(4, 4, 'ogggo')
    m.put(5, 4, 'EDDDE')


def surprised(e, m):
    for r in (6, 7, 8):
        e.mir(r, 0, 'vvvvvvvvv', AX)
    m.put(2, 1, '~~~')
    m.put(2, 9, '~~~')
    m.put(3, 2, '~~~')
    m.put(3, 8, '~~~')
    m.put(4, 4, '~~~~~')
    m.put(2, 5, 'DDD')
    m.put(3, 4, 'DoooD')
    m.put(4, 4, 'DoooD')
    m.put(5, 5, 'DDD')


def annoyed(e, m):
    e.mir(3, 1, '>>>>>>>', AX)
    e.mir(4, 1, 'CAAAAAC', AX)
    m.put(2, 2, '~')
    m.put(2, 10, '~')
    m.put(3, 3, 'BDBBBDB')
    m.put(4, 3, 'D')
    m.put(4, 9, 'D')


def smirk(e, m):
    e.put(3, 14, '<<<<<<<')
    e.put(4, 14, 'CAAAAAC')
    m.put(2, 2, '~')
    m.put(3, 3, 'BDBBB')
    m.put(3, 8, '~~')
    m.put(2, 9, 'BD')
    m.put(1, 10, 'D')


KINDS = [neutral, happy, laugh, surprised, annoyed, smirk]


def face(i):
    def go():
        def fill(img):
            e, m = regions(img)
            KINDS[i](e, m)
            return [e, m]
        return render('rosa', fill)
    return go


FACES = [face(i) for i in range(6)]
