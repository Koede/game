import os
# Mara's expressions: hand-placed blocks (3 px) on mara.jpg. Eyes are the green ones at y 207-231, brows the thin lines above (y 196-203),
# the mouth the small line at y 256-261 (x 436-461).
from PIL import Image
from px import Blocky, stamp
SRC=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','mara.jpg'); S=3
P=(250,214,196); M=(238,190,176); D=(58,34,52); L=(222,146,140); LD=(150,76,76); T=(244,232,228); MO=(120,44,54); TG=(216,124,124)
PAL={'e':(244,206,188),'n':(236,192,176),'p':P,'m':M,'d':D,'l':L,'L':LD,'t':T,'o':MO,'g':TG}
def new():
    im=Image.open(SRC).convert('RGB'); return im,Blocky(im,S)
def wipe_mouth(d): d.rectangle((428,251,470,267),fill=P)
def raise_brow(im,box,dy):
    x0,y0,x1,y1=box; strip=im.crop(box); d=Blocky(im,S)
    d.rectangle((x0,y0+dy+(y1-y0),x1,y1),fill=P); im.paste(strip,(x0,y0+dy))

def neutral(): return new()[0]
def happy():
    im,d=new()
    for x in (404,466): stamp(im,x,231,['.mmmmmmmm.'],PAL,S)                       # cheeks push up: a soft crease under each eye
    wipe_mouth(d)
    stamp(im,431,254,['L........L','.llllllll.','..tttttt..','...llll...'],PAL,S)   # a gentle open smile
    return im
def laugh():
    im,d=new()
    eye=['..nnnnnnnn..','.neeeeeeeen.','neeeddddeeen','needeeeedeen','nedeeeeeedeen','ndeeeeeeeedn','.neeeeeeeen.','..nmmmmmmn..']
    for x in (400,462): stamp(im,x,208,eye,PAL,S)                                  # eyes squeezed shut
    wipe_mouth(d)
    stamp(im,431,254,['L........L','.llllllll.','.tttttttt.','..oooooo..','...oggo...'],PAL,S)
    return im
def surprised():
    im,d=new()
    raise_brow(im,(409,194,435,202),-6); raise_brow(im,(460,198,484,204),-6)
    wipe_mouth(d)
    stamp(im,446,256,['.LL.','LooL','.LL.'],PAL,S)
    return im
def annoyed():
    im,d=new()
    d.rectangle((409,194,435,202),fill=P); d.rectangle((460,198,484,204),fill=P)
    stamp(im,408,195,['ddd.....','..ddd...','....ddd.','.....ddd'],PAL,S); stamp(im,462,198,['.....ddd','....ddd.','..ddd...','ddd.....'],PAL,S)
    wipe_mouth(d)
    stamp(im,437,257,['lllllll','L.....L'],PAL,S)
    return im
def smirk():
    im,d=new()
    raise_brow(im,(409,194,435,202),-6)
    wipe_mouth(d)
    stamp(im,437,258,['lllllll'],PAL,S); stamp(im,458,254,['.lll','lL..'],PAL,S)
    return im
KINDS=[neutral,happy,laugh,surprised,annoyed,smirk]
if __name__=='__main__':
    box=(385,185,515,285); Z=3
    W,H=(box[2]-box[0])*Z,(box[3]-box[1])*Z
    q=Image.new('RGB',(W*3,H*2))
    for i,f in enumerate(KINDS): q.paste(f().crop(box).resize((W,H),Image.NEAREST),((i%3)*W,(i//3)*H))
    q.save('mara_zoom.png')
