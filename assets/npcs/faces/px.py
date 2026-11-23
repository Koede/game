# Draw on the art in its own chunky blocks: each shape is drawn on a small layer (1 cell = S px) and scaled up with nearest-neighbour.
from PIL import Image, ImageDraw

class Blocky:
    def __init__(s, im, S=5):
        s.im, s.S = im, S
    def _go(s, fn):
        S=s.S; w,h=s.im.size
        layer=Image.new('RGBA',(w//S+1,h//S+1),(0,0,0,0)); d=ImageDraw.Draw(layer)
        fn(d, lambda v: int(round(v/S)))
        big=layer.resize((layer.width*S,layer.height*S),Image.NEAREST).crop((0,0,w,h))
        s.im.paste(big.convert('RGB'),(0,0),big.getchannel('A'))
    def rectangle(s,b,fill): s._go(lambda d,q: d.rectangle([q(b[0]),q(b[1]),max(q(b[0]),q(b[2])-1),max(q(b[1]),q(b[3])-1)],fill=fill))
    def ellipse(s,b,fill): s._go(lambda d,q: d.ellipse([q(b[0]),q(b[1]),max(q(b[0])+1,q(b[2])-1),max(q(b[1])+1,q(b[3])-1)],fill=fill))
    def chord(s,b,a0,a1,fill): s._go(lambda d,q: d.chord([q(b[0]),q(b[1]),max(q(b[0])+1,q(b[2])-1),max(q(b[1])+1,q(b[3])-1)],a0,a1,fill=fill))
    def arc(s,b,a0,a1,fill,width=1): s._go(lambda d,q: d.arc([q(b[0]),q(b[1]),max(q(b[0])+1,q(b[2])-1),max(q(b[1])+1,q(b[3])-1)],a0,a1,fill=fill,width=max(1,round(width/s.S))))
    def line(s,pts,fill,width=1): s._go(lambda d,q: d.line([(q(x),q(y)) for x,y in zip(pts[0::2],pts[1::2])],fill=fill,width=max(1,round(width/s.S))))
    def polygon(s,pts,fill): s._go(lambda d,q: d.polygon([(q(x),q(y)) for x,y in pts],fill=fill))
    def patch(s,box,cols):
        """Hard horizontal bands of skin inside an ellipse, in blocks."""
        x0,y0,x1,y1=box; S=s.S; w,h=max(2,round((x1-x0)/S)),max(2,round((y1-y0)/S))
        g=Image.new('RGB',(w,h)); gd=ImageDraw.Draw(g)
        for i,c in enumerate(cols): gd.rectangle((0,h*i//len(cols),w,h*(i+1)//len(cols)),fill=c)
        m=Image.new('L',(w,h),0); ImageDraw.Draw(m).ellipse((0,0,w-1,h-1),fill=255)
        s.im.paste(g.resize((w*S,h*S),Image.NEAREST),(x0,y0),m.resize((w*S,h*S),Image.NEAREST))

def stamp(im, x, y, rows, pal, S=4):
    """Place pixels by hand: each character is one S x S block ('.' leaves the art alone), rows go down from (x, y)."""
    d = ImageDraw.Draw(im)
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != '.':
                d.rectangle([x + c * S, y + r * S, x + c * S + S - 1, y + r * S + S - 1], fill=pal[ch])

def brow_split(im, box, outer_dy, inner_dy, S=4, fill=None):
    """Move a brow in two stepped halves (outer half by outer_dy, inner half by inner_dy; the face's mid line is x=449): a slant made of blocks."""
    x0, y0, x1, y1 = box
    mid = (x0 + x1) // 2
    left_brow = x0 < 449
    halves = [(x0, mid), (mid, x1)] if left_brow else [(mid, x1), (x0, mid)]
    dys = [outer_dy, inner_dy] if left_brow else [inner_dy, outer_dy]
    parts = [im.crop((a, y0, b, y1)) for a, b in halves]
    d = ImageDraw.Draw(im)
    for (a, b), dy in zip(halves, dys):
        if fill is None:
            src = im.crop((a, y0 - S, b, y0))
            for yy in range(y0, y1, S):
                im.paste(src, (a, yy))
        else:
            d.rectangle([a, y0, b, y1], fill=fill)
    for (a, b), dy, part in zip(halves, dys, parts):
        im.paste(part, (a, y0 + dy))
