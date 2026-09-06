from pathlib import Path
root=Path('/workspace/sites/last-light-bay/src')
d=Path('cloud-volume-study')
s=(d/'clouds-before.ts').read_text().replace("'./math'", repr(str(root/'world/math.ts'))).replace("'./weather'", repr(str(root/'world/weather.ts')))
(d/'clouds-before-runtime.ts').write_text(s)
a=(d/'atmosphere-before.ts').read_text()
for name,relative in [('materials','render/materials.ts'),('refraction','render/refraction.ts'),('sky-lighting','render/sky-lighting.ts')]:a=a.replace("'../render/"+name+"'",repr(str(root/relative)))
a=a.replace("'three'",repr('/workspace/sites/last-light-bay/node_modules/three/build/three.module.js'))
a=a.replace("'./clouds'","'./clouds-before-runtime.ts'")
(d/'atmosphere-before-runtime.ts').write_text(a)
old='float n3(vec3 p){float a=floor(p.y),f=fract(p.y);f=f*f*(3.-2.*f);return mix(noise(p.xz+a*vec2(7.7,19.3)),noise(p.xz+(a+1.)*vec2(7.7,19.3)),f);}'
new='uniform highp sampler3D uCloudNoise;\nfloat n3(vec3 p){vec3 lattice=floor(p),f=fract(p);f=f*f*(3.-2.*f);return textureLod(uCloudNoise,(lattice+f+.5)/128.,0.).r;}'
assert old in s
s=s.replace(old,new)
(d/'clouds-volume-runtime.ts').write_text(s)
a=a.replace("'./clouds-before-runtime.ts'","'./clouds-volume-runtime.ts'")
a="import {createCloudNoiseTexture} from './cloud-noise.ts';\n"+a
a=a.replace('const group=new THREE.Group();','const cloudNoise=createCloudNoiseTexture();const group=new THREE.Group();',1)
a=a.replace('uniforms:{uSun:', 'uniforms:{uCloudNoise:{value:cloudNoise},uSun:',1)
a=a.replace('reflectionMaterial.uniforms.uSceneCaptureScale=sceneCaptureScale;', 'reflectionMaterial.uniforms.uCloudNoise=material.uniforms.uCloudNoise;reflectionMaterial.uniforms.uSceneCaptureScale=sceneCaptureScale;')
a=a.replace('uniforms:{uTime:{value:0},uSun:solarDirection', 'uniforms:{uCloudNoise:material.uniforms.uCloudNoise,uTime:{value:0},uSun:solarDirection')
a=a.replace('12.,128.','12.,256.').replace('i<128','i<256')
a=a.replace('function dispose(){','function dispose(){cloudNoise.dispose();')
(d/'atmosphere-volume-runtime.ts').write_text(a)
