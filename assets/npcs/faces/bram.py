"""Bram (S=4). Eyes: region x396..504, y176..216, 27 cols x 10 rows, left eye cols 1-7, mirror axis 25 (right eye cols 18-24).
Rows: r3 y188 brow bottom, r4 y192 lid, r5 y196 dark lash band, r6 y200 whites+pupils, r7 y204 lower lid, r8 y208 cheek.
Mouth: region x424..476, y250..286, 13 cols x 9 rows: r2 dark top rim, r3 teeth (cols 2-9), r4 dark under-rim, r5-r6 peach lip/chin, r7 beard line."""
from cells import Region, render, load

EYE = dict(a=(31, 21, 25), b=(66, 46, 46), c=(99, 62, 54), d=(125, 76, 60), f=(141, 88, 69), g=(150, 103, 82), h=(171, 114, 87), j=(191, 135, 103),
           k=(218, 164, 123), m=(203, 177, 164), p=(247, 246, 250), i=(143, 142, 143), l=(181, 180, 181), e=(91, 84, 86), y=(160, 100, 74))
MOU = dict(a=(19, 12, 18), b=(57, 40, 37), c=(74, 69, 68), N=(245, 241, 237), h=(115, 110, 113), l=(217, 165, 129), f=(151, 93, 65), j=(180, 123, 93),
           e=(136, 95, 76), t=(104, 40, 46), u=(160, 70, 70), v=(196, 100, 96), g=(108, 103, 107))
AX = 25


def regions(img):
    return Region(img, 396, 176, 4, 27, 10, EYE, min_luma=110), Region(img, 424, 250, 4, 13, 9, MOU)


def neutral(e, m): pass


def happy(e, m):
    # cheeks lift the lower lids: outer whites become skin, a crease sits under each eye
    e.mir(6, 1, 'ahpbah.', AX)
    e.mir(7, 1, 'jjjjjjj', AX)
    e.mir(8, 2, 'ggggg', AX)
    # a slightly open grin: the dark under-rim widens below the teeth
    m.put(4, 1, 'bbaaaaaabb')
    m.put(5, 2, 'llllllll')


def laugh(e, m):
    # eyes squeezed shut: skin re-filled, a three-step lash arc, flicks at the outer ends
    for r, s in ((4, '~~~~~~~'), (5, '~~baa~~'), (6, '~b~~~b~'), (7, 'c~~~~~c')):
        e.mir(r, 1, s, AX)
    # mouth wide open: dark inside, tongue low
    m.put(4, 1, 'aabbbbbbaa')
    m.put(5, 2, 'jabttbaj')
    m.put(6, 3, 'jauuaj')


def surprised(e, m):
    # brows lifted a row (cells copied up), eyes opened wide: lash line up, whites, big iris, lower lid
    for r in (0, 1, 2, 3):
        e.put(r, 0, '^' * 10)
        e.put(r, 17, '^' * 10)
    e.put(4, 1, '~~~~~~~~')
    e.put(4, 17, '~~~~~~~~')
    e.mir(4, 2, 'aaaaaa', AX)
    e.mir(5, 2, 'lppppl', AX)
    e.mir(6, 2, 'pbaabp', AX)
    e.mir(7, 2, 'mmmmmm', AX)
    m.put(3, 2, 'NbaaaabN')
    m.put(4, 3, 'baaaab')
    m.put(5, 4, 'baab')


def annoyed(e, m):
    # eyes narrowed under the lid: dark over the whites, a thin lower lid
    e.mir(6, 2, 'baaaab', AX)
    e.mir(7, 2, 'gmmmmg', AX)
    m.put(3, 2, 'bbbbbbbb')


def smirk(e, m):
    # one brow up, one eye narrowed, a lopsided grin
    for r in (0, 1, 2, 3):
        e.put(r, 0, '^' * 10)
    e.put(4, 1, '~~~~~~~~')
    e.put(6, 19, 'baaaab')
    e.put(7, 19, 'gmmmmg')
    m.put(3, 2, 'bbbb')
    m.put(2, 10, 'aaa')
    m.put(1, 11, 'aa')


KINDS = [neutral, happy, laugh, surprised, annoyed, smirk]


def face(i):
    def go(img_fn=None):
        def fill(img):
            e, m = regions(img)
            KINDS[i](e, m)
            return [e, m]
        return render('bram', fill)
    return go


FACES = [face(i) for i in range(6)]
