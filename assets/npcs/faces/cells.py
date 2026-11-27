"""Cell-level pixel editing on the blueprint art (assets/npcs/README.md, docs/api/npcs.md).

A face region is read as a grid of cells (S px square, the art's own block size). An expression is a list of hand-written rows of characters
laid over that grid, one character per cell:
  .   keep the original cell
  ~   a skin cell to be re-filled: its colour is smoothed in from the surrounding untouched cells (keeps the shading gradient)
  ^ v # 2   copy the original cell one below / one above / two below / two above (moves brows, stretches eyes)
  > <       skin taken from the nearest untouched skin cell to the right / left in the same row (a refill that follows the row's shading)
  any other character: a colour from the region's legend (sampled from the original art, or a ramp step hand-picked next to it)
Nothing is generated: every changed cell is a character in the data files (bram.py, orrin.py, gruk.py, mara.py, rosa.py)."""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OFFSETS = {'^': 1, 'v': -1, '#': 2, '2': -2}


def load(id_):
    return np.array(Image.open(os.path.join(HERE, '..', id_ + '.jpg')).convert('RGB'))


class Region:
    def __init__(self, img, x0, y0, S, cols, rows, legend, min_luma=0):
        self.img, self.x0, self.y0, self.S, self.cols, self.rows, self.legend, self.min_luma = img, x0, y0, S, cols, rows, legend, min_luma
        self.base = np.zeros((rows, cols, 3))
        for r in range(rows):
            for c in range(cols):
                self.base[r, c] = np.median(img[y0 + r * S:y0 + r * S + S, x0 + c * S:x0 + c * S + S].reshape(-1, 3), axis=0)
        self.cell = {}  # (r, c) -> rgb tuple or '~'

    def put(self, r, c, s):
        for i, ch in enumerate(s):
            cc = c + i
            if ch == '.' or not (0 <= r < self.rows and 0 <= cc < self.cols):
                continue
            if ch == '~':
                self.cell[(r, cc)] = '~'
            elif ch in '<>':
                self.cell[(r, cc)] = ch
            elif ch in OFFSETS:
                rr = r + OFFSETS[ch]
                self.cell[(r, cc)] = tuple(self.base[min(max(rr, 0), self.rows - 1), cc])
            else:
                self.cell[(r, cc)] = tuple(self.legend[ch])

    def mir(self, r, c, s, axis_sum):
        """Left-side row plus its mirror image on the right (cell c <-> axis_sum - c)."""
        self.put(r, c, s)
        self.put(r, axis_sum - (c + len(s) - 1), s[::-1].translate(str.maketrans('<>', '><')))

    def smooth(self):
        holes = [k for k, v in self.cell.items() if v == '~']
        if not holes:
            return {}
        col = {}
        anchored = lambda rc: (rc not in self.cell and 0 <= rc[0] < self.rows and 0 <= rc[1] < self.cols
                               and self.base[rc].mean() >= self.min_luma
                               and self.base[rc][0] - self.base[rc][2] >= 20 and self.base[rc][0] >= self.base[rc][1])  # hair, lashes, grey brows are not skin: they never bleed into a refill
        for rc in holes:  # start from the mean of the nearest anchored cells
            near = [self.base[r, c] for r in range(rc[0] - 3, rc[0] + 4) for c in range(rc[1] - 3, rc[1] + 4) if anchored((r, c))]
            col[rc] = np.mean(near, axis=0) if near else np.array(self.base[rc])
        for _ in range(60):
            for rc in holes:
                acc, n = np.zeros(3), 0
                for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nb = (rc[0] + d[0], rc[1] + d[1])
                    if nb in col:
                        acc += col[nb]; n += 1
                    elif anchored(nb):
                        acc += self.base[nb]; n += 1
                if n:
                    col[rc] = acc / n
        return col

    def row_skin(self, r, c, step):
        cc = c + step
        while 0 <= cc < self.cols:
            if (r, cc) not in self.cell and self.base[r, cc].mean() >= self.min_luma and self.base[r, cc][0] - self.base[r, cc][2] >= 20 and self.base[r, cc][0] >= self.base[r, cc][1]:
                return self.base[r, cc]
            cc += step
        return None

    def paint(self, out):
        for (r, c), v in list(self.cell.items()):
            if v in ('<', '>'):
                got = self.row_skin(r, c, 1 if v == '>' else -1)
                self.cell[(r, c)] = tuple(got) if got is not None else '~'
        sm = self.smooth()
        S = self.S
        for (r, c), v in self.cell.items():
            rgb = sm[(r, c)] if v == '~' else v
            out[self.y0 + r * S:self.y0 + r * S + S, self.x0 + c * S:self.x0 + c * S + S] = np.clip(np.round(rgb), 0, 255)


def render(id_, regions_fn):
    """regions_fn(img) -> list of Regions already filled with an expression; returns a PIL image."""
    img = load(id_)
    out = img.copy()
    for reg in regions_fn(img):
        reg.paint(out)
    return Image.fromarray(out)
