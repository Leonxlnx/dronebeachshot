import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {reconstructAuthoring} from './reconstruct.mjs';

const packageRoot=path.dirname(fileURLToPath(import.meta.url));
const repository=path.resolve(packageRoot,'../..');
const execute=promisify(execFile);

test('compact recovery restores the exact bake inputs and fails closed',async()=>{
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'island-authoring-proof-'));
 try{
  const output=path.join(temporary,'restored');
  const result=await reconstructAuthoring({repository,output});
  assert.equal(result.sourceDependencies,33);
  const manifest=JSON.parse(await fs.readFile(path.join(packageRoot,'manifest.json'),'utf8'));
  assert.equal(manifest.sourceDependencies.filter(file=>file.fixture).length,24);
  const fixturePaths=new Set([...manifest.sourceDependencies,...manifest.supportFiles].filter(file=>file.fixture).map(file=>file.path));
  for(const file of result.files.filter(file=>file.origin==='fixture'))assert(fixturePaths.has(file.path));
  for(const record of manifest.sourceDependencies){
   const bytes=await fs.readFile(path.join(output,record.path));
   assert.equal(bytes.length,record.bytes);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
  }
  assert.equal((await fs.lstat(path.join(output,'node_modules/three/build/three.module.js'))).isSymbolicLink(),false);
  assert.equal((await fs.lstat(path.join(output,'node_modules/typescript'))).isSymbolicLink(),true);
  const cpu=await execute(process.execPath,['--experimental-strip-types','--loader','./scripts/control/ts-resolve.mjs',
   'scripts/control/check-source-direct-response.mjs'],{cwd:output,timeout:30000,maxBuffer:1024*1024});
  const report=JSON.parse(cpu.stdout.trim());assert.equal(report.ok,true);assert.equal(report.checks,17);
  await assert.rejects(reconstructAuthoring({repository,output}),/already exists/);

  // Corrupt only an owned temporary copy, never the shared repository.
  const externalInput='node_modules/three/build/three.module.js';
  await fs.appendFile(path.join(output,externalInput),'\n// corruption fixture\n');
  const rejected=path.join(temporary,'must-not-exist');
  await assert.rejects(reconstructAuthoring({repository:output,output:rejected}),/Pinned repository input differs/);
  await assert.rejects(fs.lstat(rejected),{code:'ENOENT'});
  await fs.copyFile(path.join(repository,externalInput),path.join(output,externalInput));
  await fs.appendFile(path.join(output,'src/render/island-direct-response.ts'),'\n// force validated fixture fallback\n');
  const fallback=await reconstructAuthoring({repository:output});
  assert(fallback.fixtures.includes('src/render/island-direct-response.ts'));

  const alteredPackage=path.join(temporary,'altered-recipe');await fs.mkdir(alteredPackage);
  for(const filename of ['reconstruct.mjs','manifest.json',...manifest.sourceDependencies.map(x=>x.fixture),
   ...manifest.supportFiles.map(x=>x.fixture)].filter(Boolean)){
   const target=path.join(alteredPackage,filename);await fs.mkdir(path.dirname(target),{recursive:true});
   await fs.copyFile(path.join(packageRoot,filename),target);
  }
  await fs.appendFile(path.join(alteredPackage,'fixtures/src/render/island-direct-response.ts'),'\n// corrupt frozen fixture\n');
  const altered=await import(pathToFileURL(path.join(alteredPackage,'reconstruct.mjs')).href);
  await assert.rejects(altered.reconstructAuthoring({repository:output,output:rejected}),/Frozen fixture differs/);
  await assert.rejects(fs.lstat(rejected),{code:'ENOENT'});
 }finally{await fs.rm(temporary,{recursive:true,force:true});}
});
