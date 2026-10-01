import * as THREE from 'three';
/** Partition the original 1800m, 2m-grid sea without changing XZ triangles. */
export function createOceanTiles(){
 const tiles:THREE.BufferGeometry[]=[];
 for(let z=0;z<6;z++)for(let x=0;x<6;x++){
  const geometry=new THREE.PlaneGeometry(300,300,150,150);geometry.rotateX(-Math.PI/2);geometry.translate(-750+x*300,0,-1100+z*300);
  geometry.computeBoundingBox();geometry.boundingBox!.min.y=-2;geometry.boundingBox!.max.y=2;
  geometry.computeBoundingSphere();geometry.boundingSphere!.radius+=2;
  geometry.userData.oceanTile=[x,z];tiles.push(geometry);
 }
 return tiles;
}
