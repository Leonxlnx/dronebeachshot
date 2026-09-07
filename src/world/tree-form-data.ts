import type {Placement} from './ecology';
import type {TreeImpostorMetadata} from './tree-impostor';

export const islandForkOpenDefinition:TreeImpostorMetadata={
  "family": 0,
  "center": [
    -0.24971771240234375,
    8.926415018737316,
    3.9319496154785156
  ],
  "halfSize": 20.544708595064446,
  "bounds": {
    "min": [
      -11.901169776916504,
      -0.09006203711032867,
      -7.5474853515625
    ],
    "max": [
      11.401734352111816,
      17.94289207458496,
      15.411384582519531
    ]
  },
  "columns": 8,
  "rows": 3
};

/** A bounded first growth-form cohort; never consumes the placement RNG. */
export function treeFormFor(p:Pick<Placement,'family'|'x'|'z'>):0|1{
 if(p.family!==0||p.x < -220||p.x > 80||p.z < 65||p.z > 400)return 0;
 let value=Math.imul(Math.round(p.x*1000)^0x5f3759df,0x45d9f3b)^Math.imul(Math.round(p.z*1000),0x27d4eb2d);
 value=Math.imul(value^(value>>>16),0x45d9f3b);value^=value>>>16;
 return (value>>>0)/4294967296<.35?1:0;
}
