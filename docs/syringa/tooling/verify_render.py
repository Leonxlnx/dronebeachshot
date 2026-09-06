"""Independent GLB/material/image inspection and CPU raster render; does not use glTF Transform."""
import io,json,struct,pathlib,hashlib,numpy as np
from PIL import Image,ImageDraw
ROOT=pathlib.Path(__file__).resolve().parents[1]
from numba import njit
def load(p):
 if p.suffix=='.glb':
  data=p.read_bytes();assert data[:4]==b'glTF';assert struct.unpack_from('<I',data,8)[0]==len(data);n=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+n]);bl,bt=struct.unpack_from('<II',data,20+n);assert bt==0x004e4942;bufs=[data[28+n:28+n+bl]]
 else:j=json.loads(p.read_text());bufs=[(p.parent/b['uri']).read_bytes() for b in j['buffers']]
 if p.suffix=='.glb':
  assert 'EXT_texture_webp'in j.get('extensionsRequired',[])
  assert all(not any(k in n for k in ['matrix','translation','rotation','scale']) for n in j['nodes'])
 def accessor(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5122:'<i2',5121:'u1',5120:'i1'}[a['componentType']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];return np.ndarray((a['count'],n),dtype=dt,buffer=bufs[v['buffer']],offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dt).itemsize*n),np.dtype(dt).itemsize)).copy()
 def image(i):
  t=j['textures'][i];imidx=t.get('source',t.get('extensions',{}).get('EXT_texture_webp',{}).get('source'));im=j['images'][imidx]
  if 'uri'in im:b=(p.parent/im['uri']).read_bytes()
  else:v=j['bufferViews'][im['bufferView']];b=bufs[v['buffer']][v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
  return Image.open(io.BytesIO(b)).convert('RGBA'),imidx,hashlib.sha256(b).hexdigest()
 prim=[];evidence=[]
 for mi,m in enumerate(j['materials']):
  mats={'materialIndex':mi,'name':m['name'],'alphaMode':m.get('alphaMode','OPAQUE'),'alphaCutoff':m.get('alphaCutoff',.5),'doubleSided':m.get('doubleSided',False),'textures':[]}
  slots={**m.get('pbrMetallicRoughness',{}),**m}
  for slot in ['baseColorTexture','metallicRoughnessTexture','normalTexture','occlusionTexture']:
   if slot not in slots:continue
   info=slots[slot];im,ii,sha=image(info['index']);a=np.array(im.getchannel('A'));mats['textures'].append({'slot':slot,'textureIndex':info['index'],'imageIndex':ii,'size':list(im.size),'encodedSha256':sha,'alphaMin':int(a.min()),'alphaMax':int(a.max()),'alphaUnique':len(np.unique(a)),'alphaBelowCutoff':float((a<255*mats['alphaCutoff']).mean())})
   assert p.suffix!='.glb' or max(im.size)<=1024
   if 'leaves'in m['name'] and slot=='baseColorTexture' and p.suffix=='.glb':
    assert mats['alphaMode']=='MASK' and mats['doubleSided'];assert a.min()==0 and a.max()==255;assert .10<(a<115).mean()<.90
    source=Image.open(ROOT/'source/textures/tree_small_02_leaves_diff_1k.png').convert('RGBA');mats['alphaEqualsSourceRgba']=bool(np.array_equal(a,np.array(source.getchannel('A'))));assert mats['alphaEqualsSourceRgba']
   if 'canopy_bake'in m['name'] and slot=='baseColorTexture':
    assert mats['alphaMode']=='MASK' and mats['doubleSided'];assert a.min()==0 and a.max()==255;assert .1<(a<115).mean()<.99
    bake=Image.open(ROOT/'optimized/far-canopy-atlas.png').convert('RGBA');mats['alphaEqualsBakedRgba']=bool(np.array_equal(a,np.array(bake.getchannel('A'))));assert mats['alphaEqualsBakedRgba']
  evidence.append(mats)
 for mesh in j['meshes']:
  for a in mesh['primitives']:
   pos=accessor(a['attributes']['POSITION']);ind=accessor(a['indices']).flatten() if 'indices'in a else np.arange(len(pos));assert np.isfinite(pos).all() and ind.max()<len(pos)
   mat=j['materials'][a['material']];info=mat['pbrMetallicRoughness']['baseColorTexture'];im,_,_=image(info['index']);uvset=info.get('extensions',{}).get('KHR_texture_transform',{}).get('texCoord',info.get('texCoord',0))
   if p.suffix=='.gltf' and 'leaves' in mat['name']:im=Image.open(ROOT/'source/textures/tree_small_02_leaves_diff_1k.png').convert('RGBA');mat={**mat,'alphaMode':'MASK','alphaCutoff':.45}
   prim.append((pos,accessor(a['attributes']['NORMAL']),accessor(a['attributes'][f'TEXCOORD_{uvset}']),ind,im,info,mat))
 allpos=np.concatenate([x[0] for x in prim]);rootpts=np.unique(allpos[allpos[:,1]<.01],axis=0);bounds=[allpos.min(axis=0).tolist(),allpos.max(axis=0).tolist()]
 return prim,{'file':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'triangles':sum(len(x[3])//3 for x in prim),'bounds':bounds,'nodes':j['nodes'],'materials':evidence,'rootVertices':rootpts.tolist(),'extensionsRequired':j.get('extensionsRequired',[]),'nodeTransformsIdentity':all(not any(k in n for k in ['matrix','translation','rotation','scale']) for n in j['nodes'])}
@njit(cache=True)
def raster(screen,norm,uv,indices,texture,cutoff,factor,depth,pixels):
 h,w=pixels.shape[:2];th,tw=texture.shape[:2]
 light=np.array([-.4,.8,1.]);light/=np.linalg.norm(light)
 for ti in range(len(indices)//3):
  i0,i1,i2=indices[ti*3:ti*3+3];a=screen[i0];b=screen[i1];c=screen[i2]
  den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-9:continue
  minx=max(0,int(np.floor(min(a[0],b[0],c[0]))));maxx=min(w-1,int(np.ceil(max(a[0],b[0],c[0]))))
  miny=max(0,int(np.floor(min(a[1],b[1],c[1]))));maxy=min(h-1,int(np.ceil(max(a[1],b[1],c[1]))))
  for y in range(miny,maxy+1):
   for x in range(minx,maxx+1):
    wa=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den
    wb=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den;wc=1-wa-wb
    if min(wa,wb,wc)<0:continue
    z=wa*a[2]+wb*b[2]+wc*c[2]
    if z>=depth[y,x]:continue
    weights=np.array([wa/a[3],wb/b[3],wc/c[3]]);weights/=weights.sum()
    texuv=weights[0]*uv[i0]+weights[1]*uv[i1]+weights[2]*uv[i2]
    tx=(texuv[0]%1)*(tw-1);ty=(texuv[1]%1)*(th-1)
    xx=int(tx);yy=int(ty);fx=tx-xx;fy=ty-yy;xx1=min(xx+1,tw-1);yy1=min(yy+1,th-1)
    col=texture[yy,xx]*(1-fx)*(1-fy)+texture[yy,xx1]*fx*(1-fy)+texture[yy1,xx]*(1-fx)*fy+texture[yy1,xx1]*fx*fy
    if col[3]<cutoff*255:continue
    normal=weights[0]*norm[i0]+weights[1]*norm[i1]+weights[2]*norm[i2];nn=np.linalg.norm(normal)
    if nn>0:normal/=nn
    if den>0:normal=-normal
    lighting=.60+.3*max(normal[1],0.)+.90*max(np.dot(normal,light),0.)
    for k in range(3):
     linear=((col[k]/255)*factor[k])**2.2*lighting;pixels[y,x,k]=int(255*(linear/(linear+.60))**(1/2.2))
    pixels[y,x,3]=255;depth[y,x]=z

def render(prim,direction=(.9,.18,1.5),size=(650,650)):
 center=np.array([.15,2.25,.75]);span=4.7
 eye=center+np.array(direction)*span;f=center-eye;f/=np.linalg.norm(f);right=np.cross(f,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,f);view=np.eye(4);view[:3,:3]=np.stack([right,up,-f]);view[:3,3]=-view[:3,:3]@eye
 w,h=size;near=.01;far=1000;pers=np.zeros((4,4));s=1/np.tan(np.deg2rad(35)/2);pers[0,0]=s/(w/h);pers[1,1]=s;pers[2,2]=(far+near)/(near-far);pers[2,3]=2*far*near/(near-far);pers[3,2]=-1
 pixels=np.zeros((h,w,4),dtype=np.uint8);pixels[:,:,:3]=[189,207,212];depth=np.full((h,w),np.inf)
 for pos,norm,uv,ind,im,info,mat in prim:
  hom=np.concatenate([pos,np.ones((len(pos),1))],axis=1)@(pers@view).T;screen=hom.copy();screen[:,:3]/=hom[:,3,None];screen[:,0]=(screen[:,0]+1)*w/2;screen[:,1]=(1-screen[:,1])*h/2
  transform=info.get('extensions',{}).get('KHR_texture_transform',{});tuv=uv*np.array(transform.get('scale',[1,1]))+np.array(transform.get('offset',[0,0]));factor=np.array(mat['pbrMetallicRoughness'].get('baseColorFactor',[1,1,1,1])[:3]);cutoff=mat.get('alphaCutoff',.5) if mat.get('alphaMode')=='MASK' else 0.
  raster(screen,norm.astype('f8'),tuv,ind.astype('i8'),np.array(im).astype('f8'),cutoff,factor,depth,pixels)
 return Image.fromarray(pixels)
if __name__=='__main__':
 records=[];canvas=Image.new('RGB',(1300,1380),'#d9e2e1');masks=[]
 for k,lod in enumerate(['source','hero','medium','far']):
  file=ROOT/'source/tree_small_02_1k.gltf' if lod=='source' else ROOT/f'optimized/syringa-tree-{lod}.glb';prim,rec=load(file);im=render(prim);im.save(ROOT/f'optimized/{lod}-render.png');masks.append(np.array(im.getchannel('A'))>0);canvas.paste(im.convert('RGB'),(k%2*650,k//2*690+40));ImageDraw.Draw(canvas).text((k%2*650+12,k//2*690+14),f"{lod}: {rec['triangles']:,} triangles",fill='black');records.append(rec);print(lod,rec['triangles'],rec['bounds'],flush=True)
 canvas.save(ROOT/'optimized/lod-comparison.png')
 for rec,m in zip(records,masks):rec['rasterCoveragePixels']=int(m.sum());rec['coverageVsSource']=float(m.sum()/masks[0].sum());rec['silhouetteIoU']=float((m&masks[0]).sum()/(m|masks[0]).sum())
 for rec in records[1:]:
  rec['rootVerticesEqualSource']=rec['rootVertices']==records[0]['rootVertices'];assert rec['rootVerticesEqualSource']
 (ROOT/'verification.json').write_text(json.dumps(records,indent=2)+'\n')
