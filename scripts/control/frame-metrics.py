import json,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageOps,ImageDraw,ImageFilter
import sys
folder=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/baseline')
files=sorted(folder.glob('*.png'));rows=[];thumbs=[]
for p in files:
 im=Image.open(p).convert('RGB');a=np.asarray(im,dtype=float)/255;mx=a.max(2);mn=a.min(2);lum=a@np.array([.2126,.7152,.0722]);sat=np.divide(mx-mn,mx,out=np.zeros_like(mx),where=mx>0)
 small=np.asarray(im.resize((32,32)).convert('L'));phash=''.join('1' if x>small.mean() else '0' for x in small.flat)
 rows.append({'path':str(p),'width':im.width,'height':im.height,'meanLuminance':float(lum.mean()),'blackPercentage':float((mx<.02).mean()*100),'clippedHighlightPercentage':float((mn>.985).mean()*100),'meanSaturation':float(sat.mean()),'detailDensity':float(np.abs(np.diff(lum,axis=1)).mean()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'perceptualBits':phash})
 tile=Image.new('RGB',(480,294),'#142226');tile.paste(ImageOps.fit(im,(480,270)),(0,0));ImageDraw.Draw(tile).text((8,276),p.stem,fill='white');thumbs.append(tile)
for i,a in enumerate(rows):
 a['closestOtherSimilarity']=max([1-sum(x!=y for x,y in zip(a['perceptualBits'],b['perceptualBits']))/1024 for j,b in enumerate(rows) if i!=j] or [0])
(folder/'frame-metrics.json').write_text(json.dumps(rows,indent=2)+'\n')
if thumbs:
 sheet=Image.new('RGB',(1920,294*((len(thumbs)+3)//4)),'#142226')
 for i,t in enumerate(thumbs):sheet.paste(t,((i%4)*480,(i//4)*294))
 sheet.save(folder/'contact-sheet.jpg',quality=94)
print(json.dumps({'frames':len(rows),'exactDuplicates':len(rows)-len({r['sha256'] for r in rows}),'note':'Metrics detect errors; they do not establish artistic quality.'}))
