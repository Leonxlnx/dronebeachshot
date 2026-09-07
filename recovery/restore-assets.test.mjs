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

function storedZip(files){
 const locals=[],directory=[];let offset=0;
 for(const [name,content] of Object.entries(files)){
  const filename=Buffer.from(name),data=Buffer.from(content);let crc=0xffffffff;
  for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}crc=(crc^0xffffffff)>>>0;
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
  locals.push(local,filename,data);directory.push(central,filename);offset+=local.length+filename.length+data.length;
 }
 const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,central,end]);
}

test('combined archives restore the current manifest and validate every bundle before writing',()=>{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'last-light-bay-bundles-'));
 const source=path.join(fixture,'source'),outputRoot=path.join(fixture,'output'),a='public/assets/textures/a.bin',b='public/assets/textures/b.bin';
 const write=(relative,bytes)=>{const p=path.join(source,relative);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes)};
 const archive=(directory,files)=>{
  const bytes=storedZip(files),part=directory+'/assets.zip.part000';write('recovery/'+part,bytes);
  write('recovery/'+directory+'/manifest.json',JSON.stringify({sha256:hash(bytes),parts:[{path:part,size:bytes.length,sha256:hash(bytes)}]}));return bytes;
 };
 try{
  const oldManifest=JSON.stringify([{path:a,sha256:hash('first')}]),currentManifest=JSON.stringify([{path:a,sha256:hash('first')},{path:b,sha256:hash('second')}]);
  write('public/assets/manifest.json',currentManifest);
  archive('asset-parts',{[a]:'first','public/assets/manifest.json':oldManifest});
  const second=archive('derived-parts',{[b]:'second'});
  write('recovery/archives.json',JSON.stringify({version:1,manifests:['asset-parts/manifest.json','derived-parts/manifest.json']}));
  assert.deepEqual(restoreAssets({repositoryRoot:source,outputRoot}),{files:2,restored:3});
  assert.equal(fs.readFileSync(path.join(outputRoot,'public/assets/manifest.json'),'utf8'),currentManifest);
  assert.equal(fs.readFileSync(path.join(outputRoot,b),'utf8'),'second');
  fs.rmSync(outputRoot,{recursive:true});
  write('recovery/derived-parts/assets.zip.part000',Buffer.alloc(second.length));
  assert.throws(()=>restoreAssets({repositoryRoot:source,outputRoot}),/part checksum failed/);assert.equal(fs.existsSync(outputRoot),false);
  archive('derived-parts',{[a]:'first',[b]:'second'});
  assert.throws(()=>restoreAssets({repositoryRoot:source,outputRoot}),/Duplicate archived asset/);assert.equal(fs.existsSync(outputRoot),false);
  write('recovery/archives.json',JSON.stringify({version:1,manifests:['../escape/manifest.json']}));
  assert.throws(()=>restoreAssets({repositoryRoot:source,outputRoot}),/Invalid archive manifest path/);assert.equal(fs.existsSync(outputRoot),false);
 }finally{fs.rmSync(fixture,{recursive:true,force:true})}
});
