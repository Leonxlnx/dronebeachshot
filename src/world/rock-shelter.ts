/** Approximate swell energy behind the actual emergent rock mask. Rows advance
 * inland (+Z); a cross-shore bend and lateral diffusion let energy recover around
 * small obstacles. This is a static wave-amplitude field, not a fluid solver. */
export function rockShelter(mask:Uint8Array,width:number,height:number,dx:number,dz:number,normalXOverZ:(column:number)=>number,recoveryMeters=34){
 const shelter=new Float32Array(mask.length),decay=Math.exp(-dz/recoveryMeters);
 const sample=(row:number,col:number)=>{if(row<0||col<0||col>width-1)return 0;const left=Math.floor(col),f=col-left;return shelter[row*width+left]*(1-f)+(left+1<width?shelter[row*width+left+1]:0)*f};
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
  const i=row*width+col;if(mask[i]){shelter[i]=.92;continue}
  const upstream=col-normalXOverZ(col)*dz/dx;
  shelter[i]=decay*(sample(row-1,upstream)*.6+sample(row-1,upstream-1)*.2+sample(row-1,upstream+1)*.2);
 }
 return shelter;
}
