"""Bake an authored alpine heightfield and compress CC0 surface textures.
Requires numpy and Pillow. Runtime uses the baked assets, not this script.
"""
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/landing/alpine'
N = 401
x,z=np.meshgrid(np.linspace(-700,700,N),np.linspace(-650,650,N))
def noise(x,z):
    ix,iz=np.floor(x),np.floor(z)
    u,v=x-ix,z-iz
    u=u*u*(3-2*u); v=v*v*(3-2*v)
    def h(a,b): return np.mod(np.sin(a*127.1+b*311.7)*43758.5453,1)
    return (h(ix,iz)*(1-u)+h(ix+1,iz)*u)*(1-v)+(h(ix,iz+1)*(1-u)+h(ix+1,iz+1)*u)*v
def peak(cx,cz,rx,rz,h,phase):
    dx,dz=(x-cx)/rx,(z-cz)/rz
    r=np.hypot(dx,dz); angle=np.arctan2(dz,dx)
    # Asymmetric radial buttresses; progressively smaller incisions down the face.
    ribs=np.abs(np.sin(angle*3+phase+noise(x*.008,z*.008)*.65))
    ribs2=np.abs(np.sin(angle*7+r*1.4+phase))
    envelope=np.maximum(0,1-r*(1+.20*ribs+.07*ribs2))
    shape=h*envelope**1.28
    gullies=(1-np.abs(2*noise(x*.025+noise(z*.008,x*.008),z*.025)-1))
    shape-=envelope*(1-envelope)*(gullies*28+noise(x*.08,z*.08)*11)
    return shape
# Hero summit right of composition, shoulder left, overlapping background ridges.
peaks=[(95,-115,310,300,395,.2),(-125,-200,290,270,285,1.3),
       (345,-280,300,310,315,2.1),(-370,-350,340,270,270,.8),
       (20,-460,260,250,340,2.4),(515,-460,240,220,260,1.5),
       (-390,225,250,300,160,1.8),(400,280,240,260,145,.7)]
y=np.full_like(x,9.)
for args in peaks:y=np.maximum(y,peak(*args)+9)
# A glacial tongue into the foreground; broad smooth snow with carved transverse crevasses.
center=-45+20*np.sin(z*.009)
w=23+np.clip((z+120)*.12,0,42)
glacier=np.exp(-((x-center)/w)**4)*np.clip((z+220)/130,0,1)*np.clip((300-z)/160,0,1)
valley=27+np.maximum(0,200-z)*.20
crevasse=(np.maximum(0,np.sin(z*.18+x*.012))**24)*2.8
cut=np.minimum(y,valley-crevasse)
y=y*(1-glacier*.88)+cut*glacier*.88
# Fine rock relief below the snow; retain broad crisp ridges.
y+=(noise(x*.19,z*.19)-.5)*2.5*np.clip(y/50,0,1)
y=np.maximum(0,y)
OUT.mkdir(parents=True,exist_ok=True)
np.round(y/512*65535).astype('<u2').tofile(OUT/'massif.u16')
for name in ['rock_01_diff','rock_01_bump','snow_02_bump']:
    src=OUT/(name+'.jpg')
    if src.exists():
        Image.open(src).save(OUT/(name+'.webp'),quality=88,method=6)
print('heightfield',N,'x',N,'range',round(y.min(),2),round(y.max(),2))
for p in sorted(OUT.glob('*')):
    if p.suffix!='.jpg':print(p.name,p.stat().st_size)
