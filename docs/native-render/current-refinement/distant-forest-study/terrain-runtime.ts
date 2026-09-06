import {renderedTerrainHeight} from '/workspace/sites/last-light-bay/src/world/terrain-surface.ts';
import * as THREE from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {terrainHeight,terrainSlope,shoreDistance,shoreZ,noise,fbm,rng} from '/workspace/sites/last-light-bay/src/world/math.ts';
import {type Textures} from '/workspace/sites/last-light-bay/src/render/materials.ts';
import {createGroundMaterial,createRockMaterial} from '/workspace/sites/last-light-bay/src/render/ground-materials.ts';
// Continuous distant terrain. The central 48 tiles and shared coastal math
// remain untouched; all additional heights live outside their rectangle.
const continuationClamp = (v:number) => Math.max(0, Math.min(1, v));
const continuationSmooth = (a:number,b:number,v:number) => {
 const t=continuationClamp((v-a)/(b-a));return t*t*(3-2*t);
};
function continuationOutsideDistance(x:number,z:number) {
 return Math.hypot(Math.max(0,Math.abs(x)-600),Math.max(0,Math.abs(z)-800));
}
function continuationShore(x:number) {
 // shoreZ is intentionally parabolic inside the authored bay. Continuing its
 // x² term forever would turn distant water into an enormous rising land wall.
 if(Math.abs(x)<=600)return shoreZ(x);
 const side=Math.sign(x),edge=side*600,u=Math.abs(x)-600;
 const edgeSlope=(-.0047*edge+.156*Math.cos(edge*.013)+.16*Math.cos(edge*.032))*side;
 const bendLength=620;
 const tangentBend=edgeSlope*bendLength*(1-Math.exp(-u/bendLength));
 const outerTrend=.075*(u-bendLength*(1-Math.exp(-u/bendLength)));
 const meander=(noise(x*.0008,side*7.13)-noise(edge*.0008,side*7.13))*320
  *continuationSmooth(50,700,u);
 return shoreZ(edge)+tangentBend+outerTrend+meander;
}
function continuationRegionalHeight(x:number,z:number) {
 const coast=continuationShore(x);
 const coastSlope=(continuationShore(x+2)-continuationShore(x-2))*.25;
 const marineDistance=(z-coast)/Math.sqrt(1+coastSlope*coastSlope);
 if(marineDistance<0)return Math.max(-85,marineDistance*.16);
 // Inland ranges must not amplify every metre-scale wiggle of the beach
 // normal across kilometres. Use a regional coast tangent for inland relief.
 const regionalSlope=(continuationShore(x+160)-continuationShore(x-160))/320;
 const inland=(z-coast)/Math.sqrt(1+regionalSlope*regionalSlope);
 const distance=continuationOutsideDistance(x,z);
 // Match actual radial resolution: 16/32/48 m bands have physical intervals
 // up to 20/40/60 m. Trough 2-sigma support is at least six intervals;
 // finer crest/sidewall relief fades before the coarser mesh band begins.
 const radial=(Math.max(Math.abs(x)/600,Math.abs(z)/800)-1)*800;
 const medium=continuationSmooth(1000,1472,radial);
 const far=continuationSmooth(3400,4032,radial);
 const channelSupport=60+60*medium+60*far;
 const nearDetail=1-continuationSmooth(1000,1450,radial);
 const along=x+(noise(x*.00063,z*.00059)-.5)*220;
 const warp=(noise(x*.0012+6.3,z*.0012-2.8)-.5)*180;
 let mountain=0;
 for(let ridge=0;ridge<3;ridge++){
  const seed=13.7+ridge*19.3;
  const center=340+ridge*610+(noise(along*.00077,seed)-.5)*210;
  const width=350+ridge*120+noise(along*.00093,seed+7.2)*100;
  const crest=260+ridge*57+noise(along*.00059,seed+3.4)*125
   +(noise(along*.0022,seed+9.1)-.5)*100
   +(noise(along*.0042,seed+11.2)-.5)*125*nearDetail;
  const across=inland-center+warp;
  const radius=Math.abs(across)/width;
  const profile=Math.exp(-1.45*Math.pow(radius,1.65));
  const upstream=continuationClamp((across/width+1.5)/1.5);
  const drainU=along+85*noise(inland*.0014,seed+2.1);
  const cell=Math.floor(drainU/500);let channel=0;
  for(let neighbour=-1;neighbour<=1;neighbour++){
   const id=cell+neighbour;
   const mouth=(id+.18+.64*noise(id*.87,seed+4.8))*500;
   const bend=(noise(inland*.0016+id*.37,seed)-.5)*150;
   const trunk=mouth+bend;
   const channelWidth=channelSupport+25*(1-upstream);
   const delta=drainU-trunk;
   let cut=Math.exp(-.5*delta*delta/(channelWidth*channelWidth));
   const fork=continuationSmooth(.28,.98,upstream);
   for(let branch=-1;branch<=1;branch+=2){
    const tributary=trunk+branch*fork*(130+noise(id,seed+branch)*90);
    const d=drainU-tributary,w=channelSupport+20*(1-upstream);
    cut=Math.max(cut,Math.exp(-.5*d*d/(w*w))*.58*fork);
   }
   channel=Math.max(channel,cut);
  }
  const face=continuationSmooth(-1.75,-.65,across/width)
   *(1-continuationSmooth(-.20,.30,across/width));
  const eroded=crest*profile*(1-.46*channel*face);
  const k=35,h=Math.max(k-Math.abs(mountain-eroded),0)/k;
  mountain=Math.max(mountain,eroded)+h*h*k*.25;
 }
 const foothills=14+32*noise(along*.0022,z*.0017);
 const reliefMask=continuationSmooth(35,160,mountain);
 const fractured=(noise(x*.0026+6.2,z*.0023-3.8)-.5)*90*(1-far)
  +(noise(x*.0013-2.7,z*.0012+4.3)-.5)*70
  +((noise(x*.0050+1.3,z*.0038-6.7)-.5)*95
   +(noise(x*.0037-4.1,z*.0048+2.9)-.5)*70)*nearDetail;
 const resolved=1-continuationSmooth(3500,6500,distance);
 const coastalRise=continuationSmooth(10,100,inland);
 return Math.min(inland*.022,28)+coastalRise*Math.max(foothills,
  mountain+fractured*reliefMask*resolved);
}
function continuationHeight(x:number,z:number) {
 const distance=continuationOutsideDistance(x,z);
 const core=terrainHeight(x,z);
 // Exact values (and an undisturbed normal neighborhood) at all existing edges.
 if(distance<=28)return core;
 const transition=continuationSmooth(28,180,distance);
 const fullRegional=continuationRegionalHeight(x,z);
 // Actual wide views exposed a wall when a 500 m regional ridge was blended
 // only 180 m beyond the core. Build foothills first; major relief belongs far
 // behind the authored bay, with a broad natural rise into those ranges.
 const regional=fullRegional<0?fullRegional:Math.min(fullRegional,28)
  +Math.max(0,fullRegional-28)*continuationSmooth(250,1600,distance);
 const joined=core+(regional-core)*transition;
 const ringDistance=(Math.max(Math.abs(x)/600,Math.abs(z)/800)-1)*800;
 const fadeStart=6350+noise(x*.00065,z*.00065)*350;
 const edgeFade=continuationSmooth(fadeStart,7900,ringDistance);
 // Every final perimeter vertex lies at -85 m. The rectangle never silhouettes.
 return joined+(-85-joined)*edgeFade;
}
function createCoastalContinuation(t:Textures) {
 const perimeter:Array<[number,number]>=[];
 // Every 2 m vertex on the existing 1,200 × 1,600 m tile boundary occurs once.
 // A shared indexed ring then replaces independently overlapping plane strips.
 for(let x=-600;x<600;x+=2)perimeter.push([x,-800]);
 for(let z=-800;z<800;z+=2)perimeter.push([600,z]);
 for(let x=600;x>-600;x-=2)perimeter.push([x,800]);
 for(let z=800;z>-800;z-=2)perimeter.push([-600,z]);
 const rings=[0];
 const bands:Array<[number,number]>=[[64,4],[448,8],[1472,16],[4032,32],[8000,48]];
 for(const [end,step] of bands){
  for(let r=rings[rings.length-1]+step;r<end;r+=step)rings.push(r);
  if(rings[rings.length-1]!==end)rings.push(end);
 }
 const count=perimeter.length,vertices=count*rings.length;
 const positions=new Float32Array(vertices*3),colors=new Float32Array(vertices*3);
 for(let ring=0;ring<rings.length;ring++){
  const scale=1+rings[ring]/800;
  for(let i=0;i<count;i++){
   const x=perimeter[i][0]*scale,z=perimeter[i][1]*scale,index=(ring*count+i)*3;
   positions.set([x,continuationHeight(x,z),z],index);
   const c=.84+noise(x*.06,z*.06)*.16;colors.set([c,c,c],index);
  }
 }
 const indices=new Uint32Array((rings.length-1)*count*6);let cursor=0;
 for(let ring=0;ring<rings.length-1;ring++)for(let i=0;i<count;i++){
  const next=(i+1)%count,a=ring*count+i,b=ring*count+next,c=a+count,d=b+count;
  indices.set([a,b,c,c,b,d],cursor);cursor+=6;
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 geometry.setIndex(new THREE.BufferAttribute(indices,1));
 geometry.computeVertexNormals();
 // Keep the existing mesh normals exactly in the 28 m core collar. Beyond
 // it, a physical 4-12 m central difference samples the continuous height,
 // instead of averaging long skinny radial triangles across whole slopes.
 // The existing underwater normals are retained.
 const normals=geometry.getAttribute('normal') as THREE.BufferAttribute;
 for(let i=0;i<vertices;i++){
  const x=positions[i*3],z=positions[i*3+2],distance=continuationOutsideDistance(x,z);
  if(distance<=28||positions[i*3+1]<=0)continue;
  const step=4+8*continuationSmooth(180,4000,distance);
  const dx=(continuationHeight(x+step,z)-continuationHeight(x-step,z))/(2*step);
  const dz=(continuationHeight(x,z+step)-continuationHeight(x,z-step))/(2*step);
  const length=Math.hypot(dx,1,dz),blend=continuationSmooth(28,120,distance);
  const nx=normals.getX(i)*(1-blend)-dx/length*blend;
  const ny=normals.getY(i)*(1-blend)+1/length*blend;
  const nz=normals.getZ(i)*(1-blend)-dz/length*blend;
  const normalized=Math.hypot(nx,ny,nz);normals.setXYZ(i,nx/normalized,ny/normalized,nz/normalized);
 }
 geometry.computeBoundingSphere();
 const material=createGroundMaterial(t);
 const baseCompile=material.onBeforeCompile.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  baseCompile(shader,renderer);
  // Use the exact existing ground shader throughout the seam collar. Beyond it,
  // transition to broad forest/rock cover; the bay's unbounded shore GLSL must not
  // classify these distant ridges as sand. No image planes or flat backdrops.
  shader.fragmentShader=shader.fragmentShader.replace('diffuseColor.rgb*=ground;',`
   float extensionDistance=length(max(abs(gp.xz)-vec2(600.,800.),vec2(0.)));
   float extensionBlend=smoothstep(50.,220.,extensionDistance);
   float extensionCliff=smoothstep(.27,.59,1.-gn.y);
   float extensionVariation=.86+.28*fbm(gp.xz*.0053);
   // Preserve the actual common substrate scans and physical PBR response.
   // The former constant grey replaced the rock scan across the entire range.
   vec3 extensionForest=mix(soil,living,.82)*vec3(.42,.54,.34)*extensionVariation;
   vec3 extensionStone=stone*extensionVariation;
   vec3 extensionCover=mix(extensionForest,extensionStone,extensionCliff);
   float extensionBeach=1.-smoothstep(1.,10.,gp.y);
   extensionCover=mix(extensionCover,sand,extensionBeach);
   diffuseColor.rgb*=mix(ground,extensionCover,extensionBlend);
   // Keep roughness, normals and occlusion on the same distant substrates.
   // The unbounded core shoreline must not turn dry distant faces into sand.
   cliff=mix(cliff,extensionCliff,extensionBlend);
   moss=mix(moss,.82*(1.-extensionCliff),extensionBlend);
   sediment=mix(sediment,extensionBeach,extensionBlend);
   wet*=1.-extensionBlend;`);
 };
 material.customProgramCacheKey=()=> 'continuous-coastal-extension-v4-resolved-drainage-normals';
 const mesh=new THREE.Mesh(geometry,material);mesh.name='continuous-coastal-extension';
 mesh.receiveShadow=true;mesh.castShadow=true;
 mesh.userData.centralBoundaryVertices=count;
 mesh.userData.radialRings=rings.length;
 return mesh;
}

export function createTerrain(t:Textures){const group=new THREE.Group();group.name='land';const material=createGroundMaterial(t);const tileSize=200,segments=100;for(let tz=-4;tz<4;tz++)for(let tx=-3;tx<3;tx++){const g=new THREE.PlaneGeometry(tileSize,tileSize,segments,segments);g.rotateX(-Math.PI/2);g.translate(tx*tileSize+100,0,tz*tileSize+100);const p=g.attributes.position;const colors=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),h=terrainHeight(x,z);p.setY(i,h);const c=.84+noise(x*.06,z*.06)*.16;colors.set([c,c,c],i*3)}g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;mesh.castShadow=true;mesh.name=`terrain-${tx}-${tz}`;group.add(mesh)}
group.add(createCoastalContinuation(t));return group;}
function fracturedRockGeometry(variant:number) {
 const random=rng(3701+variant*191),points:THREE.Vector3[]=[];
 // Unequal bevels and two oblique joint planes form real planar fracture faces.
 // Flat normals belong to those faces; the original rock normal/ARM maps supply
 // smaller grain. No displaced spheres or painted cracks form the silhouette.
 const outline=[[-.68,-1],[.56,-1],[.97,-.62],[1,.51],[.59,1],[-.65,.92],[-1,.42],[-.94,-.61]];
 const leanX=(random()-.5)*.32,leanZ=(random()-.5)*.24;
 for(let ring=0;ring<3;ring++)for(const [ox,oz] of outline){
  const y=ring===0?-1:ring===1?-.08:.81;
  const width=ring===0?1.08:ring===1?1:.73+random()*.11;
  const x=ox*width+leanX*(y+1),z=oz*width+leanZ*(y+1);
  const joint=ring===2?x*.21-z*.13:ring===1?-x*.07+z*.05:0;
  points.push(new THREE.Vector3(x,y+joint,z));
 }
 const geometry=new ConvexGeometry(points);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function createRocks(t:Textures){
 const root=new THREE.Group();root.name='geology';
 const random=rng(978),dummy=new THREE.Object3D(),color=new THREE.Color();
 const material=createRockMaterial(t);
 const matrices:Array<THREE.Matrix4[]>=Array.from({length:6},()=>[]);
 const colors:Array<THREE.Color[]>=Array.from({length:6},()=>[]);
 let bedrockCount=0,talusCount=0,clusters=0;
 function place(variant:number,x:number,z:number,sx:number,sy:number,sz:number,yaw:number,embed:number){
  const h=renderedTerrainHeight(x,z);
  dummy.position.set(x,h-sy*embed,z);dummy.rotation.set(0,yaw,0);
  dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
  matrices[variant].push(dummy.matrix.clone());
  // Keep the scanned albedo; the previous .55–.76 instance multiplier made every
  // exposed face much darker than the adjacent terrain's identical rock map.
  const value=.88+random()*.1;color.setRGB(value*.99,value,value);
  colors[variant].push(color.clone());
 }
 // Outcrop strips follow the actual downslope face. Spacing limits geological
 // patches; adjacent slabs share a strike and form a jointed bedrock exposure.
 for(let gz=-5;gz<=11;gz++)for(let gx=-9;gx<=9;gx++){
  const x=gx*52+(random()-.5)*20,z=gz*52+(random()-.5)*20;
  const d=shoreDistance(x,z),h=renderedTerrainHeight(x,z);
  if(d<35||h<38||terrainSlope(x,z)<1.05||noise(x*.008+13.1,z*.008-4.7)<.43)continue;
  const dx=(renderedTerrainHeight(x+5,z)-renderedTerrainHeight(x-5,z))*.1;
  const dz=(renderedTerrainHeight(x,z+5)-renderedTerrainHeight(x,z-5))*.1;
  const length=Math.hypot(dx,dz);if(length<.8)continue;
  const nx=-dx/length,nz=-dz/length,tx=nz,tz=-nx;
  const yaw=Math.atan2(nx,nz)+(noise(x*.003,z*.003)-.5)*.24;
  const slabs=3+Math.floor(random()*3),width=5.5+random()*4.5;
  const height=17+random()*18;clusters++;
  for(let j=0;j<slabs;j++){
   const along=(j-(slabs-1)*.5)*width*1.48;
   const px=x+tx*along+nx*(random()-.5)*4,pz=z+tz*along+nz*(random()-.5)*4;
   if(shoreDistance(px,pz)<28||terrainSlope(px,pz)<.85)continue;
   const sy=height*(.82+random()*.32),sx=width*(.86+random()*.26),sz=7+random()*8;
   place((gx+gz+j+120)%6,px,pz,sx,sy,sz,yaw+(random()-.5)*.1,.82);bedrockCount++;
  }
 }
 // Talus is a small set of fractured blocks at coastal headlands. The open
 // central beach stays clear, and no independent boulders pepper inland slopes.
 for(let side=-1;side<=1;side+=2)for(let a=0;a<13;a++){
  const x=side*(185+a*24+(random()-.5)*14),edge=shoreZ(x);
  const derivative=-.0047*x+.156*Math.cos(x*.013)+.16*Math.cos(x*.032);
  const normalLength=Math.sqrt(1+derivative*derivative),nx=-derivative/normalLength,nz=1/normalLength;
  const d=-10+random()*21,centerX=x+nx*d,centerZ=edge+nz*d;
  const blocks=3+Math.floor(random()*4);
  for(let j=0;j<blocks;j++){
   const px=centerX+(random()-.5)*23,pz=centerZ+(random()-.5)*23;
   const sd=shoreDistance(px,pz);if(sd<-32||sd>28||Math.abs(px)<178)continue;
   const scale=1.5+Math.pow(random(),1.7)*5.5;
   place((a+j)%6,px,pz,scale*(.8+random()*.4),scale*(.6+random()*.35),scale,random()*Math.PI*2,.62);talusCount++;
  }
 }
 for(let variant=0;variant<6;variant++){
  if(!matrices[variant].length)continue;
  const mesh=new THREE.InstancedMesh(fracturedRockGeometry(variant),material,matrices[variant].length);
  mesh.name=`fractured-bedrock-${variant}`;
  matrices[variant].forEach((matrix,index)=>{mesh.setMatrixAt(index,matrix);mesh.setColorAt(index,colors[variant][index])});
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);
 }
 root.userData.geology={bedrockCount,talusCount,clusters};
 return root;
}
