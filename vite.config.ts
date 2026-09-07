import { defineConfig } from 'vite';
import {sourceIdentity} from './scripts/control/capture-integrity.mjs';
export default defineConfig({define:{__BAY_SOURCE_IDENTITY__:JSON.stringify(sourceIdentity())}, server:{host:'0.0.0.0',port:4173,strictPort:true,allowedHosts:['terminal.local']}, build:{target:'es2022'}, preview:{host:'0.0.0.0',port:4173} });
