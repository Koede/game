import os
# Bram's expressions: hand-placed shapes in 4 px blocks on bram.jpg (coordinates read off zoomed crops).
from PIL import Image
from px import Blocky, stamp, brow_split
SRC=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','bram.jpg'); S=4
D=(26,14,16); LIPD=(76,43,38); TG=(176,86,80); WHITE=(246,243,238); BROWN=(70,50,46)
BANDS=((124,80,66),(140,90,72),(160,108,84),(178,122,94))
def new():
    im=Image.open(SRC).convert('RGB'); return im,Blocky(im,S)
def raise_brow(im,box,dy=-4):
    """Lift a brow strip by dy px; the gap becomes lid skin."""
    x0,y0,x1,y1=box; strip=im.crop(box); d=Blocky(im,S)
    d.rectangle((x0,y1+dy,x1,y1),fill=(146,92,72)); d.rectangle((x0,y1-4,x1,y1),fill=(118,72,60))
    im.paste(strip,(x0,y0+dy))

def neutral(): return new()[0]
PAL={'m':(130,84,68),'s':(170,114,88),'d':(26,14,16),'c':(112,66,52)}
def happy():
    im,d=new()
    for x in (398,459): stamp(im,x,206,['..cccccc..'],PAL)            # cheeks push up: a crease under each eye
    d.polygon([(428,256),(436,260),(436,268),(430,264)],fill=D); d.polygon([(472,256),(464,260),(464,268),(470,264)],fill=D)
    d.rectangle((432,260,468,268),fill=WHITE); d.rectangle((432,260,468,262),fill=D)
    d.chord((430,262,470,284),0,180,fill=(40,22,24))
    return im
def laugh():
    im,d=new()
    eye=['mmmmmmmmmm','mmmddddmmm','mmdmmmmdmm','mdssssssdm','ssssssssss']
    for x in (398,459): stamp(im,x,194,eye,PAL)                         # eyes squeezed shut
    d.chord((430,258,470,284),0,180,fill=(36,18,22)); d.chord((440,268,460,284),0,180,fill=TG)
    d.rectangle((434,260,466,265),fill=WHITE)
    return im
def surprised():
    im,d=new()
    raise_brow(im,(396,180,444,200)); raise_brow(im,(456,180,504,200))
    d.ellipse((442,260,462,280),fill=(30,16,18)); d.chord((446,270,458,280),0,180,fill=TG)
    return im
def annoyed():
    im,d=new()
    brow_split(im,(396,180,444,200),0,8); brow_split(im,(456,180,504,200),0,8)   # inner ends pulled down in a stepped slant
    for x0 in (400,461): d.rectangle((x0,200,x0+36,204),fill=D)                    # narrowed lids
    d.rectangle((432,262,468,266),fill=LIPD)
    return im
def smirk():
    im,d=new()
    raise_brow(im,(396,180,444,200))
    d.rectangle((461,198,497,204),fill=(110,60,48))
    d.rectangle((432,262,450,266),fill=LIPD); d.line((466,266,472,258),fill=D,width=4)
    return im
KINDS=[neutral,happy,laugh,surprised,annoyed,smirk]
if __name__=='__main__':
    box=(385,160,515,290); Z=3
    W,H=(box[2]-box[0])*Z,(box[3]-box[1])*Z
    q=Image.new('RGB',(W*3,H*2))
    for i,f in enumerate(KINDS): q.paste(f().crop(box).resize((W,H),Image.NEAREST),((i%3)*W,(i//3)*H))
    q.save('bram_zoom.png')
