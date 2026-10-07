/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { channel } from 'node:diagnostics_channel';
import { VECTOR_READ_CHANNEL, observeInventoryVectorBatch } from '../../services/inventoryVectorReadDiagnostics.mjs';
import { createVectorReadObservation } from '../../scripts/comparisonMemoryStudy/vectorReadObservation.mjs';
import { assertVectorReadObservation } from '../../scripts/comparisonMemoryStudy/vectorReadContract.mjs';
import { decodeInventoryDescriptionVectorRows, readInventoryDescriptionVectorRows } from '../../services/inventoryDescriptionVectorCache.mjs';

const identity = { worker: 'comparison', attempt: 2 };
const representation = { provider: 'ollama', model: 'study:latest', digest: 'a'.repeat(64), dimensions: 3 };
const rows = [{ description_hash: 'b'.repeat(64), embedding: '[1,0,-0]' }];
const subject = channel(VECTOR_READ_CHANNEL);

test('default-off diagnostics do not inspect inputs', () => {
  expect(subject.hasSubscribers).toBe(false);
  const input = new Proxy([], { get() { throw new Error('unexpected payload access'); } });
  expect(() => observeInventoryVectorBatch('read', input, 3)).not.toThrow();
});

test('real read/decode emit only numeric counters and separate other contexts', async () => {
  let current = identity;
  const observation = createVectorReadObservation(identity, () => current);
  try {
    const query = jest.fn(async () => ({ rows }));
    const read = await readInventoryDescriptionVectorRows(query, representation, [rows[0].description_hash]);
    const decoded = decodeInventoryDescriptionVectorRows(read, representation);
    expect(Object.is(decoded.values().next().value[2], -0)).toBe(true);
    current = null; observeInventoryVectorBatch('read', rows, 3);
    const result = observation.read();
    expect(() => assertVectorReadObservation(result)).not.toThrow();
    expect(result.owned.read).toEqual({ batches: 1, rows: 1, components: 3, encodedChars: 8 });
    expect(result.owned.decode).toEqual(result.owned.read);
    expect(result.overlap.read).toEqual(result.owned.read);
    expect(result.overlap.decode.rows).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/bbbb|embedding|\[1,0/);
  } finally { observation.close(); }
  expect(subject.hasSubscribers).toBe(false);
});

test('published records are immutable, payload-free and bounded, and detached counters cannot alter evidence', () => {
  const observation = createVectorReadObservation(identity, () => identity);
  const events = [], receive = event => events.push(event);
  subject.subscribe(receive);
  try {
    observeInventoryVectorBatch('decode', rows, 3);
    expect(events).toEqual([{ stage: 'decode', rows: 1, components: 3, encodedChars: 8 }]);
    expect(Object.isFrozen(events[0])).toBe(true);
    const receipt = observation.read(); receipt.owned.decode.rows = 99;
    expect(observation.read().owned.decode.rows).toBe(1);
    observeInventoryVectorBatch('read', new Array(10001), 3);
    expect(events[1]).toEqual({ invalid: true });
    expect(() => observation.read()).toThrow('comparison_vector_observation_invalid');
  } finally { subject.unsubscribe(receive); observation.close(); }
});

test('receipt rejects missing, unknown, negative and contradictory counters', () => {
  const observation = createVectorReadObservation(identity, () => identity);
  const valid = observation.read(); observation.close();
  for (const change of [r => { delete r.owned; }, r => { r.secret = 'private'; },
    r => { r.owned.read.batches = 8193; }, r => { r.owned.read.rows = 1; },
    r => { r.owned.read.components = -1; }, r => { r.owned.read.encodedChars = 1; },
    r => { r.owned.read.batches = 8192; r.overlap.decode.batches = 1; }]) {
    const invalid = structuredClone(valid); change(invalid);
    expect(() => assertVectorReadObservation(invalid)).toThrow();
  }
});

test.each([null, {}, { stage: 'read', rows: 1, components: 3, encodedChars: -1 },
  { stage: 'read', rows: 1, components: 3, encodedChars: 8, secret: 'private' }])('invalid evidence is latched without an uncaught subscriber error: %#', event => {
  const observation = createVectorReadObservation(identity, () => identity);
  try {
    expect(() => subject.publish(event)).not.toThrow();
    expect(() => observation.read()).toThrow('comparison_vector_observation_invalid');
  } finally { observation.close(); }
});

test('event overflow and context failure invalidate observation, and closing is idempotent', () => {
  for (const context of [() => identity, () => { throw new Error('secret'); }]) {
    const observation = createVectorReadObservation(identity, context);
    for (let i = 0; i < 8193; i++) observeInventoryVectorBatch('read', [], 3);
    expect(() => observation.read()).toThrow('comparison_vector_observation_invalid');
    observation.close(); observation.close();
    expect(subject.hasSubscribers).toBe(false);
  }
});

test.each(['not-json', '[0,0,0]', '[1,2]', '[1,null,2]', '[1e100,0,0]'])('decoder preserves rejection and emits no successful decode for %s', embedding => {
  const observation = createVectorReadObservation(identity, () => identity);
  try {
    expect(() => decodeInventoryDescriptionVectorRows([{ ...rows[0], embedding }], representation)).toThrow();
    expect(observation.read().owned.decode.batches).toBe(0);
  } finally { observation.close(); }
});

test('invalid query scope is rejected before a successful read observation', async () => {
  const observation = createVectorReadObservation(identity, () => identity);
  try {
    await expect(readInventoryDescriptionVectorRows(async () => ({ rows }), representation, ['c'.repeat(64)]))
      .rejects.toThrow('inventory_description_cache_scope_invalid');
    expect(observation.read().owned.read.batches).toBe(0);
  } finally { observation.close(); }
});
