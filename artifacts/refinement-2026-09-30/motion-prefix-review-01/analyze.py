from pathlib import Path
from PIL import Image
import numpy as np
from scipy.signal import fftconvolve
from scipy.ndimage import map_coordinates
import hashlib,json,datetime
root=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent
film=root/'artifacts/refinement-2026-09-30/motion-11-full-flight'
m=json.loads((out/'manifest-snapshot.json').read_text())
frames=m['frames']
records=[]; previous=None
# Use 160x90 analysis arrays only. User-facing visual inspection uses original PNGs.
def local_match(a,b):
 h,w=a.shape; result=[]
 for cy in (20,45,70):
  for cx in (20,50,80,110,140):
   y0,y1=cy-11,cy+11; x0,x1=cx-11,cx+11
   p=a[y0:y1,x0:x1]; region=b[y0-8:y1+8,x0-8:x1+8]
   centered=p-p.mean(); energy=np.sum(centered**2)
   if energy<.0001: continue
   ones=np.ones_like(p); sums=fftconvolve(region,ones,mode='valid'); sums2=fftconvolve(region**2,ones,mode='valid')
   denom=np.sqrt(np.maximum(sums2-sums*sums/p.size,1e-10)*energy)
   corr=fftconvolve(region,centered[::-1,::-1],mode='valid')/denom
   yy,xx=np.unravel_index(np.argmax(corr),corr.shape)
   dy=dx=0.
   if 0<yy<16:
    den=corr[yy-1,xx]-2*corr[yy,xx]+corr[yy+1,xx]
    if abs(den)>1e-9: dy=float(np.clip(.5*(corr[yy-1,xx]-corr[yy+1,xx])/den,-.5,.5))
   if 0<xx<16:
    den=corr[yy,xx-1]-2*corr[yy,xx]+corr[yy,xx+1]
    if abs(den)>1e-9: dx=float(np.clip(.5*(corr[yy,xx-1]-corr[yy,xx+1])/den,-.5,.5))
   sy=yy-8+dy; sx=xx-8+dx
   gy,gx=np.mgrid[y0:y1,x0:x1]
   q=map_coordinates(b,[gy+sy,gx+sx],order=1,mode='nearest')
   residual=np.abs(p-q)
   result.append({'center':[cx,cy],'dx':sx,'dy':sy,'correlation':float(corr[yy,xx]),'mae':float(residual.mean()),'p95':float(np.quantile(residual,.95)),'signedLuma':float((q-p).mean())})
 return result
for f in frames:
 path=film/f['path']; raw=path.read_bytes(); sha=hashlib.sha256(raw).hexdigest()
 assert sha==f['sha256'],f'Hash mismatch {path}'
 im=Image.open(path).convert('RGB'); assert im.size==(640,360)
 rgb=np.asarray(im.resize((160,90),Image.Resampling.BOX),dtype=np.float32)/255
 y=np.einsum('ijk,k->ij',rgb,np.array([.2126,.7152,.0722],dtype=np.float32))
 rec={'index':f['index'],'time':f['time'],'path':f['path'],'hashVerified':True,'meanRGB':rgb.mean(axis=(0,1)).tolist(),'meanLuma':float(y.mean()),'lumaStd':float(y.std()),'edgeMean':float((np.abs(np.diff(y,axis=0)).mean()+np.abs(np.diff(y,axis=1)).mean())/2),'camera':f['stats']['camera']}
 if previous is not None:
  a=previous; patches=local_match(a,y)
  maes=np.array([p['mae'] for p in patches]); shifts=np.array([(p['dx']**2+p['dy']**2)**.5 for p in patches])
  rec.update(rawMAE=float(np.abs(y-a).mean()),rawP95=float(np.quantile(np.abs(y-a),.95)),signedLuma=float((y-a).mean()),motionMAE=float(np.mean(maes)),motionMedianMAE=float(np.median(maes)),motionMaxPatchMAE=float(maes.max()),motionMedianPixels=float(np.median(shifts)),patches=patches)
 records.append(rec); previous=y
for i,r in enumerate(records):
 if i==0: continue
 for key in ('rawMAE','motionMAE','motionMaxPatchMAE'):
  nearby=np.array([q[key] for j,q in enumerate(records[max(1,i-8):min(len(records),i+9)],start=max(1,i-8)) if j!=i])
  med=float(np.median(nearby)); mad=float(np.median(np.abs(nearby-med)))
  r[key+'LocalMedian']=med
  r[key+'RobustZ']=(r[key]-med)/max(1.4826*mad,.00015)
result={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':{'frames':len(frames),'firstIndex':frames[0]['index'],'lastIndex':frames[-1]['index'],'firstTime':frames[0]['time'],'lastTime':frames[-1]['time'],'nominalFullFrames':480,'sourceIdentity':m['build']['sourceIdentity'],'snapshotSha256':hashlib.sha256((out/'manifest-snapshot.json').read_bytes()).hexdigest()},'method':{'integrity':'SHA-256 every manifest-listed PNG, 640x360 dimensions','analysisArray':'160x90 BOX RGB; Rec.709 luma from encoded sRGB values (display luminance proxy, not radiometric)','motionNormalization':'15 local 22x22 patches, +/-8-pixel normalized correlation search and subpixel quadratic peak; bilinear translated residual','limits':'Patch translation does not fully compensate perspective, rotation, parallax, water/cloud motion or occlusions. Statistics flag candidates, not confirmed artifacts. No GPU, browser or active-capture modification.'},'frames':records}
(out/'metrics.json').write_text(json.dumps(result,indent=2))
for key in ('rawMAE','motionMAE','motionMAERobustZ','motionMaxPatchMAERobustZ'):
 print(key)
 for r in sorted(records[1:],key=lambda q:q[key],reverse=True)[:10]: print(r['index'],r['time'],round(r[key],5),round(r['rawMAE'],5),round(r['motionMAE'],5),round(r['signedLuma'],5),round(r['motionMedianPixels'],2))
