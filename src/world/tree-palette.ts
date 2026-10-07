import * as THREE from 'three';
import {noise} from './math';

/** Stable stand-scale variation shared by source meshes and distant atlases.
 * Multipliers retain the source olive/green differences and warm sun response. */
export function treeTint(x:number,z:number,family:number,target=new THREE.Color()){
 if(family===2)return target.setHSL(.23+noise(x,z)*.035,.11,.82+noise(z,x)*.1);
 const stand=noise(x*.026+19,z*.026-7),individual=noise(x,z);
 const value=.77+stand*.17+individual*.025;
 return target.setRGB(value*(family===1?.72:.89),value,value*(family===1?.89:.83));
}
