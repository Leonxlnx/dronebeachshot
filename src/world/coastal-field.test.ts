import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCoastalFieldCPU} from './coastal-field.ts';
test('coastal atlas preserves transformed rock surfaces and waterline distance',()=>{const result=verifyCoastalFieldCPU();assert.equal(result.checks,14);assert.equal(result.diagnostics.instancesRasterized,4)});
