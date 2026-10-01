import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createOceanTiles} from './ocean-tiles';
test('tiled sea preserves every original XZ triangle once, with winding and wave bounds',()=>{
 const original=new THREE.PlaneGeometry(1800,1800,900,900);original.rotateX(-Math.PI/2);original.translate(0,0,-350);
 const positions=original.getAttribute('position'),indices=original.index!,seen=new Uint8Array(900*900);
 const tiles=createOceanTiles();assert.equal(tiles.length,36);
 for(const tile of tiles){
  const p=tile.getAttribute('position'),index=tile.index!;
  assert.ok(tile.boundingBox!.min.y<=-2&&tile.boundingBox!.max.y>=2);
  for(let cell=0;cell<150*150;cell++){
   const i=index.getX(cell*6),column=Math.round((p.getX(i)+900)/2),row=Math.round((p.getZ(i)+1250)/2);
   const key=row*900+column;assert.equal(seen[key],0);seen[key]=1;
   for(let corner=0;corner<6;corner++){
    const actual=index.getX(cell*6+corner),expected=indices.getX(key*6+corner);
    assert.equal(p.getX(actual),positions.getX(expected));assert.equal(p.getZ(actual),positions.getZ(expected));
   }
  }
  tile.dispose();
 }
 assert.equal(seen.reduce((a,b)=>a+b,0),810000);original.dispose();
});
