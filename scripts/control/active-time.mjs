import fs from 'node:fs';
import crypto from 'node:crypto';
const path='RUN_STATE.json';
const state=fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):{status:'incomplete',minimumSeconds:86400,intervals:[],open:null,cycles:[]};
const allowed=['implementation','environment','materials','shaders','debugging','profiling','optimization','visual-review','technical-review','camera','asset-integration'];
const [cmd,category,...args]=process.argv.slice(2);
function save(){fs.writeFileSync(path+'.tmp',JSON.stringify(state,null,2)+'\n');fs.renameSync(path+'.tmp',path)}
function proof(paths){return paths.map(p=>{if(!fs.existsSync(p))throw Error('Missing evidence '+p);return {path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}})}
if(cmd==='start') {if(state.open)throw Error('Interval already open');if(!allowed.includes(category))throw Error('Excluded or unknown category');state.open={start:new Date().toISOString(),category,description:args.join(' '),proofs:[]};save();}
else if(cmd==='proof'){if(!state.open)throw Error('No open interval');state.open.proofs.push({at:new Date().toISOString(),files:proof([category,...args])});save();}
else if(cmd==='end'){if(!state.open)throw Error('No open interval');const end=new Date().toISOString(),duration=(Date.parse(end)-Date.parse(state.open.start))/1000;if(duration>2700&&state.open.proofs.length===0)throw Error('Long interval requires intermediate proof');const files=proof([category,...args]);state.intervals.push({...state.open,end,seconds:duration,evidence:files});fs.appendFileSync('WORKLOG.md',`\n- ${state.open.start} → ${end} | ${state.open.category} | ${duration.toFixed(1)} s | ${state.open.description} | ${files.map(f=>f.path).join(', ')}\n`);state.open=null;save();}
else if(cmd==='check'||cmd==='status'){let last=0,total=0;for(const i of state.intervals){const start=Date.parse(i.start),end=Date.parse(i.end);if(start<last||end<start||!allowed.includes(i.category)||!i.evidence.length)throw Error('Invalid interval');if(end-start>2700000&&!i.proofs.length)throw Error('Missing intermediate proof');last=end;total+=(end-start)/1000}console.log(JSON.stringify({status:state.status,verifiedSeconds:total,requiredSeconds:86400,openInterval:state.open?.start||null,cycles:state.cycles.length}));if(cmd==='check'&&total<86400)process.exit(1);}
else throw Error('Use start CATEGORY DESCRIPTION | proof FILE... | end FILE... | status | check');
