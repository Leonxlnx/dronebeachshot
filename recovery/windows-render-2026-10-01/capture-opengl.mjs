import assert from 'node:assert/strict';
import {chromium} from './dronebeachshot/node_modules/playwright/index.mjs';
import {parseOptions,runProgressCapture,browserCapture} from './dronebeachshot/scripts/progress-capture.mjs';
const options=parseOptions(process.argv.slice(2));
assert.equal(options.backend,'hardware');
try{
  const result=await runProgressCapture(options,{captureFactory:settings=>browserCapture(settings,{
    launchBrowser:launch=>chromium.launch({...launch,args:[...launch.args,'--use-angle=gl']})
  })});
  console.log(JSON.stringify(result));
}catch(error){console.error(error);process.exitCode=1;}
