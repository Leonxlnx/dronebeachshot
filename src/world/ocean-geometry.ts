import * as THREE from 'three';

// The fine ocean spans x ±900, z -1250..550. Its displaced waves have already
// faded to zero before this boundary. An actual hole gives MSAA complementary
// triangle coverage; discarding a rectangle per fragment left uncovered samples.
export function createDistantWaterGeometry(){
 const outer=[[-13000,-17000],[13000,-17000],[13000,9000],[-13000,9000]];
 const inner=[[-900,-1250],[900,-1250],[900,550],[-900,550]];
 const positions=[...outer,...inner].flatMap(([x,z])=>[x,0,z]),indices:number[]=[];
 for(let i=0;i<4;i++){
  const next=(i+1)%4;
  indices.push(i,i+4,next+4,i,next+4,next);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return geometry;
}
