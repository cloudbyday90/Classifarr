/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Bootstrap imports no copied executable until all copied bytes have been checked.
const sha = value => createHash('sha256').update(value).digest('hex');
let stage = 'binding';
try {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated'); assert.equal(process.env.NODE_OPTIONS,undefined);
  assert.equal(process.execArgv.length,0); assert.equal(process.argv.length,3);
  const lane = process.argv[2]; assert.ok(['natural','allocations'].includes(lane));
  const raw = await readFile('/fixtures/fixture-provenance.json','utf8'); assert.ok(Buffer.byteLength(raw) < 16384);
  const binding = JSON.parse(raw);
  assert.deepEqual(Object.keys(binding).sort(),['application','files','image','revision','version']);
  assert.equal(binding.version,1); assert.match(binding.image,/^sha256:[a-f0-9]{64}$/); assert.match(binding.revision,/^[a-f0-9]{40}$/);
  assert.ok(Object.keys(binding.files).length > 0 && Object.keys(binding.files).length <= 32);
  for (const [name,expected] of Object.entries(binding.files)) {
    assert.match(name,/^[A-Za-z]+\.mjs$/); assert.match(expected,/^[a-f0-9]{64}$/);
    assert.equal(sha(await readFile(`/fixtures/${name}`)),expected,'row_mode_copied_source_drift');
  }
  assert.deepEqual(Object.keys(binding.application),['catalogRowReader.mjs','catalogContent.mjs']);
  for (const [name,expected] of Object.entries(binding.application)) {
    assert.match(expected,/^[a-f0-9]{64}$/);
    assert.equal(sha((await readFile(`/app/src/ollamaGateway/${name}`,'utf8')).replaceAll('\r\n','\n')),expected);
  }
  const { ROW_BOUND_FIXTURES } = await import('./rowModeContract.mjs');
  assert.deepEqual(Object.keys(binding.files),ROW_BOUND_FIXTURES);
  console.log(JSON.stringify({ fixture:'row-mode-binding',lane,revision:binding.revision,image:binding.image,sha256:sha(raw) }));
  stage = 'comparison';
  const { runRowModeProbe } = await import('./rowModeProbe.mjs');
  await runRowModeProbe(lane,value => {
    assert.ok(['parity','identity','snapshot','warmup','runs','probes','completion'].includes(value)); stage = value;
  });
} catch {
  console.log(JSON.stringify({ fixture:'row-mode-failed',stage,reason:'binding_or_comparison_failed' })); process.exitCode = 1;
}
