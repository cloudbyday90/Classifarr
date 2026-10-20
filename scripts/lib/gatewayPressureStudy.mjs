/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { runGatewayArchiveQualification } from './gatewayArchiveQualification.mjs';

export async function runGatewayPressureStudy(image,revision,run=runGatewayArchiveQualification,report=value=>process.stdout.write(`${JSON.stringify(value)}\n`),afterArm=()=>{}) {
  assert.match(image,/^sha256:[a-f0-9]{64}$/);assert.match(revision,/^[a-f0-9]{40}$/);
  let shape;
  for (const [index,measure] of [false,true,true,false].entries()) {
    report({study:'archiver-pressure',run:index+1,mode:measure ? 'sampled' : 'unsampled',stage:'started'});
    const [result]=await run(image,revision,false,true,'catalog-pressure',measure);
    assert.equal(result?.captures?.length,2);assert.equal(result.historyPreserved,true);
    assert.equal(result.history?.shape?.version,1);assert.equal(result.history.shape.rows,3000);
    assert.equal(result.history.shape.paddingBytes,75000);assert.match(result.history.shape.payloadSha256,/^[a-f0-9]{64}$/);
    assert.ok(result.history.bytes>220000000 && result.history.bytes<268435456,'pressure_history_size');
    if (shape) assert.deepEqual(result.history.shape,shape,'pressure_workload_shape_changed');
    else shape=result.history.shape;
    report({study:'archiver-pressure',run:index+1,mode:measure ? 'sampled' : 'unsampled',...result});
    // Qualification returns only after verified cleanup; preserve its result before checking the host.
    await afterArm(index+1);
  }
  report({study:'archiver-pressure',stage:'passed_cleanup_verified',runs:4});
}
