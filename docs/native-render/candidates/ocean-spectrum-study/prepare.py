from pathlib import Path
import random,math,json,re
root=Path('/workspace/sites/last-light-bay/src');folder=Path('ocean-spectrum-study')
s=(root/'world/ocean.ts').read_text();(folder/'ocean-before.ts').write_text(s)
r=random.Random(61481);waves=[]
for i in range(64):
 k=math.exp(math.log(.65)+(math.log(42/.65))*(i+.15+.7*r.random())/64)
 angle=max(-1.15,min(1.15,r.gauss(0,.53)))
 waves.append(dict(k=k,angle=angle,phase=r.random()*math.tau,weight=(k/.65)**(-.26)))
norm=math.sqrt(sum(w['weight']**2 for w in waves)*.5)
for w in waves:w['slopeAmplitude']=w['weight']/norm*.138564
start=s.index(' // Non-harmonic wavenumbers')
end=s.index(' slope+=micro*ripples;',start)
lines=[' // Deterministic broad directional spectrum: many independent components', ' // remain within each visible band after footprint filtering. Total unfiltered', ' // slope RMS is preserved at0.138564; height/runup/foam geometry is unchanged.', ' vec2 ripples=vec2(0.);']
for w in waves:
 lines.append(' ripples+=windRipple(p,t,pixelDx,pixelDy,along*cos(%.8f)+across*sin(%.8f),%.8f,%.8f,%.8f);'%(w['angle'],w['angle'],w['k'],w['slopeAmplitude'],w['phase']))
candidate=s[:start]+'\n'.join(lines)+'\n'+s[end:]
(folder/'ocean-spectrum.ts').write_text(candidate)
def runtime(source):
 source=source.replace("'three'",repr('/workspace/sites/last-light-bay/node_modules/three/build/three.module.js'))
 return re.sub(r"from '([.][.]/render/|[.]/)([^']+)'",lambda m:'from '+repr(str(root/('render' if m[1].startswith('..') else 'world')/(m[2]+'.ts'))),source)
(folder/'ocean-before-runtime.ts').write_text(runtime(s));(folder/'ocean-spectrum-runtime.ts').write_text(runtime(candidate))
(folder/'spectrum.json').write_text(json.dumps({'seed':61481,'components':waves,'slopeRMS':math.sqrt(sum(w['slopeAmplitude']**2 for w in waves)*.5)},indent=2))
h=Path('render-ocean-groups.mjs').read_text().replace('./ocean-groups/ocean-before-runtime.ts','./ocean-spectrum-study/ocean-before-runtime.ts').replace('./ocean-groups/ocean-candidate-runtime.ts','./ocean-spectrum-study/ocean-spectrum-runtime.ts').replace("native-render/ocean-groups'","native-render/ocean-spectrum-study'")
h=h.replace('for(const mode of [0,10])','for(const mode of [0])')
# A sun-facing view exposes the repeated glitter pattern directly.
h=h.replace("{name:'aerial',position:new THREE.Vector3(0,225,-180),target:new THREE.Vector3(0,0,70),time:5}","{name:'aerial',position:new THREE.Vector3(-125,70,96),target:new THREE.Vector3(-170,25,-80),time:9}")
Path('render-ocean-spectrum.mjs').write_text(h)
