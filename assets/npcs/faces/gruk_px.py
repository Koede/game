import os
# Gruk's expressions: hand-placed blocks on gruk.jpg. His mouth is the dark band above the white teeth row (y 207-216); the V under
# his nose (y 178-200) is the nose. His eyes are the tiny gold slits at y 163-170 under the brow mass.
from PIL import Image
from px import Blocky, stamp
SRC=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','gruk.jpg'); S=4
SKIN=(112,146,68); SKIN_D=(82,114,54); DK=(28,26,22); TG=(150,62,58); WH=(240,232,206); GOLD=(150,100,20)
def new():
    im=Image.open(SRC).convert('RGB'); return im,Blocky(im,S)

def neutral(): return new()[0]
def happy():
    im,d=new()
    for x in (424,477): stamp(im,x,172,['.cccccc.'],{'c':SKIN_D})            # cheeks push up under the eyes
    d.polygon([(440,205),(444,201),(474,201),(478,205),(478,210),(440,210)],fill=DK)    # the mouth opens into a grin above the teeth
    return im
def laugh():
    im,d=new()
    for x in (424,477):
        d.rectangle((x-2,164,x+20,174),fill=SKIN_D)                                                    # old eye out
        stamp(im,x,166,['.dddd.','d....d'],{'d':(24,28,20)})                                          # eyes shut: a dark arch under the brow
    d.polygon([(438,206),(444,198),(474,198),(480,206),(480,210),(438,210)],fill=DK)
    d.ellipse((452,203,468,212),fill=TG)
    return im
def surprised():
    im,d=new()
    d.rectangle((420,160,446,164),fill=SKIN); d.rectangle((474,160,498,164),fill=SKIN)                  # brows lifted: the brow's lower edge goes back to skin
    stamp(im,424,164,['wwww','wgww'],{'w':WH,'g':GOLD}); stamp(im,477,164,['wwww','wwgw'],{'w':WH,'g':GOLD})   # eyes wide open
    d.ellipse((450,196,470,212),fill=DK)
    return im
def annoyed():
    im,d=new()
    stamp(im,438,160,['dddd','dddd'],{'d':(24,24,22)}); stamp(im,466,160,['dddd','dddd'],{'d':(24,24,22)})   # inner brows dip toward the nose
    d.rectangle((422,164,444,168),fill=(24,24,22)); d.rectangle((476,164,496,168),fill=(24,24,22))          # eyes hooded to slits
    d.rectangle((440,204,478,210),fill=DK)                                                                  # teeth bared under a flat dark lip
    return im
def smirk():
    im,d=new()
    d.rectangle((422,164,444,168),fill=(24,24,22))                                                          # one eye hooded
    d.polygon([(460,206),(466,200),(480,198),(480,210),(460,210)],fill=DK)                                  # grin on one side
    return im
KINDS=[neutral,happy,laugh,surprised,annoyed,smirk]
if __name__=='__main__':
    box=(405,140,515,225); Z=3
    W,H=(box[2]-box[0])*Z,(box[3]-box[1])*Z
    q=Image.new('RGB',(W*3,H*2))
    for i,f in enumerate(KINDS): q.paste(f().crop(box).resize((W,H),Image.NEAREST),((i%3)*W,(i//3)*H))
    q.save('gruk_zoom.png')
