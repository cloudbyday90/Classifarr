/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRotationHistory } from '../fixtures/ollamaGatewayRehearsal/rotationStudyContract.mjs';

const row = index => ({ id: String(index), body: `canonical:${index}` });
const before = { inference: [row(1)], catalog: [row(1), row(2)] };
const after = () => ({ inference: [row(1), row(2), row(3)], catalog: [row(1), row(2), row(3), row(4)],
  attempts: 3, bindings: 3, catalogAttempts: [2, 3, 2, 3], rootCounts: { total: 4, retained: 2, retired: 2 }, cleanupOperations: 0 });
test('controlled cycle requires preserved historical rows, exact shared attempts and two roots', () => {
  assert.equal(verifyRotationHistory(before, after(), 1).scheduling, 'fixture_observation_only');
});
test('missing/rebound/duplicate history, refunded attempts and fake retained counts refuse', () => {
  for (const mutate of [value => { value.inference[0].body = 'changed'; }, value => { value.catalog[0] = row(2); },
    value => { value.attempts--; }, value => { value.catalogAttempts[3] = 1; }, value => { value.rootCounts.retained = 3; },
    value => { value.cleanupOperations = 1; }]) { const value = after(); mutate(value); assert.throws(() => verifyRotationHistory(before, value, 1)); }
  for (const cycle of [0, 4, NaN]) assert.throws(() => verifyRotationHistory(before, after(), cycle));
});

test('all three controlled cycles retain complete prior history and exact exhausted catalog attempts', () => {
  let prior = before;
  for (let cycle = 1; cycle <= 3; cycle++) {
    const value = {inference:Array.from({length:1+cycle*2},(_,i) => row(i+1)),catalog:Array.from({length:2+cycle*2},(_,i) => row(i+1)),
      attempts:1+cycle*2,bindings:1+cycle*2,catalogAttempts:Array.from({length:cycle+1},() => [2,3]).flat(),
      rootCounts:{total:2+cycle*2,retained:2,retired:cycle*2},cleanupOperations:0};
    assert.equal(verifyRotationHistory(prior,value,cycle).cycle,cycle);
    for (const mutate of [v => {v.inference.shift();},v => {v.catalog[0].body='rebound';},v => {v.catalog.push(v.catalog[0]);},
      v => {v.bindings--;},v => {v.rootCounts.total--;},v => {v.rootCounts.retired--;},v => {v.catalogAttempts.pop();},
      v => {v.cleanupOperations=1;}]) { const changed=structuredClone(value); mutate(changed); assert.throws(() => verifyRotationHistory(prior,changed,cycle)); }
    prior=value;
  }
});
