/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotRunArguments } from '../lib/ollamaGatewayApplicationPilot.mjs';

const front = 'cf-gateway-front-11111111-1111-4111-8111-111111111111';
const original = ['run', '-d', '--label', 'io.classifarr.role=schema-snapshot-check',
  '--mount', 'type=bind,src=fixture,dst=/app/data', 'sha256:fixture'];
test('pilot preserves normal entrypoint/data and adds isolation/resource bounds', () => {
  const args = pilotRunArguments(original, front);
  assert.deepEqual(args.slice(-original.length + 1), original.slice(1));
  for (const [key, value] of [['--network', front], ['--memory', '2g'], ['--cpus', '2'], ['--pids-limit', '512']]) {
    assert.equal(args[args.indexOf(key) + 1], value);
  }
  assert.ok(!args.includes('--entrypoint')); assert.ok(!args.includes('--publish'));
  assert.ok(!args.some(value => value.startsWith('CLASSIFARR_OLLAMA_ROUTING_FILE=')));
});
test('replacement explicitly uses only the fixed private routing path', () => {
  assert.ok(pilotRunArguments(original, front, true).includes('CLASSIFARR_OLLAMA_ROUTING_FILE=/app/data/gateway-pilot-routing.json'));
  assert.equal(original.includes('--network'), false);
});
test('pilot rejects a non-fixture network and non-creation commands', () => {
  for (const network of ['bridge', 'host', 'none', front + 'x']) assert.throws(() => pilotRunArguments(original, network));
  assert.throws(() => pilotRunArguments(['exec', '--label'], front));
  assert.throws(() => pilotRunArguments(['run'], front));
});
