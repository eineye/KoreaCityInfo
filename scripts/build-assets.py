"""Regenerate web + Android logo assets from docs/brand/logo-original.jpg.

Usage (from the repo root):  python3 scripts/build-assets.py
Requires Pillow and numpy. Crop boxes match the current logo layout (emblem on top, text below).
"""
import os
import numpy as np
from PIL import Image, ImageDraw

ORIGINAL = 'docs/brand/logo-original.jpg'
a = np.asarray(Image.open(ORIGINAL).convert('RGB')).astype(np.float32)
mn, mx = a.min(axis=2), a.max(axis=2)
# the original background is light grey: push low-saturation light pixels to pure white (soft ramp keeps anti-aliasing)
t = np.clip((mn - 215) / (240 - 215), 0, 1) * (mx - mn < 18)
src = Image.fromarray((a + (255 - a) * t[..., None]).round().astype(np.uint8))
A = 'www/assets/'
RES = 'android/app/src/main/res'
emblem=src.crop((281,22,1073,611)); logo=src.crop((15,18,1341,893))
def square(img,pad):
    s=int(max(img.size)*(1+pad)); c=Image.new('RGB',(s,s),'white'); c.paste(img,((s-img.width)//2,(s-img.height)//2)); return c
def fit(img,mw,mh):
    k=min(mw/img.width,mh/img.height); return img.resize((max(1,int(img.width*k)),max(1,int(img.height*k))),Image.LANCZOS)
# web
for n in (512,192): square(emblem,0.10).resize((n,n),Image.LANCZOS).save(f'{A}icon-{n}.png',optimize=True)
square(emblem,0.04).resize((96,96),Image.LANCZOS).save(A+'emblem.png',optimize=True)
square(emblem,0.04).resize((64,64),Image.LANCZOS).save(A+'favicon.png',optimize=True)
fit(logo,900,900).save(A+'logo.jpg',quality=88,optimize=True)
# android
def mask(n,shape):
    m=Image.new('L',(n,n),0); d=ImageDraw.Draw(m)
    (d.ellipse((0,0,n-1,n-1),fill=255) if shape=='round' else d.rounded_rectangle((0,0,n-1,n-1),radius=int(n*0.2),fill=255)); return m
for d in os.listdir(RES):
    p=os.path.join(RES,d)
    if d.startswith('mipmap-') and d!='mipmap-anydpi-v26':
        for name,shape,scale in (('ic_launcher','rect',0.74),('ic_launcher_round','round',0.66)):
            f=os.path.join(p,name+'.png'); n=Image.open(f).size[0]
            c=Image.new('RGB',(n,n),'white'); e=fit(emblem,n*scale,n*scale); c.paste(e,((n-e.width)//2,(n-e.height)//2))
            out=Image.new('RGBA',(n,n),(0,0,0,0)); out.paste(c,(0,0),mask(n,shape)); out.save(f,optimize=True)
        f=os.path.join(p,'ic_launcher_foreground.png'); n=Image.open(f).size[0]
        c=Image.new('RGBA',(n,n),(255,255,255,0)); e=fit(emblem,n*0.5,n*0.5).convert('RGBA'); c.paste(e,((n-e.width)//2,(n-e.height)//2)); c.save(f,optimize=True)
    sp=os.path.join(p,'splash.png')
    if os.path.exists(sp):
        w,h=Image.open(sp).size; c=Image.new('RGB',(w,h),'white'); l=fit(logo,w*0.72,h*0.5); c.paste(l,((w-l.width)//2,(h-l.height)//2)); c.save(sp,optimize=True)
print('ok')
