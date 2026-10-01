import {parentPort,workerData} from 'node:worker_threads';
import {terrainHeight} from '../../src/world/math.ts';
import {renderedTerrainHeight} from '../../src/world/terrain-surface.ts';
parentPort.postMessage(workerData.map(([x,z])=>[terrainHeight(x,z),renderedTerrainHeight(x+.37,z+.59)]));
