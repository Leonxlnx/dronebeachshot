import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {islandForkOpenDefinition} from '../../src/world/tree-form-data.ts';

const read=p=>fs.readFileSync(p);
const hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const record=JSON.parse(read('docs/tree-form-authoring/island-fork-open.json'));
const manifest=JSON.parse(read('public/assets/manifest.json'));
assert.equal(hash('src/world/tree-form.ts'),record.formSourceSha256,'Growth geometry changed: regenerate and review its far-view atlas');
assert.equal(hash('public/assets/models/island-tree-near.glb'),record.sourceModelSha256,'Atlas source model changed');
assert.deepEqual(islandForkOpenDefinition,record.definition,'Runtime framing differs from the baked source geometry');
for(const file of record.files){
 const entry=manifest.find(item=>item.path===file.path);
 assert.ok(entry,'Derived atlas missing from the asset manifest');
 assert.equal(read(file.path).length,file.bytes,file.path);
 assert.equal(hash(file.path),file.sha256,file.path);
 assert.equal(entry.sha256,file.sha256,file.path);
 assert.equal(entry.formSourceSha256,record.formSourceSha256,file.path);
 assert.equal(entry.sourceModelSha256,record.sourceModelSha256,file.path);
 assert.equal(entry.license,record.license,file.path);
}
console.log('TREE_FORM_ASSET_CHECK_PASS: source model, growth field, runtime framing and three derived atlas files agree');
