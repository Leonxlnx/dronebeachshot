import {clamp, noise, rng, smooth} from './math';

export type ForestGround = {height:number; slope:number};
export type ForestSurface = (x:number,z:number)=>ForestGround|null;
export type DistantTree = {
 x:number; y:number; z:number; scale:number; angle:number; family:number;
 height:number; layer:'regeneration'|'canopy'|'emergent';
};
export const DISTANT_FOREST = {
 seed:902174, spacing:14, cellSize:300, rootBurial:.12,
 minX:-4200, maxX:4200, minZ:-2800, maxZ:3600,
 innerDistance:4, outerDistance:3600,
} as const;

/** Stand-scale variation follows the same sampled triangles as the roots.
 * Nearby crowns share exposure, succession and species tendency. Independent
 * tree variation then breaks their silhouettes without painting the canopy.
 */
export function distantForestHabitat(x:number,z:number,ground:ForestGround,surface:ForestSurface){
 const support=56;
 let neighbours=0,heightSum=0;
 for(const [dx,dz] of [[support,0],[-support,0],[0,support],[0,-support]]){
  const sample=surface(x+dx,z+dz);
  if(sample){heightSum+=sample.height;neighbours++;}
 }
 const relief=neighbours?ground.height-heightSum/neighbours:0;
 const convex=smooth(1.5,14,relief),hollow=smooth(1.5,14,-relief);
 const slopeStress=smooth(.55,1.85,ground.slope);
 const shelter=clamp(1-.65*slopeStress-.48*convex+.28*hollow);
 const warpX=x+180*(noise(x*.0011+17.2,z*.0011-8.1)-.5);
 const warpZ=z+180*(noise(x*.0011-2.4,z*.0011+11.6)-.5);
 const edge=.68*noise(warpX*.0031+4.7,warpZ*.0031-6.2)
  +.32*noise(warpX*.0083-14.3,warpZ*.0083+9.7);
 const stand=smooth(.27,.61,edge);
 const succession=noise(warpX*.0017+29.1,warpZ*.0017-18.6);
 const maturity=clamp(.15+.55*succession+.30*shelter);
 const familyPatch=noise(warpX*.0025-32.7,warpZ*.0025+14.8);
 // Open patches retain sparse regeneration. Steep bare faces and exposed
 // convex shoulders remain legible instead of receiving the same blanket.
 const density=(.19+.79*stand)*(.48+.52*shelter)
  *(1-smooth(1.55,2.5,ground.slope)*.75)*smooth(9,23,ground.height);
 return {stand,shelter,maturity,familyPatch,density};
}

/** Pure deterministic layout. Rendering retains the original source impostors. */
export function createDistantForestLayout(surface:ForestSurface,sourceHeights:readonly number[]){
 if(sourceHeights.length<2||sourceHeights.some(h=>!Number.isFinite(h)||h<=0))
  throw new RangeError('Two positive source-tree heights are required');
 const c=DISTANT_FOREST,random=rng(c.seed),trees:DistantTree[]=[];
 let rejectedSteep=0,candidates=0;
 const layers={regeneration:0,canopy:0,emergent:0},families=[0,0];
 for(let z=c.minZ;z<=c.maxZ;z+=c.spacing)for(let x=c.minX;x<=c.maxX;x+=c.spacing){
  // Consume a fixed number of values per candidate. Habitat rejection cannot
  // perturb tree placement elsewhere when an upstream terrain cell changes.
  const values=Array.from({length:7},()=>random());
  const px=x+(values[0]-.5)*c.spacing*.88,pz=z+(values[1]-.5)*c.spacing*.88;
  const outside=Math.hypot(Math.max(0,Math.abs(px)-600),Math.max(0,Math.abs(pz)-800));
  if(outside<c.innerDistance||outside>c.outerDistance)continue;
  const ground=surface(px,pz);
  if(!ground||ground.height<9||ground.height>720)continue;
  if(ground.slope>2.5){rejectedSteep++;continue;}
  candidates++;
  const habitat=distantForestHabitat(px,pz,ground,surface);
  const distanceFade=1-smooth(2800,3600,outside);
  // The rectangular traversal ends sooner in the north. Resolve that boundary
  // over hundreds of metres instead of leaving a straight last row of crowns.
  const northFade=1-smooth(2920,3600,pz);
  if(values[2]>habitat.density*distanceFade*northFade)continue;
  const regeneration=.12+.43*(1-habitat.stand)+.17*(1-habitat.shelter);
  const emergent=.075*habitat.stand*habitat.shelter;
  const layer=values[3]<regeneration?'regeneration':values[3]>1-emergent?'emergent':'canopy';
  const shortFamily=.12+.37*habitat.familyPatch+.24*(1-habitat.stand)
   +(layer==='regeneration'?.16:0);
  const family=layer==='emergent'?0:values[4]<shortFamily?1:0;
  const rawHeight=layer==='regeneration'?6+6*habitat.maturity+values[5]*2.5
   :layer==='emergent'?24+5*habitat.maturity+values[5]*3
   :14+10*habitat.maturity+values[5]*3;
  const height=rawHeight*(.76+.24*habitat.shelter);
  const scale=height/sourceHeights[family];
  trees.push({x:px,y:ground.height-c.rootBurial,z:pz,scale,angle:values[6]*Math.PI*2,family,height,layer});
  layers[layer]++;families[family]++;
 }
 return {trees,stats:{trees:trees.length,triangles:trees.length*2,rejectedSteep,candidates,
  layers,families,grounding:'exact rendered annulus triangles',seed:c.seed}};
}
