"""Gruk (S=4). His mouth is the teeth and fangs: upper lip skin (r4), a dark gap (r5), the white lower-teeth strip (r6, cols 5-11), chin (r7);
tusks rise at cols 0-1 and 16-18; the dark V under the nose (r1-r3, cols 5-11) is his nose, not a mouth. His eyes are tiny gold slits under the brow mass.
Mouth region x424..500, y188..224: 19 cols x 9 rows. Eye region x408..500, y144..180: 23 cols x 9 rows, left eye cols 4-9, right 17-21 (axis 26),
r2-r5 brow mass, r5-r6 eyes, r7-r8 cheek."""
from cells import Region, render

MOU = dict(J=(107, 136, 76), H=(86, 114, 68), N=(142, 165, 86), L=(123, 146, 81), P=(217, 208, 192), K=(127, 117, 94), O=(170, 159, 133),
           M=(129, 133, 123), G=(75, 76, 57), C=(35, 52, 37), D=(42, 61, 47), E=(49, 70, 57), F=(58, 81, 60), B=(13, 30, 33), A=(21, 33, 20),
           t=(120, 52, 50), u=(158, 70, 66), s=(92, 118, 66), q=(70, 96, 58))
EYE = dict(A=(15, 17, 26), B=(39, 51, 42), C=(47, 76, 55), D=(67, 96, 63), K=(170, 158, 106), N=(185, 187, 147), H=(137, 138, 95), w=(226, 214, 172),
           G=(114, 143, 71), L=(162, 185, 97), J=(107, 136, 76), E=(87, 114, 67), s=(92, 118, 66), q=(70, 96, 58), p=(60, 40, 20))
AX = 26


def regions(img):
    return Region(img, 408, 144, 4, 23, 9, EYE, min_luma=0), Region(img, 424, 188, 4, 19, 11, MOU)


def neutral(e, m): pass


def drop(m, rows, cols_from, cols_to):
    """The lower jaw drops `rows` cells: everything from the teeth row down (teeth, tusks, chin) is copied down; the gap becomes mouth."""
    code = {1: 'v', 2: '2'}[rows]
    n = cols_to - cols_from + 1
    for r in range(6, 11):
        m.put(r, cols_from, code * n)


def happy(e, m):
    # a grin: the jaw drops one cell, the opening is dark with shaded lip corners, the lower teeth stay in view
    drop(m, 1, 0, 18)
    m.put(4, 5, 'FEEEEEEEF')
    m.put(5, 4, 'EBBBBBBBBBE')
    m.put(6, 5, 'EAAAAAAAE')


def laugh(e, m):
    # eyes shut under the brow: skin socket and a thin lash line; the jaw drops two cells, tongue behind the teeth
    e.mir(5, 4, '~~~~~~', AX)
    e.mir(6, 4, 'qBBBBq', AX)
    drop(m, 2, 0, 18)
    m.put(4, 5, 'FEEEEEEEF')
    m.put(5, 4, 'EBBBBBBBBBE')
    m.put(6, 4, 'EAAAAAAAAAE')
    m.put(7, 5, 'EAtuuutAE')


def surprised(e, m):
    # brows up a row; eyes wide (pale whites above a gold iris and pupil); jaw drops two cells in a narrow O
    for r in (2, 3, 4):
        e.put(r, 2, '^' * 9)
        e.put(r, 14, '^' * 9)
    e.mir(5, 4, 'NwwwwN', AX)
    e.mir(6, 4, 'wKppKw', AX)
    drop(m, 2, 0, 18)
    m.put(4, 6, 'FEEEEEF')
    m.put(5, 5, 'EBBBBBBBE')
    m.put(6, 5, 'EAAAAAAAE')
    m.put(7, 6, 'EAtuutAE')


def annoyed(e, m):
    # inner brows drop to the nose, eyes hooded; a scowl: the gap closes to a thin dark line under a shaded lip
    e.mir(6, 4, 'HNHHHH', AX)
    e.mir(5, 9, 'AAA', AX)
    e.mir(6, 9, 'AA', AX)
    m.put(4, 4, 'EEEEEEEEE')
    m.put(5, 3, 'DBBBBBBBBBD')


def smirk(e, m):
    # right eye hooded; the jaw drops on one side only
    e.put(6, 17, 'HHHH')
    drop(m, 1, 8, 18)
    m.put(4, 8, 'FEEEEE')
    m.put(5, 8, 'EBBBBBBE')
    m.put(6, 9, 'EAAAAAE')


KINDS = [neutral, happy, laugh, surprised, annoyed, smirk]


def face(i):
    def go():
        def fill(img):
            e, m = regions(img)
            KINDS[i](e, m)
            return [e, m]
        return render('gruk', fill)
    return go


FACES = [face(i) for i in range(6)]
