/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

/** Keep controlled scheduling observations distinct from elapsed-time evidence. */
export function runSchedulingScenarios({fixture,verify,rotationStudy,write = value => process.stdout.write(`${value}\n`)}) {
  assert.equal(typeof rotationStudy,'boolean');
  const advance = expected => {
    const result = JSON.parse(fixture('worker')); assert.ok(expected.includes(result.state),'scheduling_worker_state_invalid');
  };
  fixture('setup'); verify(0);
  advance(['awaiting_catalog_verification']);
  advance(['awaiting_catalog_verification']); verify(1);
  fixture('register-only');
  advance(['awaiting_catalog_verification']); verify(1);
  advance(['catalog_unchanged']); write(fixture('quiet'));
  if (rotationStudy) fixture('study-begin');
  for (let cycle = 0; cycle < (rotationStudy ? 3 : 1); cycle++) {
    for (let index = 0; index < 2; index++) { fixture('inference'); verify(0); fixture('accept-inference'); }
    fixture(rotationStudy ? 'study-refresh' : 'refresh'); verify(1);
    advance(['awaiting_catalog_verification']); verify(1);
    advance(['catalog_unchanged','catalog_attempts_exhausted']);
    if (rotationStudy) {
      for (let drain = 0; drain < 2; drain++) advance(['catalog_unchanged','catalog_attempts_exhausted']);
      write(fixture('study-check'));
    } else write(fixture('handoff'));
  }
}
