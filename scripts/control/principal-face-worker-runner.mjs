import {parentPort} from 'node:worker_threads';
import fs from 'node:fs/promises';
globalThis.fetch=async input=>{
 if(input!=='/assets/rocks/rock_moss_set_01_geometry.bin')throw Error('Unexpected worker asset '+String(input));
 const bytes=await fs.readFile(new URL('../../public'+input,import.meta.url));
 return new Response(bytes,{status:200});
};
globalThis.self={postMessage:(data,options)=>parentPort.postMessage(data,options?.transfer)};
await import('../../src/world/coastal-worker.ts');
await self.onmessage({data:{build:true}});
