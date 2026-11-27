"""Batch preview: every expression of the given characters, rendered once, side by side at 3x on the face area. python sheet.py bram gruk ..."""
import sys, importlib, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
BOX = {'bram': (385, 160, 515, 290), 'orrin': (385, 150, 515, 280), 'gruk': (405, 140, 515, 225), 'mara': (385, 185, 515, 285), 'rosa': (390, 190, 520, 300)}
if __name__ == '__main__':
    out = os.environ.get('OUT', '.')
    for n in sys.argv[1:]:
        mod = importlib.import_module(n)
        b = BOX[n]; Z = 3
        W, H = (b[2] - b[0]) * Z, (b[3] - b[1]) * Z
        q = Image.new('RGB', (W * 3, H * 2))
        for i, f in enumerate(mod.FACES):
            q.paste(f().crop(b).resize((W, H), Image.NEAREST), ((i % 3) * W, (i // 3) * H))
        q.save(os.path.join(out, f'{n}_cells.png'))
