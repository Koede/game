import os
import math, numpy as np, cv2
from PIL import Image
SRC=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','rosa.jpg')
C=5; OX,OY=390,190
DARK=(66,24,20); LASH=(92,40,32); LID=(226,160,136); LIP=(201,115,90); LIPD=(166,84,63); MOUTH=(140,62,58); TEETH=(240,224,214); TONGUE=(206,120,104); BLUSH=(240,172,150); BROW=(91,29,16); ARC=(70,26,22)

class Face:
    def __init__(s): s.a=np.array(Image.open(SRC).convert('RGB'))
    def inpaint(s, mask):  # mask: bool array
        m=(mask*255).astype(np.uint8)
        bgr=cv2.cvtColor(s.a,cv2.COLOR_RGB2BGR)
        out=cv2.inpaint(bgr,m,6,cv2.INPAINT_TELEA)
        out=cv2.cvtColor(out,cv2.COLOR_BGR2RGB)
        # blocky like the art: average each lattice cell inside the mask
        ys,xs=np.where(mask)
        cells={((x-OX)//C,(y-OY)//C) for x,y in zip(xs,ys)}
        for cx,cy in cells:
            x0,y0=OX+cx*C,OY+cy*C
            blk=out[y0:y0+C,x0:x0+C]; mk=mask[y0:y0+C,x0:x0+C]
            if mk.any(): out[y0:y0+C,x0:x0+C][mk]=blk[mk].mean(axis=0)
        s.a=out
    def ell(s,cx,cy,rx,ry):
        Y,X=np.ogrid[:s.a.shape[0],:s.a.shape[1]]
        return ((X-cx)/rx)**2+((Y-cy)/ry)**2<=1
    def rect(s,x0,y0,x1,y1):
        m=np.zeros(s.a.shape[:2],bool); m[y0:y1,x0:x1]=True; return m
    def px(s,x,y,col,w=1,h=1):  # lattice cell in source coords snapped to the art's 5 px grid
        x0=OX+int(round((x-OX)/C))*C; y0=OY+int(round((y-OY)/C))*C
        s.a[y0:y0+h*C,x0:x0+w*C]=col
    def path(s,pts,col,thick=1):
        for (x,y) in pts:
            for dx in range(thick):
                s.px(x,y,col)
    def save(s): return Image.fromarray(s.a)

def curve(x0,x1,y,depth,n=40,power=2):
    out=[]
    for i in range(n+1):
        t=i/n; x=x0+(x1-x0)*t; u=2*t-1
        out.append((x,y-depth*(1-abs(u)**power)))
    return out

def arcs_eye(f,cx,flip=1,w=17,up=11):
    xs=[cx-15+5*k for k in range(7)]
    for x,o in zip(xs,[2,1,0,0,0,1,2]):
        f.px(x,232+5*o,DARK)
        if o==0: f.px(x,227,LID)
    f.px(xs[0]-5 if flip>0 else xs[-1]+5,247,DARK)
    for x in xs[1:-1:2]: f.px(x,247,BLUSH)

def mouth_clear(f): f.inpaint(f.rect(422,271,478,298))
def smile(x0,x1,y_end,d,n=50,p=2):
    return [(x0+(x1-x0)*i/n, y_end+d*(1-abs(2*i/n-1)**p)) for i in range(n+1)]
def eyes_clear(f):
    m=f.ell(414,235,20,17)|f.ell(480,235,20,17)
    orig=f.a.astype(float)
    f.inpaint(m)
    # freckles back: small high-frequency detail from the cheek 30 px below, clamped, then re-blocked to the 5 px grid
    donor=np.roll(orig,-30,axis=0)
    detail=np.clip(donor-cv2.GaussianBlur(donor,(0,0),4),-28,28)*0.8
    out=f.a.astype(float); out[m]+=detail[m]
    f.a=np.clip(out,0,255).astype(np.uint8)
    ys,xs=np.where(m)
    for cx,cy in {((x-OX)//C,(y-OY)//C) for x,y in zip(xs,ys)}:
        x0,y0=OX+cx*C,OY+cy*C
        blk=f.a[y0:y0+C,x0:x0+C]; mk=m[y0:y0+C,x0:x0+C]
        blk[mk]=blk[mk].mean(axis=0)
def brow_clear(f): f.inpaint(f.rect(402,199,436,213))

def blush(f):
    for (x,y) in [(405,262),(410,262),(405,267),(410,267),(490,262),(485,262),(490,267),(485,267),(415,267),(480,267)]: f.px(x,y,BLUSH)

EYES=((397,412),(464,481))  # (left x of eye, centre x)
def lid(f,outer,inner=None,col=None):
    # lids over the top of each eye; the edge can slant (inner corners lower for anger), highlight kept below it
    inner=outer if inner is None else inner
    col=col or tuple(int(v) for v in f.a[213,425])
    for e,(x0,_) in enumerate(EYES):
        for k in range(7):
            t=k/6 if e==0 else 1-k/6          # 0 at the outer corner, 1 at the inner one
            drop=int(round((outer+(inner-outer)*t)/5))*5
            x=x0+k*5
            if drop==0: continue
            for y in range(221,221+drop,5): f.px(x,y,col)
            f.px(x,221+drop,DARK)
        f.px(x0+10,221+max(outer,inner)+5,TEETH)
def smile_eyes(f):
    # cheeks push the lower lids up: skin over the bottom row of each eye and a soft pink crease above it
    col=tuple(int(v) for v in f.a[258,412])
    for x0,_ in EYES:
        for k in range(1,6):
            f.px(x0+k*5,246,col)
        for k in (2,3,4):
            f.px(x0+k*5,246,(226,150,128))
def shock(f):
    # three bold strokes radiating from the top right of the head
    for (x0,y0,x1,y1) in [(527,70,545,48),(557,102,583,88),(570,143,600,140)]:
        n=7
        for k in range(n+1):
            x=x0+(x1-x0)*k/n; y=y0+(y1-y0)*k/n
            f.px(x,y,BROW,2,2)
def wide_eyes(f):
    # the eyes themselves, enlarged a quarter and feathered back in
    img=Image.fromarray(f.a)
    for cx,cy in ((412,234),(481,234)):
        w,h=56,44
        patch=img.crop((cx-w//2,cy-h//2,cx+w//2,cy+h//2))
        big=patch.resize((int(w*1.14),int(h*1.14)),Image.BICUBIC)
        mask=Image.new('L',big.size,0)
        from PIL import ImageDraw, ImageFilter
        ImageDraw.Draw(mask).ellipse((8,6,big.width-8,big.height-6),fill=255)
        mask=mask.filter(ImageFilter.GaussianBlur(4))
        img.paste(big,(cx-big.width//2,cy-big.height//2),mask)
    f.a=np.array(img)
def vein(f):
    for (x,y) in [(446,196),(441,201),(451,201),(446,206)]: f.px(x,y,(205,52,52))
    for (x,y) in [(441,196),(451,196),(441,206),(451,206)]: f.px(x,y,(245,196,164))
def neutral(f): pass

def thin_brows(f,left,right):
    # one-pixel-row brows in her own brow colour; left/right are lists of y per 5 px column, outer to inner
    brow_clear(f)
    for k,y in enumerate(left): f.px(405+5*k,y,BROW)
    for k,y in enumerate(right or []): f.px(495-5*k,y,BROW)

def happy(f):
    smile_eyes(f)
    mouth_clear(f)
    f.px(429,270,LIPD); f.px(469,270,LIPD)
    for x in range(434,465,5): f.px(x,275,LIPD)
    for x in range(439,460,5): f.px(x,280,TEETH)
    f.px(434,280,LIP); f.px(464,280,LIP)
    for x in range(444,455,5): f.px(x,285,LIP)
    soft_blush(f)

def soft_blush(f):
    for (x,y) in [(405,262),(410,262),(490,262),(485,262)]:
        c=f.a[y,x].astype(int); f.px(x,y,tuple(int(v) for v in (c*0.6+np.array(BLUSH)*0.4)))

def laugh(f):
    eyes_clear(f); mouth_clear(f)
    for cx in (412,481):
        xs=[cx-17+5*k for k in range(8)]
        for x,o in zip(xs,[2,1,1,0,0,1,1,2]): f.px(x,234+5*o,ARC)
    f.px(429,270,LIPD); f.px(469,270,LIPD)
    for x in range(434,465,5): f.px(x,275,LIPD)
    for x in range(434,465,5): f.px(x,280,TEETH)
    for x in range(439,460,5): f.px(x,285,MOUTH)
    for x in range(444,455,5): f.px(x,285,TONGUE)
    for x in range(444,455,5): f.px(x,290,LIPD)
    f.px(439,290,LIP); f.px(459,290,LIP)
    soft_blush(f)

def surprised(f):
    wide_eyes(f)
    thin_brows(f,[201,196,196,196,201],None)
    mouth_clear(f)
    for x in (444,449,454): f.px(x,280,LIPD)
    f.px(439,285,LIPD); f.px(459,285,LIPD)
    for x in (444,449,454): f.px(x,285,MOUTH)
    for x in (444,449,454): f.px(x,290,LIP)

def annoyed(f):
    lid(f,0,5)
    thin_brows(f,[201,201,206,206,211,211],None)
    mouth_clear(f)
    for x in range(439,460,5): f.px(x,284,LIPD)
    f.px(434,289,LIP); f.px(464,289,LIP)

def smirk(f):
    lid(f,5,5)
    thin_brows(f,[201,196,196,196,201],None)
    mouth_clear(f)
    for x in range(439,455,5): f.px(x,284,LIPD)
    f.px(459,280,LIPD); f.px(464,275,LIP)

EXPR=[neutral,happy,laugh,surprised,annoyed,smirk]

def faces():
    out=[]
    for fn in EXPR:
        f=Face(); fn(f); out.append(f.save())
    return out
