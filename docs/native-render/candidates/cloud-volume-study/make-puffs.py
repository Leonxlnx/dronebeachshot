from pathlib import Path
p=Path('cloud-volume-study')
s=(p/'clouds-volume-runtime.ts').read_text().replace('cloudBase=850.','cloudBase=450.').replace('cloudTop=2200.','cloudTop=2800.')
a=s.index('float density(vec3 p){');b=s.index('float cloudSunTransmission',a)
s=s[:a]+'''float density(vec3 p){
 if(p.y<cloudBase||p.y>cloudTop)return 0.;
 float radius=length(p.xz);if(radius>cloudWorldRadius)return 0.;
 // Sparse world-anchored cumulus groups. Each union contains a wide lower
 // condensation body and unequal upper lobes, with 3D boundary erosion.
 vec2 cell=floor(p.xz/2700.);float shape=0.;
 for(int iz=-1;iz<=1;iz++)for(int ix=-1;ix<=1;ix++){
  vec2 id=cell+vec2(float(ix),float(iz));
  float seed=hash(id+12.7);if(seed<.32)continue;
  vec2 center=(id+vec2(.22+hash(id+7.1)*.56,.22+hash(id+19.3)*.56))*2700.;
  float base=520.+hash(id+51.8)*410.;
  float tall=450.+hash(id+24.5)*1250.;
  vec2 radii=vec2(600.+hash(id+4.2)*740.,520.+hash(id+5.9)*760.);
  vec3 q=(p-vec3(center.x,base+tall*.27,center.y))/vec3(radii.x,tall*.40,radii.y);
  float body=1.-dot(q,q);
  vec3 top=(p-vec3(center.x+radii.x*.12,base+tall*.60,center.y-radii.y*.18))/vec3(radii.x*.63,tall*.48,radii.y*.60);
  body=max(body,1.-dot(top,top));
  vec3 shoulder=(p-vec3(center.x-radii.x*.48,base+tall*.44,center.y+radii.y*.12))/vec3(radii.x*.48,tall*.34,radii.y*.56);
  body=max(body,1.-dot(shoulder,shoulder));
  shape=max(shape,body*smoothstep(base-50.,base+65.,p.y));
 }
 if(shape<=0.)return 0.;
 float erosion=(n3(p*.0054)*.68+n3(p*.0137)*.24+n3(p*.032)*.08)*.48;
 float body=smoothstep(.035,.27,shape-erosion);
 vec2 along=normalize(vec2(-.38,-.92)),across=vec2(-along.y,along.x);
 vec2 openingDelta=p.xz-along*11000.;
 float opening=length(vec2(dot(openingDelta,across)/2900.,dot(openingDelta,along)/6500.));
 float coverage=smoothstep(.68,1.05,opening);
 float distantFade=(1.-smoothstep(26000.,cloudWorldRadius,radius))*smoothstep(1600.,4000.,radius);
 return body*coverage*distantFade*.65;
}
''' +s[b:]
(p/'clouds-puffs-runtime.ts').write_text(s)
a=(p/'atmosphere-volume-runtime.ts').read_text().replace("'./clouds-volume-runtime.ts'","'./clouds-puffs-runtime.ts'")
(p/'atmosphere-puffs-runtime.ts').write_text(a)
