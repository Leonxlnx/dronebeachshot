import * as THREE from 'three';
import {noise,smooth,shoreDistance} from './math';
import {renderedTerrainHeight} from './terrain-surface';
import {createRockMaterial} from '../render/ground-materials';
import type {Textures} from '../render/materials';

// A small number of connected exposures, each following a real mountain flank.
// These are closed bedrock volumes, not scans stretched into walls. Their whole
// perimeter and rear surface sit inside the unchanged, authoritative terrain.
const exposures=[
 {name:'west-coastal-rib',x:-320,z:105,width:76,length:106,depth:24,seed:7},
 {name:'west-gully-wall',x:-265,z:205,width:86,length:102,depth:27,seed:19},
 {name:'summit-west-shoulder',x:-205,z:278,width:86,length:110,depth:30,seed:31},
 {name:'summit-east-shoulder',x:-29,z:237,width:70,length:110,depth:28,seed:43},
 {name:'east-bay-wall',x:170,z:185,width:106,length:118,depth:31,seed:59},
 {name:'east-headland-face',x:310,z:25,width:86,length:122,depth:25,seed:71},
] as const;

type Section=Array<[number,number]>;
function linearSection(section:Section,u:number){
 if(u<=section[0][0])return section[0][1];
 for(let i=1;i<section.length;i++)if(u<section[i][0]){
  const [a,ya]=section[i-1],[b,yb]=section[i];return ya+(yb-ya)*(u-a)/(b-a);
 }
 return section[section.length-1][1];
}

function exposureGeometry(exposure:typeof exposures[number]){
 const {x:cx,z:cz,width,length,depth,seed}=exposure;
 // A broad derivative supplies geological strike; two-metre microrelief must
 // not independently rotate adjacent rock ribs into a pile of unrelated slabs.
 const gx=(renderedTerrainHeight(cx+12,cz)-renderedTerrainHeight(cx-12,cz))/24;
 const gz=(renderedTerrainHeight(cx,cz+12)-renderedTerrainHeight(cx,cz-12))/24;
 const gradient=Math.hypot(gx,gz),ux=gx/gradient,uz=gz/gradient,tx=uz,tz=-ux;
 const across=Math.ceil(width/1.7),up=Math.ceil(length/2),stride=across+1;
 const count=stride*(up+1),positions=new Float32Array(count*6),indices:number[]=[];
 // Four unequal buttresses share one host mass. Narrow recessed joints separate
 // broad faces; every exposure has its own spacing, lean and oblique bedding.
 const section:Section=[[-1,0]];
 const widths=[.44,.53,.39,.64],sum=widths.reduce((a,b)=>a+b,0);
 let edge=-1;
 for(let rib=0;rib<4;rib++){
  const w=widths[(rib+seed)%4]/sum*2;
  section.push([edge+w*.18,.17],[edge+w*(.44+.10*noise(seed,rib)),.80+.25*noise(rib,seed)],
   [edge+w*.78,.69+.17*noise(seed+2,rib)],[edge+w,.035]);edge+=w;
 }
 section[section.length-1]=[1,0];
 for(let row=0;row<=up;row++){
  const v=row/up,along=(v-.5)*length;
  const bend=(noise(v*1.6+seed,seed*.17)-noise(seed,seed*.17))*8;
  for(let col=0;col<=across;col++){
   const u=col/across*2-1;
   const x=cx+ux*along+tx*(u*width*.5+bend);
   const z=cz+uz*along+tz*(u*width*.5+bend);
   const base=renderedTerrainHeight(x,z),index=row*stride+col;
   const drift=(v-.5)*(.10+.09*noise(seed,3));
   const rib=linearSection(section,u+drift*(1-u*u));
   // Bedding breaks climb obliquely across the shared wall. Piecewise faces
   // create real changes of plane, with recessed seams instead of painted lines.
   const bedV=v+u*.073+(noise(u*.75+seed,1.7)-.5)*.085;
   const bedding=linearSection([[0,.73],[.21,1],[.245,.73],[.34,.88],
    [.58,1.04],[.615,.79],[.76,1.01],[1,.69]],bedV);
   const toe=smooth(0,.15,v),crest=1-smooth(.79,1,v);
   const edgeMask=smooth(0,.10,1-Math.abs(u));
   // Preserve soil shoulders, shore geometry and the actual highest summit.
   const support=smooth(25,48,shoreDistance(x,z))*(1-smooth(366,398,base));
   const lift=depth*rib*bedding*toe*crest*edgeMask*support;
   positions.set([x,base+lift-2.5,z],index*3);
   positions.set([x,base-9,z],(count+index)*3);
  }
 }
 for(let row=0;row<up;row++)for(let col=0;col<across;col++){
  const a=row*stride+col,b=a+1,c=a+stride,d=c+1;
  // Crossing the upslope edge with the across-strike edge points upward.
  indices.push(a,c,b,b,c,d,count+a,count+b,count+c,count+b,count+d,count+c);
 }
 const rim:number[]=[];
 for(let col=0;col<across;col++)rim.push(col);
 for(let row=0;row<up;row++)rim.push(row*stride+across);
 for(let col=across;col>0;col--)rim.push(up*stride+col);
 for(let row=up;row>0;row--)rim.push(row*stride);
 for(let i=0;i<rim.length;i++){
  const a=rim[i],b=rim[(i+1)%rim.length];
  indices.push(a,b,a+count,b,b+count,a+count);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return geometry;
}

// Immutable CPU geometry is shared by rendering and ecological exclusion.
// Consumers receive cloned buffers, so disposing a visible mesh cannot change
// the placement oracle and repeated worker/main construction remains identical.
let shapes:THREE.BufferGeometry[]|undefined;
function cliffShapes(){return shapes??=exposures.map(exposureGeometry)}
type Footprint={ax:number,az:number,bx:number,bz:number,cx:number,cz:number};
let footprintCells:Map<string,Footprint[]>|undefined;
const footprintCellSize=12;
function cliffFootprint(){
 if(footprintCells)return footprintCells;
 const cells=new Map<string,Footprint[]>();
 for(const geometry of cliffShapes()){
  const p=geometry.attributes.position,ids=geometry.index!;
  for(let i=0;i<ids.count;i+=3){
   const ia=ids.getX(i),ib=ids.getX(i+1),ic=ids.getX(i+2);
   const ax=p.getX(ia),ay=p.getY(ia),az=p.getZ(ia);
   const bx=p.getX(ib),by=p.getY(ib),bz=p.getZ(ib);
   const cx=p.getX(ic),cy=p.getY(ic),cz=p.getZ(ic);
   // Only upward surface triangles: sides and the buried rear are not habitat.
   if((bz-az)*(cx-ax)-(bx-ax)*(cz-az)<=0)continue;
   const samples=[[ax,ay,az],[bx,by,bz],[cx,cy,cz],
    [(ax+bx)/2,(ay+by)/2,(az+bz)/2],[(ax+cx)/2,(ay+cy)/2,(az+cz)/2],
    [(bx+cx)/2,(by+cy)/2,(bz+cz)/2],[(ax+bx+cx)/3,(ay+by+cy)/3,(az+bz+cz)/3]];
   // A half-metre buried allowance conservatively includes intersecting edges
   // between the differently oriented, actual two-metre terrain/cliff triangles.
   if(samples.every(([x,y,z])=>y-renderedTerrainHeight(x,z)<-.5))continue;
   const triangle={ax,az,bx,bz,cx,cz};
   for(let row=Math.floor(Math.min(az,bz,cz)/footprintCellSize);row<=Math.floor(Math.max(az,bz,cz)/footprintCellSize);row++)
    for(let col=Math.floor(Math.min(ax,bx,cx)/footprintCellSize);col<=Math.floor(Math.max(ax,bx,cx)/footprintCellSize);col++){
     const key=col+':'+row,items=cells.get(key)||[];items.push(triangle);cells.set(key,items);
    }
  }
 }
 return footprintCells=cells;
}
function segmentDistanceSquared(x:number,z:number,ax:number,az:number,bx:number,bz:number){
 const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
 return (x-ax-dx*t)**2+(z-az-dz*t)**2;
}

/** Conservative root exclusion from the actual raised surface, in world metres.
 * Deterministic and image/DOM-free; it never moves a tree onto an exposed face.
 */
export function isExposedCliff(x:number,z:number,clearance=1){
 if(!Number.isFinite(x)||!Number.isFinite(z))return false;
 if(!Number.isFinite(clearance)||clearance<0)throw new RangeError('Cliff clearance must be finite and nonnegative');
 const cells=cliffFootprint(),radiusSquared=clearance*clearance;
 for(let row=Math.floor((z-clearance)/footprintCellSize);row<=Math.floor((z+clearance)/footprintCellSize);row++)
  for(let col=Math.floor((x-clearance)/footprintCellSize);col<=Math.floor((x+clearance)/footprintCellSize);col++)
   for(const p of cells.get(col+':'+row)||[]){
    const ab=(p.bx-p.ax)*(z-p.az)-(p.bz-p.az)*(x-p.ax);
    const bc=(p.cx-p.bx)*(z-p.bz)-(p.cz-p.bz)*(x-p.bx);
    const ca=(p.ax-p.cx)*(z-p.cz)-(p.az-p.cz)*(x-p.cx);
    if((ab<=0&&bc<=0&&ca<=0)||(ab>=0&&bc>=0&&ca>=0))return true;
    if(Math.min(segmentDistanceSquared(x,z,p.ax,p.az,p.bx,p.bz),
     segmentDistanceSquared(x,z,p.bx,p.bz,p.cx,p.cz),
     segmentDistanceSquared(x,z,p.cx,p.cz,p.ax,p.az))<=radiusSquared)return true;
   }
 return false;
}

/** Also called by the image-free worker: identical geometry, no runtime loading. */
export function createCliffButtresses(textures:Textures){
 const group=new THREE.Group();group.name='connected-cliff-buttresses';
 const material=createRockMaterial(textures);material.color.setScalar(.92);
 let triangles=0;
 for(const [i,exposure]of exposures.entries()){
  const geometry=cliffShapes()[i].clone();
  // Use the existing static-instance path so shadow, bounds and coastal-field
  // inspection see exactly the same real triangles as the visible scene.
  const mesh=new THREE.InstancedMesh(geometry,material,1);
  mesh.name=exposure.name;mesh.setMatrixAt(0,new THREE.Matrix4());
  mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
  triangles+=geometry.index!.count/3;
 }
 group.userData.cliffButtresses={exposures:exposures.length,triangles,
  terrainUnchanged:true,buriedPerimeterMeters:2.5,buriedRearMeters:9};
 return group;
}
