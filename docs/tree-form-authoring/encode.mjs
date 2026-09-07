// Input pixels are linear, sample-resolved RGBA, bottom row first. Opaque
// surviving source fragments have alpha one; empty MSAA samples are zero.
export const srgbEncode=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
const byte=v=>Math.round(Math.max(0,Math.min(1,v))*255);
export function integrate(pixels,width,height,factor,pass){
 if(width%factor||height%factor)throw Error('Nonintegral downsample');
 const w=width/factor,h=height/factor,channels=pass==='visibility'?2:4;
 const bytes=new Uint8Array(w*h*channels),coverage=new Uint8Array(w*h);
 let area=0,weightedVisibility=0,min=Infinity,max=-Infinity;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sum=[0,0,0,0];
  for(let dy=0;dy<factor;dy++)for(let dx=0;dx<factor;dx++){
   const p=((y*factor+dy)*width+x*factor+dx)*4;
   for(let c=0;c<4;c++){const v=pixels[p+c];if(!Number.isFinite(v))throw Error('Nonfinite render pixel');sum[c]+=v;}
  }
  const count=factor*factor,a=sum[3]/count,i=y*w+x;
  if(a<-.001||a>1.001)throw Error('Invalid coverage');
  coverage[i]=byte(a);area+=a;
  if(pass==='visibility'){
   const r=sum[0]/count;
   if(r<-.001||r>a+.001)throw Error('Visibility exceeds silhouette coverage');
   bytes[2*i]=byte(r);bytes[2*i+1]=byte(a);weightedVisibility+=r;
  }else{
   const straightRGB=sum.slice(0,3).map(v=>sum[3]>0?v/sum[3]:0);
   if(pass==='normal'&&sum[3]>0){
    // Existing atlases store a unit mean direction, not mean-vector length.
    // Runtime subsequently alpha-weights these encoded normals for filtering.
    const n=straightRGB.map(v=>v*2-1),length=Math.hypot(...n);
    if(length>1e-8)for(let c=0;c<3;c++)straightRGB[c]=n[c]/length*.5+.5;
    else straightRGB.splice(0,3,.5,1,.5);
   }
   for(let c=0;c<3;c++){
    const straight=straightRGB[c];
    min=Math.min(min,straight);max=Math.max(max,straight);
    bytes[4*i+c]=byte(pass==='albedo'?srgbEncode(straight):straight);
   }
   bytes[4*i+3]=byte(a);
  }
 }
 return {bytes,coverage,width:w,height:h,channels,stats:{coveragePixels:area,weightedMeanVisibility:pass==='visibility'&&area>0?weightedVisibility/area:null,straightRange:pass==='visibility'?null:[min,max]}};
}
// PNG buffers are top-first; view row 0 corresponds to elevation 0 degrees.
export function insertPNGCell(atlas,cell,column,row,cellSize){
 const width=cellSize*8;
 for(let y=0;y<cellSize;y++){
  const src=(cellSize-1-y)*cellSize*4,dst=((row*cellSize+y)*width+column*cellSize)*4;
  atlas.set(cell.subarray(src,src+cellSize*4),dst);
 }
}
// Runtime DataTexture has flipY=false. Sun block 0 starts at bottom; each
// three-row block has elevation 70/35/0 from bottom to top.
export function insertVisibilityCell(atlas,cell,column,cameraRow,sunFrame,cellSize){
 const width=cellSize*8,blockRow=sunFrame*3+2-cameraRow;
 for(let y=0;y<cellSize;y++){
  const dst=((blockRow*cellSize+y)*width+column*cellSize)*2;
  atlas.set(cell.subarray(y*cellSize*2,(y+1)*cellSize*2),dst);
 }
}
