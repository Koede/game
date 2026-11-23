import os
# Orrin's expressions: hand-placed blocks on orrin.jpg (coordinates read off zoomed crops; his mouth is the teeth sliver under the moustache).
from PIL import Image
from px import Blocky, stamp, brow_split
SRC=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','orrin.jpg'); S=4
SRC=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','orrin.jpg')
D=(44,20,18); LIP=(150,80,64); LIPB=(172,102,72); WHITE=(246,240,230); TG=(190,96,88); SKIN=(237,176,138)
PAL={'m':(222,150,120),'s':(236,172,136),'d':(56,28,22),'c':(196,116,92)}
def new():
    im=Image.open(SRC).convert('RGB'); return im,Blocky(im,S)
def raise_brow(im,box,dy=-4):
    x0,y0,x1,y1=box; strip=im.crop(box); d=Blocky(im,S)
    d.rectangle((x0,y1+dy,x1,y1),fill=SKIN); d.rectangle((x0,y1-4,x1,y1),fill=(226,160,128))
    im.paste(strip,(x0,y0+dy))
LB=(400,164,440,184); RB=(460,164,500,184)

def neutral(): return new()[0]
def happy():
    im,d=new()
    for x in (402,466): stamp(im,x,204,['.cccccc.'],PAL)                        # cheeks push up: a crease under each eye
    d.rectangle((431,247,469,252),fill=WHITE); d.rectangle((431,247,469,248),fill=D)
    d.rectangle((428,244,432,248),fill=D); d.rectangle((468,244,472,248),fill=D); d.rectangle((434,252,466,255),fill=LIP)
    return im
def laugh():
    im,d=new()
    eye=['mmmmmmmm','mmmddmmm','mmdmmdmm','mdssssdm','ssssssss']
    for x in (402,466): stamp(im,x,188,eye,PAL)                                  # eyes squeezed shut
    d.chord((435,244,465,260),0,180,fill=(60,24,24)); d.chord((444,252,456,260),0,180,fill=TG)
    d.rectangle((434,247,466,251),fill=WHITE)
    return im
def surprised():
    im,d=new()
    raise_brow(im,LB,-8); raise_brow(im,RB,-8)
    d.ellipse((442,246,462,262),fill=(60,24,24)); d.chord((447,255,457,262),0,180,fill=TG)
    return im
def annoyed():
    im,d=new()
    brow=['dddd......','ddddddd...','..ddddddd.','....ddddd.','......dd..']
    for x0,x1,flip in ((400,440,False),(460,500,True)):
        d.rectangle((x0,166,x1,188),fill=(212,146,120))                     # old brow out, lid skin in
        rows=[r[::-1] for r in brow] if flip else brow
        stamp(im,x0,168,rows,{'d':(56,32,28)})                               # new brow slanting down to the nose, in blocks
    d.rectangle((402,191,434,195),fill=(40,20,18)); d.rectangle((466,191,498,195),fill=(40,20,18))
    d.rectangle((434,247,466,253),fill=LIPB); d.rectangle((434,250,466,251),fill=LIP)
    return im
def smirk():
    im,d=new()
    raise_brow(im,LB)
    d.rectangle((466,188,498,196),fill=(214,132,106)); d.rectangle((466,196,498,198),fill=D)
    d.rectangle((432,247,448,252),fill=LIPB); d.line((466,250,470,247,474,243),fill=LIP,width=4)
    return im
KINDS=[neutral,happy,laugh,surprised,annoyed,smirk]
if __name__=='__main__':
    box=(385,150,515,280); Z=3
    W,H=(box[2]-box[0])*Z,(box[3]-box[1])*Z
    q=Image.new('RGB',(W*3,H*2))
    for i,f in enumerate(KINDS): q.paste(f().crop(box).resize((W,H),Image.NEAREST),((i%3)*W,(i//3)*H))
    q.save('orrin_zoom.png')
