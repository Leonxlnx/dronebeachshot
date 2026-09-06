from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
root=Path('/workspace/sites/last-light-bay')
p=Path(__file__).resolve().parent
rows=[]
for family,source_dir in [('island',p.parent/'tree-impostors-corrected'),('syringa',p.parent/'syringa-restored-atlas')]:
 atlas=np.array(Image.open(root/'public/assets/impostors'/f'{family}-albedo.png').convert('RGBA'))
 normal=np.array(Image.open(root/'public/assets/impostors'/f'{family}-normal.png').convert('RGBA'))
 alpha_equal=np.array_equal(atlas[:,:,3],normal[:,:,3]);views=[]
 for row,elevation in enumerate([0,35,70]):
  for col in range(8):
   raw_file=source_dir/(family+'-raw')/f'az-{col}-el-{elevation}-albedo-linear.png'
   if not raw_file.exists():continue
   raw=np.array(Image.open(raw_file).convert('RGBA'),dtype=np.float64)
   sums=raw.reshape(256,4,256,4,4).sum(axis=(1,3))
   a=sums[:,:,3]
   linear=np.divide(sums[:,:,:3],a[:,:,None],out=np.zeros_like(sums[:,:,:3]),where=a[:,:,None]>0)
   srgb=np.where(linear<=.0031308,linear*12.92,1.055*np.maximum(linear,0)**(1/2.4)-.055)
   expected=np.empty((256,256,4),dtype=np.uint8);expected[:,:,:3]=np.floor(np.clip(srgb,0,1)*255+.5);expected[:,:,3]=np.floor(a/16+.5)
   cell=atlas[row*256:(row+1)*256,col*256:(col+1)*256]
   delta=np.abs(expected.astype(int)-cell.astype(int))
   covered=cell[:,:,3]>0
   views.append({'azimuth':col*45,'elevation':elevation,'differentChannels':int((delta!=0).sum()),'maximumByteDifference':int(delta.max()),'coveredPixels':int(covered.sum())})
 c=atlas[:,:,:3]/255.;linear=np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4);alpha=atlas[:,:,3]/255.;mean=(linear*alpha[:,:,None]).sum(axis=(0,1))/alpha.sum()
 rows.append({'family':family,'albedoNormalAlphaEqual':alpha_equal,'atlasSHA256':hashlib.sha256((root/'public/assets/impostors'/f'{family}-albedo.png').read_bytes()).hexdigest(),'alphaWeightedLinearRGB':mean.tolist(),'alphaAreaPixels':float(alpha.sum()),'rawLinearReconstruction':views})
report={'method':'Read-only reconstruction of published atlas RGB from retained native linear RGBA readback. Decode at runtime should occur once; alpha-weighted means are linear.', 'families':rows}
(p/'atlas-color-proof.json').write_text(json.dumps(report,indent=2)+'\n')
for r in rows:print(r['family'],'views',len(r['rawLinearReconstruction']),'maxByteDifference',max([v['maximumByteDifference'] for v in r['rawLinearReconstruction']],default=None),'meanLinearRGB',r['alphaWeightedLinearRGB'],'alphaEqual',r['albedoNormalAlphaEqual'])
