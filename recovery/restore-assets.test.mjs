import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {restoreAssets,zipEntries} from './restore-assets.mjs';
const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('fresh deployment restores every real asset exactly, is idempotent and preserves edits',()=>{
 const outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'last-light-bay-assets-'));
 try{
  const manifest=JSON.parse(fs.readFileSync(path.join(repositoryRoot,'public/assets/manifest.json')));
  const result=restoreAssets({repositoryRoot,outputRoot});assert.equal(result.files,manifest.length);assert.equal(result.restored,manifest.length+1);
  for(const item of manifest)assert.equal(hash(fs.readFileSync(path.join(outputRoot,item.path))),item.sha256,item.path);
  assert.equal(restoreAssets({repositoryRoot,outputRoot}).restored,0);
  const changed=path.join(outputRoot,manifest[0].path);fs.writeFileSync(changed,'intentional local edit');
  assert.throws(()=>restoreAssets({repositoryRoot,outputRoot}),/preserving it/);assert.equal(fs.readFileSync(changed,'utf8'),'intentional local edit');
 }finally{fs.rmSync(outputRoot,{recursive:true,force:true})}
});

test('asset recovery rejects a symlink destination without writing through it',()=>{
 const outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'last-light-bay-link-'));
 try{
  fs.symlinkSync(repositoryRoot,path.join(outputRoot,'public'),'dir');
  assert.throws(()=>restoreAssets({repositoryRoot,outputRoot}),/symbolic link/);
 }finally{fs.rmSync(outputRoot,{recursive:true,force:true})}
});

test('ZIP parser rejects missing/truncated directories',()=>{
 assert.throws(()=>zipEntries(Buffer.alloc(0)),/ZIP end record missing/);
 assert.throws(()=>zipEntries(Buffer.alloc(50)),/ZIP end record missing/);
 const invalid=Buffer.alloc(22);invalid.writeUInt32LE(0x06054b50);invalid.writeUInt16LE(1,10);
 assert.throws(()=>zipEntries(invalid),/split or ZIP64/);
});
