"""Bake source broadleaf canopy into spatial crossed cards at original coordinates."""
import pathlib,json,numpy as np
from PIL import Image
from verify_render import load,raster
ROOT=pathlib.Path(__file__).resolve().parents[1]
# Reuse the independent alpha-correct rasterizer, but bake source albedo without lighting.
import inspect
from numba import njit
code=inspect.getsource(raster.py_func).replace('def raster(','def raster_albedo(').replace("linear=((col[k]/255)*factor[k])**2.2*lighting;pixels[y,x,k]=int(255*(linear/(linear+.60))**(1/2.2))","pixels[y,x,k]=int(col[k]*factor[k])")
exec('@njit\n'+code.split('\n',1)[1] if code.startswith('@') else '@njit\n'+code)
prim,_=load(ROOT/'source/tree_small_02_1k.gltf');leaf=[p for p in prim if 'leaves'in p[-1]['name']][0];pos,norm,uv,ind,im,info,mat=leaf
tris=ind.reshape(-1,3);centers=pos[tris].mean(axis=1)
# Pick a voxel size giving a near-1k complete far asset; 2 planes = 4 triangles per cell.
lo=centers.min(axis=0);candidate=[]
for step in np.linspace(.30,.80,26):
 keys=np.floor((centers-lo)/step).astype(int);unq,inv=np.unique(keys,axis=0,return_inverse=True);candidate.append((abs(len(unq)-180),step,unq,inv))
_,step,keys,groups=min(candidate,key=lambda a:a[0]);assert len(keys)*2<=441
order=np.argsort(groups);splits=np.searchsorted(groups[order],np.arange(len(keys)+1));atlas=np.zeros((1008,1008,4),dtype=np.uint8);vertices=[];normals=[];uvs=[];indices=[];cells=[]
for cell in range(len(keys)):
 selected=tris[order[splits[cell]:splits[cell+1]]];unique,remap=np.unique(selected,return_inverse=True);pp=pos[unique];nn=norm[unique];tt=uv[unique];ii=remap.flatten().astype('i8');low=pp.min(axis=0);high=pp.max(axis=0);center=(low+high)/2
 for view in range(2):
  axis=0 if view==0 else 2;depthaxis=2 if view==0 else 0;span=np.array([max(high[axis]-low[axis],.03),max(high[1]-low[1],.03)])*1.03;size=48;pad=2;pixels=np.zeros((size,size,4),dtype=np.uint8);depth=np.full((size,size),np.inf)
  screen=np.ones((len(pp),4));screen[:,0]=(pp[:,axis]-center[axis])/span[0]*(size-pad*2)+size/2;screen[:,1]=size/2-(pp[:,1]-center[1])/span[1]*(size-pad*2);screen[:,2]=-pp[:,depthaxis]
  raster_albedo(screen,nn.astype('f8'),tt.astype('f8'),ii,np.array(im).astype('f8'),.45,np.ones(3),depth,pixels)
  tile=cell*2+view;x=tile%21*size;y=tile//21*size;atlas[y:y+size,x:x+size]=pixels
  # Include border padding in geometry; alpha keeps cell cards invisible outside source leaves.
  span*=size/(size-pad*2);coords=[]
  for xoff,yoff in [(-1,1),(1,1),(1,-1),(-1,-1)]:
   p=center.copy();p[axis]+=span[0]/2*xoff;p[1]+=span[1]/2*yoff;coords.append(p.tolist())
  base=len(vertices);vertices+=coords;n=[0.,0.,0.];n[depthaxis]=1.;normals += [n]*4;uvs += [[x/1008,y/1008],[(x+size)/1008,y/1008],[(x+size)/1008,(y+size)/1008],[x/1008,(y+size)/1008]];indices += [base,base+2,base+1,base,base+3,base+2]
 cells.append({'center':center.tolist(),'sourceTriangles':len(selected)})
from scipy.ndimage import distance_transform_edt
mask=atlas[:,:,3]==0;dist,nearest=distance_transform_edt(mask,return_indices=True);fill=mask&(dist<=2);atlas[:,:,:3][fill]=atlas[nearest[0][fill],nearest[1][fill],:3]
Image.fromarray(atlas).save(ROOT/'optimized/far-canopy-unthinned.png')
noise=np.random.default_rng(82461).random(atlas.shape[:2]);atlas[:,:,3][noise>.68]=0
Image.fromarray(atlas).save(ROOT/'optimized/far-canopy-atlas.png')
(ROOT/'far-canopy.json').write_text(json.dumps({'positions':vertices,'normals':normals,'uvs':uvs,'indices':indices,'cellCount':len(keys),'voxelStep':step,'cells':cells,'source':'tree_small_02 source foliage; RGBA diffuse; alpha cutoff 0.45; two orthogonal albedo bakes per spatial cell'}))
print('baked',len(keys),'cells',len(indices)//3,'triangles',flush=True)
