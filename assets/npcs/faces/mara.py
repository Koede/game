"""Mara (S=3). Eyes: region x398..500, y192..238, 34 cols x 15 rows, left eye cols 1-11, right 22-32 (axis 33): r1-r3 brow, r7 dark lash band (y213),
r8-r12 iris and whites, r13 lower lid. Mouth: region x428..470, y248..275, 14 cols x 9 rows: r3 lighter lip line (cols 2-11), r4 darker lip line (cols 3-9)."""
from cells import Region, render

EYE = dict(A=(40, 20, 33), C=(54, 35, 57), D=(71, 52, 77), F=(119, 66, 71), H=(149, 105, 122), J=(207, 134, 134), K=(236, 166, 155), M=(238, 184, 173),
           N=(242, 199, 184), O=(249, 208, 189), P=(248, 212, 194), Q=(245, 213, 201), R=(246, 233, 222))
MOU = dict(a=(194, 124, 115), b=(225, 176, 163), c=(246, 194, 179), T=(246, 236, 232), l=(222, 146, 140), o=(120, 44, 54), g=(216, 124, 124), h=(238, 176, 168))
AX = 33


def regions(img):
    return Region(img, 398, 192, 3, 34, 15, EYE, min_luma=170), Region(img, 428, 248, 3, 14, 9, MOU)


def neutral(e, m): pass


def happy(e, m):
    e.mir(12, 4, 'QQQQQQ', AX)
    e.mir(13, 5, 'MMMM', AX)
    m.put(3, 2, 'aabbbbbbaa')
    m.put(4, 3, 'TTTTTTTT')
    m.put(5, 4, 'llllll')


def laugh(e, m):
    # eyes squeezed shut: a rosy lid, a three-step lash arc with flicks, then the skin lightens down to the cheek
    for r, s in ((6, '>>>>>>>>>>'), (7, '>>>>KKK>>>'), (8, '>>>>AAA>>>'), (9, '>>AA>>>AA>'), (10, '~F~~~~~~~F'), (11, '~~~~~~~~~~'), (12, '~~~~~~~~~~')):
        e.mir(r, 2, s, AX)
    m.put(3, 2, 'aabbbbbbaa')
    m.put(4, 3, 'TTTTTTTT')
    m.put(5, 3, 'oooooooo')
    m.put(6, 4, 'ogggo~')
    m.put(7, 5, 'llll')


def surprised(e, m):
    for r in (11, 12, 13):
        e.mir(r, 3, 'vvvvvvvvv', AX)
    e.mir(0, 3, '#######', AX)
    e.mir(1, 3, '#######', AX)
    e.mir(2, 3, '~~~~~~~', AX)
    e.mir(3, 3, '~~~~~~~', AX)
    m.put(3, 2, '~~~~~~~~~~')
    m.put(4, 3, '~~~~~~~')
    m.put(3, 5, 'aaaa')
    m.put(4, 4, 'aooooa')
    m.put(5, 4, 'aooooa')
    m.put(6, 5, 'aaaa')


def annoyed(e, m):
    e.mir(7, 3, '>>>>>>>>>', AX)
    e.mir(8, 3, 'CA>>>>>AC', AX)
    e.mir(9, 5, 'AAAAA', AX)
    e.mir(1, 3, 'CCC~~~~', AX)
    e.mir(3, 6, 'CCCC', AX)
    m.put(3, 3, '~~~~~~~~')
    m.put(5, 2, 'a')
    m.put(5, 11, 'a')


def smirk(e, m):
    e.put(0, 3, '#######')
    e.put(1, 3, '#######')
    e.put(2, 3, '~~~~~~~')
    e.put(3, 3, '~~~~~~~')
    e.put(7, 22, '<<<<<<<<<')
    e.put(8, 22, 'CA<<<<<AC')
    e.put(9, 24, 'AAAAA')
    m.put(3, 2, '~~~~~~~~~~')
    m.put(4, 3, 'aaaa~~~')
    m.put(3, 7, 'aaaa')
    m.put(2, 11, 'a')


KINDS = [neutral, happy, laugh, surprised, annoyed, smirk]


def face(i):
    def go():
        def fill(img):
            e, m = regions(img)
            KINDS[i](e, m)
            return [e, m]
        return render('mara', fill)
    return go


FACES = [face(i) for i in range(6)]
