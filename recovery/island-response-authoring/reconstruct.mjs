// CPU/file-only recovery. This script never imports Three or launches Chromium.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const packageRoot=path.dirname(fileURLToPath(import.meta.url));
const defaultRepository=path.resolve(packageRoot,'../..');
const sha256=value=>createHash('sha256').update(value).digest('hex');
function relativePath(value){
 if(typeof value!=='string'||!value||path.isAbsolute(value)||value.includes('\\')
  ||value.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Invalid recovery path: '+value);
 return value;
}
async function identity(filename){
 try{
  const stat=await fs.stat(filename);if(!stat.isFile())return null;
  const hash=createHash('sha256');for await(const chunk of createReadStream(filename))hash.update(chunk);
  return {bytes:stat.size,sha256:hash.digest('hex')};
 }catch(error){if(error.code==='ENOENT')return null;throw error;}
}
const matches=(actual,expected)=>actual?.bytes===expected.bytes&&actual.sha256===expected.sha256;

export async function prepareRecovery({repository=defaultRepository}={}){
 repository=path.resolve(repository);
 const manifestBytes=await fs.readFile(path.join(packageRoot,'manifest.json'));
 const manifest=JSON.parse(manifestBytes);
 if(manifest.schema!=='island-response-authoring-recovery-v1'||manifest.sourceDependencies.length!==33)
  throw Error('Invalid Island authoring recovery manifest');
 const frozenSource=manifest.sourceDependencies.filter(record=>record.path.startsWith('src/')||record.path.startsWith('scripts/'));
 if(frozenSource.length!==24||frozenSource.some(record=>!record.fixture||record.originPolicy!=='frozen-fixture'))
  throw Error('All24 authoring source inputs require exact frozen fixtures');
 const seen=new Set(),files=[];
 for(const record of [...manifest.sourceDependencies,...manifest.supportFiles]){
  relativePath(record.path);
  if(seen.has(record.path)||!Number.isSafeInteger(record.bytes)||record.bytes<0||!/^[a-f0-9]{64}$/.test(record.sha256))
   throw Error('Invalid or duplicate recovery record: '+record.path);
  seen.add(record.path);
  let source,origin;
  if(record.fixture){
   source=path.join(packageRoot,relativePath(record.fixture));origin='fixture';
   if(!matches(await identity(source),record))throw Error('Frozen fixture differs or is missing: '+record.fixture);
  }else{
   source=path.join(repository,record.path);origin='repository';
   if(!matches(await identity(source),record))throw Error('Pinned repository input differs or is missing: '+record.path);
  }
  files.push({...record,source,origin});
 }
 const links=[];
 for(const tool of manifest.installedTools){
  if(!/^[a-z0-9-]+$/.test(tool.package))throw Error('Invalid installed package');
  const packageDirectory=path.join(repository,'node_modules',tool.package);
  const pkg=JSON.parse(await fs.readFile(path.join(packageDirectory,'package.json'),'utf8'));
  if(pkg.version!==tool.version)throw Error('Installed runtime version differs: '+tool.package);
  for(const record of tool.files){
   relativePath(record.path);
   if(!record.path.startsWith('node_modules/'+tool.package+'/')||!matches(await identity(path.join(repository,record.path)),record))
    throw Error('Installed runtime fingerprint differs: '+record.path);
  }
  links.push({path:'node_modules/'+tool.package,source:packageDirectory,version:tool.version});
 }
 return {repository,manifest,manifestSHA256:sha256(manifestBytes),files,links};
}

export async function reconstructAuthoring({repository=defaultRepository,output}={}){
 const prepared=await prepareRecovery({repository});
 if(!output)return {ok:true,verifiedOnly:true,manifestSHA256:prepared.manifestSHA256,
  sourceDependencies:33,frozenSourceInputs:24,pinnedExternalInputs:9,supportFiles:prepared.manifest.supportFiles.length,
  fixtures:prepared.files.filter(file=>file.origin==='fixture').map(file=>file.path),
  installedTools:prepared.links.map(({path,version})=>({path,version}))};
 const destination=path.resolve(output);
 try{await fs.lstat(destination);throw Error('Recovery output already exists: '+destination);}
 catch(error){if(error.code!=='ENOENT')throw error;}
 await fs.mkdir(path.dirname(destination),{recursive:true});
 const staging=await fs.mkdtemp(destination+'.tmp-');
 try{
  for(const record of prepared.files){
   const target=path.join(staging,record.path);await fs.mkdir(path.dirname(target),{recursive:true});
   await fs.copyFile(record.source,target);
   if(!matches(await identity(target),record))throw Error('Input changed during recovery copy: '+record.path);
  }
  // The five pinned Three modules are physical verified copies. Tool package
  // links provide Node resolution without committing installed dependencies.
  for(const link of prepared.links){
   const target=path.join(staging,link.path);await fs.mkdir(path.dirname(target),{recursive:true});
   await fs.symlink(link.source,target,'dir');
  }
  const report={ok:true,verifiedOnly:false,sourceDependencies:33,frozenSourceInputs:24,pinnedExternalInputs:9,
   manifestSHA256:prepared.manifestSHA256,
   files:prepared.files.map(({path,bytes,sha256,origin})=>({path,bytes,sha256,origin})),
   installedTools:prepared.links.map(({path,version})=>({path,version})),
   note:'Exact source reconstruction only; no GPU execution or bit-identical output claim across GPU/browser versions.'};
  await fs.writeFile(path.join(staging,'reconstruction.json'),JSON.stringify(report,null,2)+'\n');
  await fs.rename(staging,destination);
  return {...report,output:destination};
 }catch(error){await fs.rm(staging,{recursive:true,force:true});throw error;}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2);let output,verifyOnly=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--verify-only')verifyOnly=true;
  else if(args[i]==='--output'&&args[i+1])output=args[++i];
  else throw Error('Usage: node recovery/island-response-authoring/reconstruct.mjs --verify-only | --output NEW_DIRECTORY');
 }
 if(verifyOnly===Boolean(output))throw Error('Choose exactly one of --verify-only or --output NEW_DIRECTORY');
 console.log(JSON.stringify(await reconstructAuthoring({output}),null,2));
}
