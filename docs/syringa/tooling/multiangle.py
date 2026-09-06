import pathlib,json,numpy as np
from PIL import Image,ImageDraw
from verify_render import load,render
R=pathlib.Path(__file__).resolve().parents[1]
dirs=[('front',(0.,.18,1.75)),('side',(1.75,.18,0.)),('elevated',(1.,.85,1.2))];lods=['source','hero','medium','far'];loaded={}
for lod in lods:loaded[lod]=load(R/'source/tree_small_02_1k.gltf' if lod=='source' else R/f'optimized/syringa-tree-{lod}.glb')[0]
canvas=Image.new('RGB',(1600,1290),'#d9e2e1');metrics=[]
for row,(view,direction) in enumerate(dirs):
 masks=[]
 for col,lod in enumerate(lods):
  im=render(loaded[lod],direction,(400,400));m=np.array(im.getchannel('A'))>0;masks.append(m);canvas.paste(im.convert('RGB'),(col*400,row*430+30));ImageDraw.Draw(canvas).text((col*400+10,row*430+10),f'{view} / {lod}',fill='black')
  if col:metrics.append({'view':view,'lod':lod,'coverageVsSource':float(m.sum()/masks[0].sum()),'silhouetteIoU':float((m&masks[0]).sum()/(m|masks[0]).sum())})
 print(view,flush=True)
canvas.save(R/'optimized/multiangle-comparison.png');(R/'multiangle-verification.json').write_text(json.dumps(metrics,indent=2)+'\n')
