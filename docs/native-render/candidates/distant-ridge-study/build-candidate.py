from pathlib import Path
import re,hashlib,json
p=Path(__file__).resolve().parent;s=(p/'baseline-terrain.ts').read_text();start=s.index('function continuationRegionalHeight(');end=s.index('function continuationHeight(',start)
replacement='''function continuationRegionalHeight(x:number,z:number) {
 const coast=continuationShore(x);
 const coastSlope=(continuationShore(x+2)-continuationShore(x-2))*.25;
 const marineDistance=(z-coast)/Math.sqrt(1+coastSlope*coastSlope);
 if(marineDistance<0)return Math.max(-85,marineDistance*.16);
 // Inland ranges must not amplify every metre-scale wiggle of the beach
 // normal across kilometres. Use a regional coast tangent for inland relief.
 const regionalSlope=(continuationShore(x+160)-continuationShore(x-160))/320;
 const inland=(z-coast)/Math.sqrt(1+regionalSlope*regionalSlope);
 const distance=continuationOutsideDistance(x,z);
 // One linked range extends along the coast. Lower broad-frequency variation
 // establishes watersheds; smaller real cuts expose their branching relief.
 const along=x+(noise(x*.00063,z*.00059)-.5)*320;
 const warp=(fbm(x*.0017+6.3,z*.0014-2.8,3)-.46)*140;
 let mountain=0;
 for(let ridge=0;ridge<3;ridge++){
  const seed=13.7+ridge*19.3;
  const center=310+ridge*585+(noise(along*.00077,seed)-.5)*200;
  const width=310+ridge*125+noise(along*.00093,seed+7.2)*90;
  const crest=280+ridge*57+noise(along*.00059,seed+3.4)*130
   +(fbm(along*.0032,seed+9.1,3)-.46)*70;
  const across=inland-center+warp;
  const radius=Math.abs(across)/width;
  const profile=Math.exp(-1.45*Math.pow(radius,1.65));
  // Erosion channels merge towards the shore and divide up the higher face.
  // Their centre-lines meander, widths grow downslope, and relief fades at
  // the watershed itself. They carve geometry; no color-only crack pattern.
  const upstream=continuationClamp((across/width+1.5)/1.5);
  const drainU=along+55*noise(inland*.0045,seed+2.1);
  const cell=Math.floor(drainU/285);let channel=0;
  for(let neighbour=-1;neighbour<=1;neighbour++){
   const id=cell+neighbour;
   const mouth=(id+.18+.64*noise(id*.87,seed+4.8))*285;
   const bend=(noise(inland*.0058+id*.37,seed)-.5)*75;
   const trunk=mouth+bend;
   const channelWidth=20+35*(1-upstream);
   const delta=drainU-trunk;
   let cut=Math.exp(-.5*delta*delta/(channelWidth*channelWidth));
   // Two tributaries merge smoothly into each larger channel downslope.
   const fork=continuationSmooth(.32,.92,upstream);
   for(let branch=-1;branch<=1;branch+=2){
    const tributary=trunk+branch*fork*(57+noise(id,seed+branch)*55);
    const d=drainU-tributary,w=12+14*(1-upstream);
    cut=Math.max(cut,Math.exp(-.5*d*d/(w*w))*.66*fork);
   }
   channel=Math.max(channel,cut);
  }
  const face=continuationSmooth(-1.75,-.75,across/width)
   *(1-continuationSmooth(-.15,.18,across/width));
  const eroded=crest*profile*(1-.43*channel*face);
  // Smooth union keeps neighbouring ranges attached through real saddles.
  const k=22,h=Math.max(k-Math.abs(mountain-eroded),0)/k;
  mountain=Math.max(mountain,eroded)+h*h*k*.25;
 }
 const foothills=14+32*fbm(along*.002,z*.0017,3);
 const reliefMask=continuationSmooth(35,160,mountain);
 const fractured=(noise(x*.013+warp*.019,z*.009-warp*.011)-.5)*48
  +(noise(x*.031+2.7,z*.025-4.3)-.5)*18;
 const resolved=1-continuationSmooth(3500,6500,distance);
 const coastalRise=continuationSmooth(10,100,inland);
 return Math.min(inland*.022,28)+coastalRise*Math.max(foothills,
  mountain+fractured*reliefMask*resolved);
}
'''
s=s[:start]+replacement+s[end:]
a=s.index('   float extensionCliff=');b=s.index('   diffuseColor.rgb*=mix(ground,extensionCover,extensionBlend);',a)
s=s[:a]+'''   float extensionCliff=smoothstep(.27,.59,1.-gn.y);
   float extensionVariation=.86+.28*fbm(gp.xz*.0053);
   // Preserve the actual common substrate scans and physical PBR response.
   // The former constant grey replaced the rock scan across the entire range.
   vec3 extensionForest=mix(soil,living,.82)*vec3(.42,.54,.34)*extensionVariation;
   vec3 extensionStone=stone*extensionVariation;
   vec3 extensionCover=mix(extensionForest,extensionStone,extensionCliff);
   float extensionBeach=1.-smoothstep(1.,10.,gp.y);
   extensionCover=mix(extensionCover,sand,extensionBeach);
''' +s[b:]
s=s.replace('diffuseColor.rgb*=mix(ground,extensionCover,extensionBlend);', '''diffuseColor.rgb*=mix(ground,extensionCover,extensionBlend);
   // Keep roughness, normals and occlusion on the same distant substrates.
   // The unbounded core shoreline must not turn dry distant faces into sand.
   cliff=mix(cliff,extensionCliff,extensionBlend);
   moss=mix(moss,.82*(1.-extensionCliff),extensionBlend);
   sediment=mix(sediment,extensionBeach,extensionBlend);
   wet*=1.-extensionBlend;''')
s=s.replace("'continuous-coastal-extension-v2'","'continuous-coastal-extension-v3-drainage-substrate'")
(p/'src/world/terrain.ts').write_text(s)
# Height-only snapshots avoid loading geometry/materials during CPU seam checks.
for name,source in [('baseline',(p/'baseline-terrain.ts').read_text()),('candidate',s)]:
 block=source[source.index('const continuationClamp'):source.index('function createCoastalContinuation')]
 (p/(name+'-heights.ts')).write_text("import {terrainHeight,shoreZ,noise,fbm} from './src/world/math.ts';\n"+block+'\nexport {continuationHeight,continuationRegionalHeight,continuationShore,continuationOutsideDistance};\n')
print('candidate',hashlib.sha256(s.encode()).hexdigest())
