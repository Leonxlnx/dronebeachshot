import * as THREE from 'three';
import {terrainHeight} from './math.ts';
export const TERRAIN_GRID={minX:-600,maxX:600,minZ:-800,maxZ:800,step:2,columns:601,rows:801} as const;
// Lazy memoization stores the exact Float32 vertex values already used by the
// terrain mesh. Repeated rock, ecology and water queries share 1.84 MiB of data.
const heights=new Float32Array(TERRAIN_GRID.columns*TERRAIN_GRID.rows).fill(NaN);
function terrainVertexHeight(x:number,z:number){
 const g=TERRAIN_GRID,col=(x-g.minX)/g.step,row=(z-g.minZ)/g.step;
 if(col<0||row<0||col>=g.columns||row>=g.rows||!Number.isInteger(col)||!Number.isInteger(row))return Math.fround(terrainHeight(x,z));
 const index=row*g.columns+col;
 if(Number.isNaN(heights[index]))heights[index]=terrainHeight(x,z);
 return heights[index];
}
export function renderedTerrainHeight(x:number,z:number){const step=TERRAIN_GRID.step,x0=Math.floor(x/step)*step,z0=Math.floor(z/step)*step,u=(x-x0)/step,v=(z-z0)/step,h00=terrainVertexHeight(x0,z0),h10=terrainVertexHeight(x0+step,z0),h01=terrainVertexHeight(x0,z0+step),h11=terrainVertexHeight(x0+step,z0+step);return u+v<=1?h00*(1-u-v)+h10*u+h01*v:h11*(u+v-1)+h10*(1-v)+h01*(1-u)}
export function createTerrainHeightTexture(){const g=TERRAIN_GRID,data=new Float32Array(g.columns*g.rows);for(let row=0;row<g.rows;row++)for(let col=0;col<g.columns;col++)data[row*g.columns+col]=terrainVertexHeight(g.minX+col*g.step,g.minZ+row*g.step);const texture=new THREE.DataTexture(data,g.columns,g.rows,THREE.RedFormat,THREE.FloatType);texture.internalFormat='R32F';texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.flipY=false;texture.needsUpdate=true;return texture}
export const terrainSurfaceGLSL=`
uniform sampler2D uTerrainHeights;
float terrainVertex(vec2 grid){return texture2D(uTerrainHeights,(clamp(grid,vec2(0.),vec2(600.,800.))+.5)/vec2(601.,801.)).r;}
float renderedTerrainHeight(vec2 p){vec2 grid=(p-vec2(-600.,-800.))*.5,base=floor(grid),f=fract(grid);float a=terrainVertex(base),b=terrainVertex(base+vec2(1.,0.)),c=terrainVertex(base+vec2(0.,1.)),d=terrainVertex(base+vec2(1.));return f.x+f.y<=1.?a*(1.-f.x-f.y)+b*f.x+c*f.y:d*(f.x+f.y-1.)+b*(1.-f.y)+c*(1.-f.x);}
`;
