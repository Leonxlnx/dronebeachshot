// Isolated authoring proof. Production imports none of this module.
import * as THREE from 'three';

export const cropViews=Object.freeze([
 {time:9,name:'flight-9',fullWidth:512,fullHeight:288,x:371,y:0,width:64,height:64},
 {time:10.5,name:'flight-10_5',fullWidth:512,fullHeight:288,x:270,y:8,width:64,height:64},
]);

// Exact current inland/near preparation contract: source name order, local
// bbox-center subtraction, original single PBR material clone. Source node
// transforms are deliberately not baked, matching both production upgraders.
export function createEastOutcropStudy(source,proposal){
 const originals=[];source.traverse(object=>{if(object.isMesh){
  if(!object.material.isMeshStandardMaterial||Array.isArray(object.material))throw Error('Expected one source PBR material');
  originals.push(object);
 }});originals.sort((a,b)=>a.name.localeCompare(b.name));
 if(originals.length!==6||proposal.records.length!==3)throw Error('Unexpected source/proposal cohort');
 const material=originals[0].material.clone();material.name='east-study-original-rock-pbr';
 for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','side','roughness','metalness'])
  if(material[key]!==originals[0].material[key])throw Error('Source PBR preparation changed '+key);
 const group=new THREE.Group();group.name='ISOLATED-east-lower-three-source-study';
 const parts=proposal.records.map(record=>{
  const original=originals[record.variant];if(original.name!==record.source)throw Error('Source identity mismatch');
  const geometry=original.geometry.clone();geometry.computeBoundingBox();
  const center=geometry.boundingBox.getCenter(new THREE.Vector3()),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++)positions.setXYZ(i,positions.getX(i)-center.x,positions.getY(i)-center.y,positions.getZ(i)-center.z);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new THREE.InstancedMesh(geometry,material,1);mesh.name='east-study-source-'+record.variant;
  mesh.setMatrixAt(0,new THREE.Matrix4().fromArray(record.matrix));mesh.computeBoundingSphere();
  mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  return{mesh,record,original,center};
 });
 return{group,parts,material,originals};
}

// Exact core tile algorithm from createTerrain, restricted to existing tiles.
// It retains each tile's original boundary-normal neighborhood and 2 m grid.
export function createStudyTile(tx,tz,material,height,noise){
 const g=new THREE.PlaneGeometry(200,200,100,100);g.rotateX(-Math.PI/2);g.translate(tx*200+100,0,tz*200+100);
 const p=g.attributes.position,colors=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,height(x,z));const c=.84+noise(x*.06,z*.06)*.16;colors.set([c,c,c],i*3);}
 g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeVertexNormals();
 const mesh=new THREE.Mesh(g,material);mesh.name=`terrain-${tx}-${tz}`;mesh.castShadow=mesh.receiveShadow=true;return mesh;
}

export function setStudyCamera(camera,sample,view){
 camera.clearViewOffset();camera.aspect=view.fullWidth/view.fullHeight;camera.fov=sample.fov;
 camera.position.copy(sample.position);camera.up.set(Math.sin(sample.bank),Math.cos(sample.bank),0);camera.lookAt(sample.target);
 camera.setViewOffset(view.fullWidth,view.fullHeight,view.x,view.y,view.width,view.height);camera.updateMatrixWorld(true);
}

// The exact analytic bayClearSky equation, sampled only for a tiny clear-sky
// reflection probe. No cloud renderer, full-scene probe, ocean or forest.
export function clearSkyTexture(sun){
 const width=128,height=64,data=new Float32Array(width*height*4),ray=new THREE.Vector3();
 const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width,v=(y+.5)/height,phi=(u-.5)*Math.PI*2,theta=v*Math.PI;
  ray.set(Math.sin(theta)*Math.cos(phi),-Math.cos(theta),Math.sin(theta)*Math.sin(phi));
  const h=Math.max(ray.y,0),xz=Math.max(Math.hypot(ray.x,ray.z),.0001),sunXZ=Math.hypot(sun.x,sun.z);
  const solarHorizon=Math.max((ray.x*sun.x+ray.z*sun.z)/(xz*sunXZ),0)**4;
  const blend=smooth(h/.8)**.42,halo=Math.max(ray.dot(sun),0)**12*Math.exp(-h*3);
  for(let c=0;c<3;c++){const horizon=[.30,.36,.43][c]*(1-solarHorizon)+[.72,.40,.19][c]*solarHorizon;data[(y*width+x)*4+c]=horizon*(1-blend)+[.065,.13,.23][c]*blend+[.26,.16,.075][c]*halo;}
  data[(y*width+x)*4+3]=1;
 }
 const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;texture.needsUpdate=true;return texture;
}
