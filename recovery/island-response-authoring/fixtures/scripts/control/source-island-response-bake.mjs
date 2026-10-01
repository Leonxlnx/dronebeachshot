// Single-family authoring, reached only by the explicitly authorized GPU mode.
// The full scene never imports this module.
import * as THREE from 'three';
import {integrateResponseTile} from './source-direct-response-pilot-helper.mjs';

export async function bakeIslandResponse({config,metadata,albedo,render,setSun,setCamera,stage,check,base64,hash,sourceParts}){
 const sourceSize=1024,cell=128,layerCount=192,valuesPerLayer=cell*cell*4;
 const atlas=new Uint16Array(valuesPerLayer*layerCount),records=[],coverageHashes=new Map();
 const canvas=new OffscreenCanvas(albedo.image.width,albedo.image.height),context=canvas.getContext('2d',{willReadFrequently:true});
 context.drawImage(albedo.image,0,0);const oldRGBA=context.getImageData(0,0,canvas.width,canvas.height).data;
 if(canvas.width!==2048||canvas.height!==768)throw Error('Published Island albedo dimensions changed');
 const luma=[.2126,.7152,.0722];
 const half=values=>Uint16Array.from(values,THREE.DataUtils.toHalfFloat);
 const save=async(name,values)=>window.pilotSave(name,base64(new Uint8Array(values.buffer,values.byteOffset,values.byteLength)));
 for(let sun=0;sun<8;sun++){
  setSun(sun*45);
  for(let view=0;view<24;view++){
   const layer=sun*24+view;
   if(config.completedLayers.includes(layer)){
    const saved=await window.pilotLoadLayer(layer),bytes=Uint8Array.from(atob(saved.payload),v=>v.charCodeAt(0));
    if(bytes.byteLength!==valuesPerLayer*2)throw Error('Invalid recovered response tile');
    atlas.set(new Uint16Array(bytes.buffer),layer*valuesPerLayer);records.push(saved.record);
    if(coverageHashes.has(view)&&coverageHashes.get(view)!==saved.record.coverageSHA256)throw Error('Recovered source coverage differs across suns');
    coverageHashes.set(view,saved.record.coverageSHA256);continue;
   }
   await stage('Island response source bake '+(sun*24+view+1)+'/192');
   setCamera(view%8*45,Math.floor(view/8)*35);
   const started=performance.now(),raw=await render('source',sourceSize);
   const cell256=integrateResponseTile(raw,sourceSize,sourceSize,4);
   // Both resolutions come from identical source samples; no second raster.
   const cell128=integrateResponseTile(cell256,256,256,2),encoded=half(cell128);
   atlas.set(encoded,(sun*24+view)*valuesPerLayer);
   const coverage=new Uint16Array(256*256),old128=new Float32Array(128*128);
   let oldArea=0,newArea=0,absoluteCoverageError=0,newOutsideOld=0,oldOutsideNew=0;
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const index=y*256+x,a=cell256[index*4+3];coverage[index]=THREE.DataUtils.toHalfFloat(a);
    const old=oldRGBA[((Math.floor(view/8)*256+255-y)*2048+(view%8)*256+x)*4+3]/255;
    oldArea+=old;newArea+=a;absoluteCoverageError+=Math.abs(old-a);
    if(old===0)newOutsideOld+=a;if(a===0)oldOutsideNew+=old;
    old128[Math.floor(y/2)*128+Math.floor(x/2)]+=old/4;
   }
   const coverageHash=await hash(coverage.buffer);
   if(coverageHashes.has(view)&&coverageHashes.get(view)!==coverageHash)throw Error('Source coverage changed with sun at view '+view);
   coverageHashes.set(view,coverageHash);
   const sourceEnergy=[0,0,0],oldAlphaEnergy=[0,0,0];
   for(let i=0;i<128*128;i++)for(let c=0;c<3;c++){
    const rgb=cell128[i*4+c],a=cell128[i*4+3];sourceEnergy[c]+=rgb;
    if(a>.00001)oldAlphaEnergy[c]+=rgb/a*old128[i];
   }
   const energy=value=>value.reduce((sum,v,c)=>sum+v*luma[c],0);
   const prefix='view'+String(view).padStart(2,'0')+'-sun'+sun;
   // The Node owner gzip-compresses raw half-float bytes losslessly and records
   // both compressed and uncompressed hashes. This is not a preview image.
   const rawFile=await save('source-raw-'+prefix+'.rgba16f',half(raw));
   const cellFile=await save('response256-'+prefix+'.rgba16f',half(cell256));
   const smallFile=await save('response128-'+prefix+'.rgba16f',encoded);
   const record={view,sun,layer,renderMilliseconds:performance.now()-started,
    sourceRenderSize:sourceSize,coverageSHA256:coverageHash,oldArea,newArea,
    newToOldCoverageArea:newArea/oldArea,absoluteCoverageError,absoluteCoverageErrorFraction:absoluteCoverageError/oldArea,
    newCoverageOutsideOldSupport:newOutsideOld,oldCoverageOutsideNewSupport:oldOutsideNew,
    sourceRGBIntegral:sourceEnergy,oldAlphaConditionalRGBIntegral:oldAlphaEnergy,
    oldAlphaToOwnAlphaLuminance:energy(oldAlphaEnergy)/energy(sourceEnergy),rawFile,cellFile,smallFile};
   await window.pilotLayerCheckpoint(record);records.push(record);
  }
 }
 check('finished Island authoring');
 const data=await save('island-direct-response.rgba16f',atlas);
 const manifest={schema:'island-direct-response-v1',complete:true,family:'island-base',
  sourceSHA256:config.sourceSHA256,albedoSHA256:config.albedoSHA256,normalSHA256:config.normalSHA256,
  center:metadata.center,halfSize:metadata.halfSize,bounds:metadata.bounds,
  viewAzimuths:[0,45,90,135,180,225,270,315],viewElevations:[0,35,70],sunAzimuths:[0,45,90,135,180,225,270,315],sunElevation:6.021653966,
  sourceRenderSize:1024,sourceAlbedoCellSize:256,sourceSupersample:4,samples:4,
  cellSize:128,layers:192,format:'RGBA16F',byteOrder:'little-endian',layout:'sun-major-view-major-bottom-first',
  response:'coverage-premultiplied-unit-white-sun-directDiffuse',normalization:'conditional-response-own-coverage',
  data:{file:data.name,bytes:data.bytes,sha256:data.sha256},
  authoring:{sourceTriangles:sourceParts.reduce((sum,p)=>sum+p.triangles,0),sourceParts,
   sourceRoot:'identity',instanceTint:'white',worldTime:0,scale:18/3.4,
   responseIntegration:'1024 source ->256 by4x area ->128 by2x area; RGB and A together',
   shadow:{type:'PCFShadowMap',mapSize:1024,footprint:50,normalBias:.025,bias:-.00002,near:.1,far:200,lightDistance:100},
   coverageIdenticalAcrossSunDirections:true,records},
  limits:['Inspection only; no artistic or production acceptance',
   'Conditional response uses its own source coverage; unchanged old atlas alpha can change its final energy',
   'Fixed source time/root/sun elevation; core tilt, nonuniform scale and animated wind are not rebaked',
   'Multiplying combined baked RGB by instance tint approximates nonlinear source transmission',
   'Original baker is absent; matching documented1024 sampling is not a claim of pixel-identical old coverage']};
 return {ok:true,method:'Single-family source-derived direct-response authoring; no scene acceptance',manifest,tiles:records,rows:[]};
}
