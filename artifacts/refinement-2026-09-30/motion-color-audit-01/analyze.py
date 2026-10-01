from pathlib import Path
import os
os.environ['OPENBLAS_NUM_THREADS']='1'
os.environ['OMP_NUM_THREADS']='1'
import subprocess,json,hashlib,datetime,struct
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[3];out=Path(__file__).resolve().parent
smoke=root/'artifacts/refinement-2026-09-30/motion-prefix-encoder-smoke-01'
e=json.loads((smoke/'export-result.json').read_text());m=json.loads((smoke/'manifest-snapshot.json').read_text())
video=smoke/e['video']['path']; assert hashlib.sha256(video.read_bytes()).hexdigest()==e['video']['sha256']
n=e['selectedFrames'];w=e['width'];h=e['height'];frames=m['frames'][:n]
source=[]
for f in frames:
 p=Path(e['captureDirectory'])/f['path'];raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==f['sha256']
 im=Image.open(p).convert('RGB');assert im.size==(w,h);source.append(np.asarray(im))
source=np.stack(source)
commands=[]
def decode(fmt,filter_=None):
 args=['ffmpeg','-hide_banner','-loglevel','error','-threads','2','-filter_threads','2','-i',str(video),'-map','0:v:0','-frames:v',str(n),'-an','-sn','-dn']
 if filter_: args+=['-vf',filter_]
 args+=['-threads','2','-pix_fmt',fmt,'-f','rawvideo','pipe:1']
 p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60,check=True)
 assert not p.stderr,p.stderr.decode();commands.append(args)
 return p.stdout
probe=subprocess.run(['ffprobe','-v','error','-threads','2','-show_streams','-show_format','-of','json',str(video)],stdout=subprocess.PIPE,check=True,timeout=30)
probe=json.loads(probe.stdout);(out/'ffprobe-observed.json').write_text(json.dumps(probe,indent=2)+'\n')
def metrics(decoded):
 diff=decoded.astype(np.int16)-source.astype(np.int16); absolute=np.abs(diff)
 mse=float(np.mean(diff.astype(np.float32)**2))
 regions={}
 for name,(ys,xs) in {'sky':(slice(0,60),slice(280,640)),'water':(slice(140,340),slice(320,620)),'forest':(slice(100,320),slice(20,180))}.items():
  d=diff[:,ys,xs,:];regions[name]={'meanRGBBias':d.mean(axis=(0,1,2)).tolist(),'MAE':float(np.mean(np.abs(d)))}
 return {'MAE':float(absolute.mean()),'RMSE':float(mse**.5),'PSNRdB':float(10*np.log10(255**2/mse)),'absoluteErrorMedian':float(np.median(absolute)),'absoluteErrorP95':float(np.quantile(absolute,.95)),'absoluteErrorP99':float(np.quantile(absolute,.99)),'absoluteErrorMaximum':int(absolute.max()),'meanRGBBias':diff.mean(axis=(0,1,2)).tolist(),'fractionChannelErrorsOver5':float(np.mean(absolute>5)),'regions':regions}
results={};default_hash=None
for name,filter_ in [('default',None),('explicit_bt601_limited','scale=in_color_matrix=bt601:in_range=limited:out_range=full'),('explicit_bt709_limited','scale=in_color_matrix=bt709:in_range=limited:out_range=full'),('explicit_bt601_full','scale=in_color_matrix=bt601:in_range=full:out_range=full')]:
 raw=decode('rgb24',filter_);assert len(raw)==n*w*h*3
 arr=np.frombuffer(raw,dtype=np.uint8).reshape(n,h,w,3)
 digest=hashlib.sha256(raw).hexdigest()
 if name=='default':default_hash=digest
 results[name]={'decodedRGBSHA256':digest,'identicalToDefault':digest==default_hash,**metrics(arr)}
raw=decode('yuv420p');stride=w*h*3//2;assert len(raw)==stride*n
native_y=np.stack([np.frombuffer(raw[i*stride:i*stride+w*h],dtype=np.uint8).reshape(h,w) for i in range(n)])
y_proof={}
for name,coeff in [('bt601',[.299,.587,.114]),('bt709',[.2126,.7152,.0722])]:
 prediction=16+219*np.einsum('nhwc,c->nhw',source,np.array(coeff))/255
 error=native_y-prediction
 y_proof[name]={'nativeEncodedYVersusSourceFormulaMAE':float(np.mean(np.abs(error))),'meanSignedError':float(error.mean()),'RMSE':float(np.sqrt(np.mean(error**2)))}
source_file=root/'src/render/engine.ts';source_text=source_file.read_text()
result={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':{'video':str(video),'videoSHA256':e['video']['sha256'],'frames':n,'duration':n/24,'width':w,'height':h,'sourceIdentity':e['sourceIdentity'],'allSourceHashesVerified':True},'units':'RGB code values 0..255; no perceptual DeltaE or browser display measurement','observedColorMetadata':{key:probe['streams'][0].get(key,'absent') for key in ['color_range','color_space','color_transfer','color_primaries','chroma_location']},'sourceColorManagement':{'engineSHA256':hashlib.sha256(source_file.read_bytes()).hexdigest(),'explicitSRGBOutput':'renderer.outputColorSpace=THREE.SRGBColorSpace' in source_text,'toneMappingACES':'renderer.toneMapping=THREE.ACESFilmicToneMapping' in source_text,'screenshotPNGHasNoSRGBGammaICCChunk':True},'roundtrip':results,'nativeLumaMatrixEvidence':y_proof,'commands':commands,'limitations':['Only actual existing 12-frame 0.5-second smoke clip decoded.','No browser/player playback, display colorimeter, or transfer-aware color managed player tested.','Default and forced-matrix decoded comparisons quantify this local FFmpeg build, not unknown player behavior.','No new video created, no active render/exporter/encoder modified. Raw decoded samples stayed in process memory.']}
(out/'metrics.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['observedColorMetadata','roundtrip','nativeLumaMatrixEvidence']},indent=2))
