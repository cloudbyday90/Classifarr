/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

// The host-command bootstrap has already checked all input bytes before import.
let stage = 'comparison';
try {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated'); assert.equal(process.env.NODE_OPTIONS,undefined);
  assert.equal(process.execArgv.length,0); assert.equal(process.argv.length,3);
  const lane = process.argv[2]; assert.ok(['natural','allocations'].includes(lane));
  const { runRowModeProbe } = await import('./rowModeProbe.mjs');
  await runRowModeProbe(lane,value => {
    assert.ok(['parity','identity','snapshot','warmup','runs','probes','completion'].includes(value)); stage = value;
  });
} catch {
  console.log(JSON.stringify({ fixture:'row-mode-failed',stage,reason:'binding_or_comparison_failed' })); process.exitCode = 1;
}
