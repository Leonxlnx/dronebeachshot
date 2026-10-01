// Isolated CPU candidate. Nothing in production imports this module.
// A thick positive coastal spur preserves every baseline fine-scale fracture.
export const roundedSpurSettings=Object.freeze({
 maximumUplift:32,centerX:190,centerZ:125,strike:.6,kneeShift:3,
 westCore:12,westOuter:28,eastCore:18,eastOuter:36,
 toeStart:98,toeFull:118,crownStart:143,crownEnd:173,
});
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function roundedSpurSample(x,z,h,d,p=roundedSpurSettings){
 if(z<=p.toeStart||z>=p.crownEnd||d<=45)return{height:h,changeMagnitude:0,signedDelta:0,term:'unchanged',weight:0};
 const center=p.centerX+p.strike*(z-p.centerZ)+p.kneeShift*smooth(125,150,z),across=x-center;
 const core=across<0?p.westCore:p.eastCore,outer=across<0?p.westOuter:p.eastOuter;
 const side=1-smooth(core,outer,Math.abs(across));
 if(side===0)return{height:h,changeMagnitude:0,signedDelta:0,term:'unchanged',weight:0};
 const toe=smooth(p.toeStart,p.toeFull,z),crown=1-smooth(p.crownStart,p.crownEnd,z),coast=smooth(45,60,d),weight=side*toe*crown*coast;
 const uplift=p.maximumUplift*weight;
 const term=coast<.999?'coast-join':toe<.999?'rounded-toe':crown<.999?'crown-join':across<-core?(z>=132?'knee-return':'west-flank'):across>core?'east-return':'retained-rough-body';
 return{height:h+uplift,changeMagnitude:uplift,signedDelta:uplift,term,weight,center,across,side,toe,crown,coast};
}
