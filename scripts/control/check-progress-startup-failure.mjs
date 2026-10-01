// Two sequential real-harness browser fixtures. No scene or WebGL calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {parseOptions,runProgressCapture} from '../progress-capture.mjs';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const output=path.join(root,'artifacts/refinement-2026-09-30/startup-failure-fixtures');
// This execution environment virtualizes process IDs separately from /proc.
// Inspect this Node process's live child handles instead of host PID paths.
const children=()=>process._getActiveHandles().filter(handle=>handle.constructor.name==='ChildProcess'&&handle.exitCode===null&&handle.signalCode===null).map(handle=>({pid:handle.pid,executable:handle.spawnfile}));
const closedPort=url=>new Promise((resolve,reject)=>{
 const address=new URL(url),socket=net.connect({host:address.hostname,port:Number(address.port)});
 socket.setTimeout(1000);
 socket.once('connect',()=>{socket.destroy();resolve(false);});
 socket.once('error',error=>{socket.destroy();if(error.code==='ECONNREFUSED')resolve(true);else reject(error);});
 socket.once('timeout',()=>{socket.destroy();reject(Error('Cleanup port probe timed out'));});
});
const results={kind:'actual browser startup failure fixtures',webglCallsPermitted:false,readyTimeoutMilliseconds:8000,productionDefaultReadyTimeoutMilliseconds:300000,rows:[]};
fs.mkdirSync(output,{recursive:true});
try{
 for(const kind of ['visible-error','console-error']){
  const caseRoot=path.join(output,kind),dist=path.join(caseRoot,'dist');fs.mkdirSync(dist,{recursive:true});
  const message='Deliberate '+kind+' before capture API initialization';
  const action=kind==='visible-error'?`document.getElementById('error').textContent=${JSON.stringify(message)};document.getElementById('error').hidden=false;`:`console.error(${JSON.stringify(message)});`;
  fs.writeFileSync(path.join(dist,'index.html'),`<!doctype html><meta charset="utf-8"><title>Startup failure fixture</title><link rel="icon" href="data:,"><canvas id="world" width="32" height="18"></canvas><div id="loading"><p id="load-label">Fixture initializing</p><progress id="load-progress" max="100" value="12"></progress></div><div id="error" hidden></div><script>HTMLCanvasElement.prototype.getContext=function(){console.error('FORBIDDEN_WEBGL_OR_CANVAS_CONTEXT');throw Error('No canvas contexts permitted in this fixture');};${action}</script>`);
  const options=parseOptions(['width=32','height=18','views=0','readyTimeout=8000','dist=dist','out=capture'],caseRoot),before=children(),started=performance.now();
  let failure;
  try{await runProgressCapture(options,{log:()=>{}});}catch(error){failure=String(error);}
  const elapsedMilliseconds=performance.now()-started;
  assert.ok(failure?.includes(message),'Failure must retain the actual startup error, not a readiness timeout');
  assert.ok(!failure.includes('Timeout'),'Observed startup failure must not wait for the deadline');
  assert.ok(elapsedMilliseconds<15000,'Each bounded fixture must finish within 15 seconds');
  const manifest=JSON.parse(fs.readFileSync(path.join(options.output,'manifest.json'))),status=JSON.parse(fs.readFileSync(path.join(options.output,'capture-status.json')));
  assert.equal(manifest.captureSucceeded,false);assert.equal(manifest.frames.length,0);assert.equal(manifest.build,undefined);
  assert.deepEqual(manifest.failedRequests,[]);assert.ok(manifest.errors.every(value=>!value.includes('FORBIDDEN_WEBGL_OR_CANVAS_CONTEXT')));
  assert.equal(manifest.diagnostics.pageSnapshot.ready,false);assert.equal(manifest.diagnostics.pageSnapshot.build,null);
  assert.equal(status.stage,'failed');assert.equal(status.name,'scene-readiness');
  if(kind==='visible-error')assert.equal(manifest.diagnostics.pageSnapshot.visibleError,message);
  else assert.ok(manifest.errors.some(value=>value.includes(message)));
  assert.equal(await closedPort(manifest.diagnostics.pageSnapshot.url),true,'Local capture server must be closed');
  const after=children();assert.deepEqual(after,before,'No additional live browser child handle may remain when capture returns');
  results.rows.push({kind,message,elapsedMilliseconds,error:failure,stage:status.name,frames:0,apiInstalled:false,serverClosed:true,childProcessesBefore:before,childProcessesAfter:after,manifest:path.relative(root,path.join(options.output,'manifest.json')),status:path.relative(root,path.join(options.output,'capture-status.json'))});
 }
 results.ok=true;fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
}catch(error){results.error=String(error);fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify(results,null,2)+'\n');throw error;}
