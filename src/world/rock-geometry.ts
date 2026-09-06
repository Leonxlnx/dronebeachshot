import * as THREE from 'three';

type RockGeometryStream = {
 byteOffset:number; byteLength:number; count:number;
 componentType:5126|5123|5125; itemSize:number;
};
type RockGeometryMetadata = {
 format:'rock-geometry-v1'; family:string; sceneName:string; payloadBytes:number;
 meshes:Array<{name:string;geometryName:string;
  transform:{translation?:number[];rotation?:number[];scale?:number[];matrix?:number[]};
  position:RockGeometryStream;index:RockGeometryStream}>;
};

// Pure Three CPU decoding. No glTF loader, images, DOM, WebGL, Node imports or
// asynchronous I/O. A worker can pass a fetched/transferred ArrayBuffer directly.
// The caller owns the resulting group's geometries and its shared stub material.
export function decodeRockGeometrySource(buffer:ArrayBuffer):THREE.Group {
 const fail=(message:string):never=>{throw new Error('Invalid rock geometry pack: '+message)};
 if(buffer.byteLength<16)fail('truncated header');
 const header=new DataView(buffer);
 if(header.getUint32(0,true)!==0x31474b52||header.getUint32(4,true)!==1)fail('unsupported format');
 const metadataBytes=header.getUint32(8,true),payloadBytes=header.getUint32(12,true);
 const payloadOffset=Math.ceil((16+metadataBytes)/4)*4;
 if(payloadOffset>buffer.byteLength||payloadOffset+payloadBytes!==buffer.byteLength)fail('inconsistent length');
 const metadata=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,16,metadataBytes))) as RockGeometryMetadata;
 if(metadata.format!=='rock-geometry-v1'||metadata.payloadBytes!==payloadBytes||metadata.meshes.length!==6)fail('unexpected metadata');
 const littleEndian=new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4;
 function readStream(stream:RockGeometryStream,index:boolean){
  const componentBytes=stream.componentType===5123?2:4;
  if(!Number.isSafeInteger(stream.count)||stream.count<=0||!Number.isSafeInteger(stream.byteOffset)||stream.byteOffset<0||stream.byteOffset%4!==0)fail('invalid stream offset/count');
  if(index?(stream.itemSize!==1||![5123,5125].includes(stream.componentType)):(stream.itemSize!==3||stream.componentType!==5126))fail('unexpected stream type');
  if(stream.byteLength!==stream.count*stream.itemSize*componentBytes||stream.byteOffset+stream.byteLength>payloadBytes)fail('invalid stream length');
  // Independent exact byte copies let the caller transfer/release its input.
  const bytes=buffer.slice(payloadOffset+stream.byteOffset,payloadOffset+stream.byteOffset+stream.byteLength);
  if(!littleEndian){const b=new Uint8Array(bytes);for(let i=0;i<b.length;i+=componentBytes)for(let j=0;j<componentBytes/2;j++){const other=i+componentBytes-1-j,value=b[i+j];b[i+j]=b[other];b[other]=value}}
  return stream.componentType===5126?new Float32Array(bytes):stream.componentType===5123?new Uint16Array(bytes):new Uint32Array(bytes);
 }
 const material=new THREE.MeshStandardMaterial({name:'rock-geometry-worker-stub',roughness:1,metalness:0,side:THREE.DoubleSide});
 const group=new THREE.Group();group.name=metadata.sceneName;group.userData.rockGeometryFamily=metadata.family;
 for(const mesh of metadata.meshes){
  const positions=readStream(mesh.position,false),indices=readStream(mesh.index,true);
  for(const index of indices)if(index>=mesh.position.count)fail('out-of-range vertex index');
  const geometry=new THREE.BufferGeometry();geometry.name=mesh.geometryName;
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(new THREE.BufferAttribute(indices,1));
  const object=new THREE.Mesh(geometry,material);object.name=mesh.name;
  if(mesh.transform.matrix){object.matrix.fromArray(mesh.transform.matrix);object.matrix.decompose(object.position,object.quaternion,object.scale)}
  else{if(mesh.transform.translation)object.position.fromArray(mesh.transform.translation);if(mesh.transform.rotation)object.quaternion.fromArray(mesh.transform.rotation);if(mesh.transform.scale)object.scale.fromArray(mesh.transform.scale)}
  group.add(object);
 }
 group.updateMatrixWorld(true);return group;
}
