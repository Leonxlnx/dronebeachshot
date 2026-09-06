import json
import numpy as np
from pathlib import Path
p=Path(__file__).parent
results={}
for variant in ['before','candidate']:
 rgb=np.fromfile(p/f'aniso1-sampler-{variant}-linear.bin',dtype=np.float32).reshape(1024,1024,4)[:,:,:3].astype(float)
 y=rgb@np.array([.2126,.7152,.0722])
 def corr(a,b):return float(np.corrcoef(a.ravel(),b.ravel())[0,1])
 dx=np.diff(y,axis=1);dy=np.diff(y,axis=0)
 results[variant]={'meanLuminance':float(y.mean()),'stdLuminance':float(y.std()),'meanRGB':rgb.mean((0,1)).tolist(),'tilePeriodCorrelationX':corr(y[:,:-128],y[:,128:]),'tilePeriodCorrelationY':corr(y[:-128],y[128:]),'gradientRMS':float(np.sqrt((np.mean(dx**2)+np.mean(dy**2))/2)),'laplacianRMS':float(np.sqrt(np.mean((y[1:-1,:-2]+y[1:-1,2:]+y[:-2,1:-1]+y[2:,1:-1]-4*y[1:-1,1:-1])**2))),'maxMeanRowGradient':float(np.max(np.mean(abs(dy),axis=1))),'medianMeanRowGradient':float(np.median(np.mean(abs(dy),axis=1)))}
results['interpretation']='Actual scene-linear sampler output over8x8tiles. One full source tile=128px=5.7483m. Period correlation identifies coherent source repetition. Gradient/Laplacian RMS are detail-retention evidence, not proof of all image quality or physical reflectance.'
(p/'aniso1-sampler-measurements.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
