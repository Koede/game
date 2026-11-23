"""Builds assets/npcs/<id>_faces.jpg: six portrait cells (neutral, happy, laughing, surprised, annoyed, sly) per character, each a head-and-shoulders
crop of an expression edited onto the blueprint art, cell by cell, by the character's own file here (bram.py, orrin.py, gruk.py, mara.py, rosa.py
over the cell engine in cells.py: each changed cell is a character in a hand-written grid).
  python assets/npcs/faces/build.py   then   node scripts/npc-art.mjs"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import bram, orrin, gruk, mara, rosa

CELL = 160
# head-and-shoulders crop windows (square) on each blueprint
CROPS = {'mara': (300, 25, 600, 325), 'rosa': (285, 45, 575, 335), 'gruk': (345, 40, 585, 280), 'orrin': (320, 75, 580, 335), 'bram': (325, 70, 595, 340)}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

def frames(id_):
    mod = {'mara': mara, 'rosa': rosa, 'gruk': gruk, 'orrin': orrin, 'bram': bram}[id_]
    return [f() for f in mod.FACES]

if __name__ == '__main__':
    for id_, box in CROPS.items():
        sheet = Image.new('RGB', (CELL * 6, CELL))
        for i, im in enumerate(frames(id_)):
            sheet.paste(im.crop(box).resize((CELL, CELL), Image.LANCZOS), (i * CELL, 0))
        sheet.save(os.path.join(OUT, f'{id_}_faces.jpg'), quality=90)
        print(id_, sheet.size)
