import pathlib,json,numpy as np
from verify_render import load,render
R=pathlib.Path(__file__).resolve().parents[1];src=load(R/'source/tree_small_02_1k.gltf')[0];far=load(R/'optimized/syringa-tree-far.glb')[0];leaf=next(p for p in far if 'canopy_bake'in p[-1]['name']);positions=leaf[0];original=positions.copy();quad=original.reshape(-1,4,3);center=quad.mean(axis=1,keepdims=True)
dirs=[('front',(0.,.18,1.75)),('side',(1.75,.18,0.)),('elevated',(1.,.85,1.2)),('diagonal',(.9,.18,1.5))];reference={name:int((np.array(render(src,di,(400,400)).getchannel('A'))>0).sum()) for name,di in dirs};log=[]
for scale in [.78,.82,.86,.90]:
 positions[:]=(center+(quad-center)*scale).reshape(-1,3)
 r={'scale':scale,'coverage':{name:float((np.array(render(far,di,(400,400)).getchannel('A'))>0).sum()/reference[name]) for name,di in dirs}};log.append(r);print(r,flush=True)
(R/'far-calibration.json').write_text(json.dumps(log,indent=2)+'\n')
