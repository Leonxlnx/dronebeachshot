/** Production-browser capture; run only where browser automation is permitted. */
import fs from 'node:fs';
import {chromium} from 'playwright';
import {runCapture} from './control/capture-run.mjs';
const [base,mode='baseline']=process.argv.slice(2);
if(!base||!['baseline','gallery','video'].includes(mode))throw Error('Provide a production URL and baseline, gallery or video mode.');
if(mode!=='baseline'){
 const state=JSON.parse(fs.readFileSync('RUN_STATE.json','utf8'));
 if(state.cycles.filter(c=>c.verified&&c.before&&c.after&&c.fixes&&c.review).length<8)throw Error('Final capture is blocked until eight actual refinement cycles pass.');
 for(const file of ['gates/branch-land.md','gates/branch-shore.md','gates/branch-atmosphere.md','gates/drone-camera.md','gates/hostile-review.md'])if(/- \[ \]|EVIDENCE:\s*pending|ABANDON:/.test(fs.readFileSync(file,'utf8')))throw Error('Final capture blocked by '+file);
}
console.log(await runCapture({base,mode,launch:()=>chromium.launch()}));
