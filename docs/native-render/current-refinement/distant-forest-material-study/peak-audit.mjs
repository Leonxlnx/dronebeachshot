import fs from 'node:fs/promises';import crypto from 'node:crypto';
import {continuationHeight as h} from './heights.ts';
import {sampleCamera} from './src/camera/cinematic.ts';
const perimeter=[];for(let x=-600;x<600;x+=2)perimeter.push([x,-800]);for(let z=-800;z<800;z+=2)perimeter.push([600,z]);for(let x=600;x>-600;x-=2)perimeter.push([x,800]);for(let z=800;z>-800;z-=2)perimeter.push([-600,z]);
const rings=[0];for(const [end,step] of [[64,4],[448,8],[1472,16],[4032,32],[8000,48]]){for(let r=rings.at(-1)+step;r<end;r+=step)rings.push(r);if(rings.at(-1)!==end)rings.push(end);}
let max=-Infinity,point=null,over425=0;for(const r of rings){const scale=1+r/800;for(const [x,z] of perimeter){const px=x*scale,pz=z*scale,y=Math.fround(h(px,pz));if(y>425)over425++;if(y>max){max=y;point=[Math.fround(px),y,Math.fround(pz)];}}}
const start=sampleCamera(0),result={method:'Exhaustive maximum of actual annulus Float32 vertex heights; linear triangles cannot exceed their highest vertex.',vertices:perimeter.length*rings.length,maxHeight:max,maxPoint:point,verticesAbove425:over425,exceeds425:max>425,excessAbove425:max-425,startCamera:start,terrainSHA256:crypto.createHash('sha256').update(await fs.readFile('./src/world/terrain.ts')).digest('hex')};await fs.writeFile('peak-proof.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
