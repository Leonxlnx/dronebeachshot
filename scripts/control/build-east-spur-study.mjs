// Explicit, isolated study build. Does not toggle working source or touch dist/.
// Run only after the shared renderer/bake owner releases the build window.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {sourceIdentity,sha256} from './capture-integrity.mjs';
const root=process.cwd(),name=process.argv.find(v=>v.startsWith('--out-dir='))?.slice(10);
if(!name||!/^dist-east-spur-study-[a-zA-Z0-9_.-]+$/.test(name))throw Error('Supply a fresh --out-dir=dist-east-spur-study-<trial>');
const destination=path.join(root,name);assert.ok(!fs.existsSync(destination),'Study output already exists; choose a fresh trial name');
const before=sourceIdentity(root),flagFile=path.join(root,'src/world/east-spur.ts'),flagBytes=fs.readFileSync(flagFile),flagSha256=sha256(flagBytes);
assert.ok(flagBytes.toString().includes('export const EAST_SPUR_STUDY_ENABLED=false;'),'Working source must remain default OFF');
for(const file of ['principal-face-planes.ts','broad-recess-planes.ts'])if(fs.existsSync(path.join(root,'src/world',file))){const text=fs.readFileSync(path.join(root,'src/world',file),'utf8');assert.ok(!/STUDY_ENABLED\s*=\s*true/.test(text),'Another geometry study is enabled')}
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'east-spur-build-'));
for(const file of ['src','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts'])fs.cpSync(path.join(root,file),path.join(stage,file),{recursive:true});
fs.mkdirSync(path.join(stage,'scripts/control'),{recursive:true});fs.copyFileSync(path.join(root,'scripts/control/capture-integrity.mjs'),path.join(stage,'scripts/control/capture-integrity.mjs'));
fs.symlinkSync(path.join(root,'node_modules'),path.join(stage,'node_modules'),'dir');fs.symlinkSync(path.join(root,'public'),path.join(stage,'public'),'dir');
const stagedFlag=path.join(stage,'src/world/east-spur.ts');fs.writeFileSync(stagedFlag,flagBytes.toString().replace('export const EAST_SPUR_STUDY_ENABLED=false;','export const EAST_SPUR_STUDY_ENABLED=true;'));
assert.equal(sourceIdentity(root),before,'Source changed while snapshotting');
const studyIdentity=sourceIdentity(stage);
const record={study:'exact rounded east spur; full-scene acceptance pending',sourceRoot:root,stagedSource:stage,output:destination,workingSourceIdentity:before,studySourceIdentity:studyIdentity,workingFlagSha256:flagSha256,stagedFlagSha256:sha256(fs.readFileSync(stagedFlag)),sourceFlag:false,stagedFlag:true,createdAt:new Date().toISOString()};
// Public assets are copied by normal Vite build semantics into this distinct
// output. Retain the small staged source for review/reproduction.
process.chdir(stage);
try{await build({root:stage,configFile:path.join(stage,'vite.config.ts'),define:{__BAY_SOURCE_IDENTITY__:JSON.stringify(studyIdentity)},build:{outDir:destination,emptyOutDir:false}})}finally{process.chdir(root)}
assert.equal(sha256(fs.readFileSync(flagFile)),flagSha256,'Working source flag changed');assert.equal(sourceIdentity(root),before,'Working source changed during study build');
const bundles=fs.readdirSync(path.join(destination,'assets')).filter(file=>/\.(js|css)$/.test(file));
record.bundles=Object.fromEntries(bundles.map(file=>[file,sha256(fs.readFileSync(path.join(destination,'assets',file)))]));record.finishedAt=new Date().toISOString();
fs.writeFileSync(path.join(destination,'east-spur-study-build.json'),JSON.stringify(record,null,2)+'\n');
console.log('EAST_SPUR_ISOLATED_BUILD '+JSON.stringify(record));
