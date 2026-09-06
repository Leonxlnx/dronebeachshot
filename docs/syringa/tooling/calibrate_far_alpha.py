import pathlib,json,numpy as np
from PIL import Image
from verify_render import load,render
R=pathlib.Path(__file__).resolve().parents[1];src=load(R/'source/tree_small_02_1k.gltf')[0];far=load(R/'optimized/syringa-tree-far.glb')[0];i=next(i for i,p in enumerate(far) if 'canopy_bake'in p[-1]['name']);leaf=list(far[i]);leaf[0][:]=np.array(json.load(open(R/'far-canopy.json'))['positions']);original=np.array(Image.open(R/'optimized/far-canopy-unthinned.png').convert('RGBA'));noise=np.random.default_rng(82461).random(original.shape[:2]);dirs=[('front',(0.,.18,1.75)),('side',(1.75,.18,0.)),('elevated',(1.,.85,1.2)),('diagonal',(.9,.18,1.5))];reference={name:int((np.array(render(src,di,(400,400)).getchannel('A'))>0).sum()) for name,di in dirs};log=[]
for keep in [.55,.65,.75,.85]:
 atlas=original.copy();atlas[:,:,3][noise>keep]=0;leaf[4]=Image.fromarray(atlas);far[i]=tuple(leaf);r={'keep':keep,'coverage':{name:float((np.array(render(far,di,(400,400)).getchannel('A'))>0).sum()/reference[name]) for name,di in dirs}};log.append(r);print(r,flush=True)
(R/'far-alpha-calibration.json').write_text(json.dumps(log,indent=2)+'\n')
