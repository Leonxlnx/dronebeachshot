import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from './dronebeachshot/node_modules/playwright/index.mjs';
import {captureLaunchOptions} from './dronebeachshot/scripts/control/progress-backend.mjs';
const output=fileURLToPath(new URL('../outputs/',import.meta.url));
const player=new URL('./player.html',import.meta.url);
fs.writeFileSync(player,'<!doctype html><html><head><meta charset="utf-8"><title>Local video playback check</title></head><body style="margin:0;background:black"><video controls muted style="width:100vw;height:100vh;object-fit:contain"></video></body></html>');
const launch=captureLaunchOptions({backend:'hardware'});
const browser=await chromium.launch(launch);
const gpuSession=await browser.newBrowserCDPSession();
fs.writeFileSync(new URL('../outputs/playback-gpu-info.json',import.meta.url),JSON.stringify(await gpuSession.send('SystemInfo.getInfo'),null,2)+'\n');
const results=[];
try{
  for(const name of ['last-light-bay-1440p60.mp4','last-light-bay-1080p60.mp4']){
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.goto(player.href);
    const result=await page.evaluate(async url=>{
      const video=document.querySelector('video');
      video.preload='auto';video.src=url;
      const started=performance.now();
      const errors=[];
      const ended=new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Playback did not finish within 45 seconds')),45000);
        video.addEventListener('error',()=>{clearTimeout(timer);const error={code:video.error?.code,message:video.error?.message};errors.push(error);reject(Error(JSON.stringify(error)));},{once:true});
        video.addEventListener('ended',()=>{clearTimeout(timer);resolve();},{once:true});
      });
      await new Promise((resolve,reject)=>{video.addEventListener('canplaythrough',resolve,{once:true});video.addEventListener('error',reject,{once:true});});
      await video.play();await ended;
      const quality=video.getVideoPlaybackQuality();
      return {duration:video.duration,currentTime:video.currentTime,ended:video.ended,videoWidth:video.videoWidth,videoHeight:video.videoHeight,
        elapsedSeconds:(performance.now()-started)/1000,totalVideoFrames:quality.totalVideoFrames,droppedVideoFrames:quality.droppedVideoFrames,errors};
    },pathToFileURL(output+name).href);
    assert.equal(result.ended,true);assert.equal(result.duration,20);assert.equal(result.currentTime,20);assert.equal(result.totalVideoFrames,1200);assert.equal(result.errors.length,0);
    results.push({file:name,...result});
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
}finally{
  await browser.close();
  fs.writeFileSync(new URL('../outputs/playback-check.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
}
