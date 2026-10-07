import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('ordinary-app CLI prepares portable hardware defaults and preserves explicit capture guards',()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url)),output=fs.mkdtempSync(path.join(os.tmpdir(),'bay-ordinary-cli-'));
 const run=args=>spawnSync(process.execPath,['--experimental-strip-types','scripts/control/check-ordinary-app.mjs','--prepare-only','out='+output,'source='+'a'.repeat(64),...args],{cwd:root,encoding:'utf8'});
 const read=()=>JSON.parse(fs.readFileSync(path.join(output,'ordinary-app-preparation.json'),'utf8'));
 try{
  const prepared=run([]);assert.equal(prepared.status,0,prepared.stderr);
  assert.equal(JSON.parse(prepared.stdout).browserLaunched,false);
  const defaults=read();assert.equal(defaults.mode,'hardware');assert.deepEqual(defaults.viewport,{width:1280,height:720});
  for(const field of ['memoryStartMiB','memoryLimitMiB','memoryMetric','jsHeapMiB'])assert.equal(Object.hasOwn(defaults.guards,field),false);
  assert.equal(defaults.executed,false);assert.equal(defaults.verified,false);assert.deepEqual(defaults.profileApplied,{});
  const explicit=run(['backend=software','width=1366','height=768','memoryStartMiB=6144','memoryLimitMiB=7424','memoryMetric=working','jsHeapMiB=384']);
  assert.equal(explicit.status,0,explicit.stderr);assert.equal(read().mode,'software');assert.deepEqual(read().viewport,{width:1366,height:768});
  assert.deepEqual(read().guards,{memoryStartMiB:6144,memoryLimitMiB:7424,memoryMetric:'working',jsHeapMiB:384,readyTimeout:300000,writeTimeout:180000});
  for(const args of [['width=0'],['backend=auto'],['memoryStartMiB=6144'],['width=1280','width=640'],['--run']])assert.notEqual(run(args).status,0,args.join(' '));
  fs.writeFileSync(path.join(output,'manifest.json'),'{}');assert.notEqual(run([]).status,0,'Existing capture evidence must not be overwritten');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),icon=html.match(/<link rel="icon" href="data:image\/svg\+xml,([^"]+)"\/>/);
  assert.ok(icon,'Source favicon avoids an implicit /favicon.ico request');assert.match(decodeURIComponent(icon[1]),/^<svg .*<\/svg>$/);
 }finally{fs.rmSync(output,{recursive:true,force:true});}
});
