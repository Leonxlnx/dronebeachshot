import test from 'node:test';
import assert from 'node:assert/strict';

// Numerical model of the visible/cube shader's deterministic partition. These
// checks establish its integration properties, not a rendered-cloud verdict.
type Cell={begin:number;end:number;midpoint:number;length:number};
function cells(span:number,legacy=false):Cell[]{
 const step=legacy?span/Math.max(12,Math.min(512,Math.ceil(span/30))):Math.max(span/512,Math.min(30,span/12));
 const result:Cell[]=[];
 for(let i=0;i<512;i++){
  const begin=i*step;if(begin>=span)break;
  const end=Math.min(begin+step,span);
  result.push({begin,end,midpoint:(begin+end)*.5,length:end-begin});
 }
 return result;
}
const integral=(span:number,density:(position:number)=>number,legacy=false)=>
 cells(span,legacy).reduce((sum,cell)=>sum+density(cell.midpoint)*cell.length,0);
function close(actual:number,expected:number,tolerance=1e-9){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);}

test('cloud primary cells partition the entire ray within the existing sample budget',()=>{
 for(const span of [1e-7,.13,7,359.999999,360,360.000001,390,390.000001,1275,15359.999999,15360,15360.000001,50000,72000]){
  const partition=cells(span);
  assert.ok(partition.length>=12&&partition.length<=512);
  close(partition[0].begin,0);close(partition.at(-1)!.end,span,span*1e-12);
  close(partition.reduce((sum,cell)=>sum+cell.length,0),span,span*1e-12);
  for(let i=0;i<partition.length;i++){
   const cell=partition[i];assert.ok(cell.length>0&&cell.midpoint>=cell.begin&&cell.midpoint<=cell.end);
   if(i)close(cell.begin,partition[i-1].end,span*1e-12);
  }
 }
 const before=cells(600-1e-6),after=cells(600+1e-6);
 assert.deepEqual(before.slice(0,-1),after.slice(0,before.length-1),'Existing complete cells do not move when a tail cell appears');
 assert.ok(after.at(-1)!.length<1.1e-6);
});

test('constant extinction and linear density retain their analytic integrated energy',()=>{
 for(const span of [1,359.8,360.2,901.7,15361,50000]){
  close(integral(span,x=>.03+x*.000001),.03*span+.0000005*span*span,span*1e-12);
  let transmittance=1,radiance=0;
  for(const cell of cells(span)){
   const alpha=1-Math.exp(-.037*cell.length*.009);
   radiance+=.7*alpha*transmittance;transmittance*=1-alpha;
  }
  const exact=Math.exp(-.037*span*.009);
  close(transmittance,exact,1e-12);close(radiance,.7*(1-exact),1e-12);
 }
});

test('adding a tail cell is continuous; the old ceil repartition fails the same boundary probe',()=>{
 const density=(x:number)=>.04+.32*Math.exp(-(((x-137)/9)**2))+.1*Math.exp(-(((x-379)/22)**2));
 const epsilon=1e-6;
 for(let count=12;count<=512;count++){
  const boundary=count*30;
  const delta=Math.abs(integral(boundary+epsilon,density)-integral(boundary-epsilon,density));
  assert.ok(delta<1e-6,`Unexpected integration jump at ${boundary} m: ${delta}`);
 }
 // A smooth bounded fixture with fine lobes is deliberately sensitive to
 // moving all sample centers. This diagnoses continuity, not absolute accuracy.
 const oldJump=Math.abs(integral(600+epsilon,density,true)-integral(600-epsilon,density,true));
 assert.ok(oldJump>1,'The negative control must detect the old repartition jump');
});
