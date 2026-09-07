// Dependency-free restoration for fresh Node/Vercel builds. Archive entries follow
// PKWARE APPNOTE 6.3.10, ordinary stored/deflated ZIP (not encrypted or ZIP64).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {fileURLToPath,pathToFileURL} from 'node:url';

const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const root=fileURLToPath(new URL('../',import.meta.url));
function assetPath(name){
 if(typeof name!=='string'||!name.startsWith('public/assets/')||name.includes('\\')||name.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Unexpected asset path: '+name);
 return name;
}

export function zipEntries(bytes){
 let end=bytes.length-22;
 for(;end>=Math.max(0,bytes.length-65557);end--)if(bytes.readUInt32LE(end)===0x06054b50&&end+22+bytes.readUInt16LE(end+20)===bytes.length)break;
 if(end<0||end<bytes.length-65557)throw Error('ZIP end record missing');
 const count=bytes.readUInt16LE(end+10),directorySize=bytes.readUInt32LE(end+12),directoryOffset=bytes.readUInt32LE(end+16);
 if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||bytes.readUInt16LE(end+8)!==count||count===65535||directoryOffset+directorySize!==end)throw Error('Unsupported split or ZIP64 archive');
 let cursor=directoryOffset,total=0;const entries=new Map();
 for(let i=0;i<count;i++){
  if(cursor+46>end||bytes.readUInt32LE(cursor)!==0x02014b50)throw Error('Invalid ZIP directory');
  const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),compressed=bytes.readUInt32LE(cursor+20),size=bytes.readUInt32LE(cursor+24);
  const nameLength=bytes.readUInt16LE(cursor+28),extraLength=bytes.readUInt16LE(cursor+30),commentLength=bytes.readUInt16LE(cursor+32),local=bytes.readUInt32LE(cursor+42);
  const next=cursor+46+nameLength+extraLength+commentLength;
  if(next>end||flags&~0x800||![0,8].includes(method)||size>64*1024*1024||(total+=size)>256*1024*1024)throw Error('Unsupported ZIP entry');
  const name=assetPath(bytes.toString('utf8',cursor+46,cursor+46+nameLength));
  const unixType=(bytes.readUInt32LE(cursor+38)>>>16)&0xf000;
  if(entries.has(name)||(unixType&&unixType!==0x8000))throw Error('Duplicate or non-file ZIP entry: '+name);
  if(local+30>directoryOffset||bytes.readUInt32LE(local)!==0x04034b50||bytes.readUInt16LE(local+6)!==flags||bytes.readUInt16LE(local+8)!==method)throw Error('Invalid ZIP local header');
  const localNameLength=bytes.readUInt16LE(local+26),dataStart=local+30+localNameLength+bytes.readUInt16LE(local+28);
  if(bytes.toString('utf8',local+30,local+30+localNameLength)!==name||dataStart+compressed>directoryOffset)throw Error('Invalid ZIP data bounds');
  const input=bytes.subarray(dataStart,dataStart+compressed);
  const data=method===8?inflateRawSync(input,{maxOutputLength:Math.max(1,size)}):Buffer.from(input);
  if(data.length!==size)throw Error('ZIP size mismatch: '+name);
  entries.set(name,data);cursor=next;
 }
 if(cursor!==end)throw Error('ZIP directory size mismatch');
 return entries;
}

function safeDestination(outputRoot,name){
 assetPath(name);let current=outputRoot;
 for(const segment of name.split('/')){
  current=path.join(current,segment);
  if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Asset destination is a symbolic link: '+name);
 }
 return current;
}

function readArchive(repositoryRoot,manifestName){
 if(!/^[a-z][a-z0-9-]*\/manifest\.json$/.test(manifestName))throw Error('Invalid archive manifest path');
 const directory=manifestName.split('/')[0];
 const archiveManifest=JSON.parse(fs.readFileSync(path.join(repositoryRoot,'recovery',manifestName)));
 if(!Array.isArray(archiveManifest.parts)||!archiveManifest.parts.length)throw Error('Archive has no parts');
 const seen=new Set();
 const parts=archiveManifest.parts.map(part=>{
  if(typeof part.path!=='string'||!part.path.startsWith(directory+'/')||!new RegExp('^'+directory+'/[a-z0-9-]+\\.zip\\.part[0-9]+$').test(part.path)||seen.has(part.path))throw Error('Invalid or duplicate archive part path');
  seen.add(part.path);
  const bytes=fs.readFileSync(path.join(repositoryRoot,'recovery',part.path));
  if(bytes.length!==part.size||sha256(bytes)!==part.sha256)throw Error('Asset part checksum failed: '+part.path);
  return bytes;
 });
 const archive=Buffer.concat(parts);
 if(sha256(archive)!==archiveManifest.sha256)throw Error('Archive checksum failed');
 return zipEntries(archive);
}

export function restoreAssets({repositoryRoot=root,outputRoot=repositoryRoot}={}){
 const manifestPath=path.join(repositoryRoot,'public/assets/manifest.json');
 const manifestBytes=fs.readFileSync(manifestPath),manifest=JSON.parse(manifestBytes);
 const expected=new Map(manifest.map(item=>[assetPath(item.path),item.sha256]));
 if(expected.size!==manifest.length||[...expected.values()].some(hash=>!/^[a-f0-9]{64}$/.test(hash)))throw Error('Invalid runtime asset manifest');
 expected.set('public/assets/manifest.json',sha256(manifestBytes));
 const missing=[];
 for(const [name,hash] of expected){
  const destination=safeDestination(outputRoot,name);
  if(!fs.existsSync(destination))missing.push(name);
  else if(sha256(fs.readFileSync(destination))!==hash)throw Error('Existing asset differs from its manifest; preserving it: '+name);
 }
 if(!missing.length)return {files:expected.size-1,restored:0};
 const catalogPath=path.join(repositoryRoot,'recovery/archives.json');
 let manifestNames=['asset-parts/manifest.json'];
 const multipleArchives=fs.existsSync(catalogPath);
 if(multipleArchives){
  const catalog=JSON.parse(fs.readFileSync(catalogPath));
  if(catalog.version!==1||!Array.isArray(catalog.manifests)||!catalog.manifests.length||new Set(catalog.manifests).size!==catalog.manifests.length)throw Error('Invalid asset archive catalog');
  manifestNames=catalog.manifests;
 }
 const entries=new Map();
 for(const name of manifestNames)for(const [asset,bytes] of readArchive(repositoryRoot,name)){
  // The original recovery archive contains its historical manifest. With an
  // explicit catalog, the tracked current manifest defines the combined set.
  if(multipleArchives&&asset==='public/assets/manifest.json')continue;
  if(entries.has(asset))throw Error('Duplicate archived asset: '+asset);
  entries.set(asset,bytes);
 }
 if(multipleArchives)entries.set('public/assets/manifest.json',manifestBytes);
 if(entries.size!==expected.size||[...expected].some(([name,hash])=>!entries.has(name)||sha256(entries.get(name))!==hash))throw Error('Archived assets do not match the runtime manifest');
 // Validate every entry before writing anything; never overwrite edited assets.
 for(const name of missing){
  const destination=safeDestination(outputRoot,name);fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,entries.get(name),{flag:'wx'});
 }
 return {files:expected.size-1,restored:missing.length};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const result=restoreAssets();console.log('ASSET_RESTORE_PASS '+JSON.stringify(result));
}
