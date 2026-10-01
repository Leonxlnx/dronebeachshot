// Immutable source for the pre-integration material study. Never reconstruct a
// baseline by applying the proposal to whatever production source exists now.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const GROUND_STUDY_BASELINE_REF='c604d9004ccecce4a27fc7b99d4a629458022536';
export const GROUND_STUDY_BASELINE_FILES={
 ground:{path:'src/render/ground-materials.ts',sha256:'2d347d9f44d797829a925e5228dba2ebde6c3bb1cb78652661fb6c4a960fd8ab'},
 terrain:{path:'src/world/terrain.ts',sha256:'d5e84d658e6e52f28abbded5673b945adf31f988378bc95efe7b7f51f103b733'},
};
const root=fileURLToPath(new URL('../../../',import.meta.url));let cached;
export function readGroundStudyBaseline(){
 if(cached)return cached;
 const result={ref:GROUND_STUDY_BASELINE_REF};
 for(const [name,entry]of Object.entries(GROUND_STUDY_BASELINE_FILES)){
  const source=execFileSync('git',['show',GROUND_STUDY_BASELINE_REF+':'+entry.path],{cwd:root,encoding:'utf8',maxBuffer:1024*1024});
  const observed=createHash('sha256').update(source).digest('hex');
  if(observed!==entry.sha256)throw Error('Frozen ground-study source hash mismatch: '+entry.path);
  result[name]=source;
 }
 cached=Object.freeze(result);return cached;
}
