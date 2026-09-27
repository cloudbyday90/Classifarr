/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { serialize } from 'node:v8';
import { EventEmitter } from 'node:events';
import { MessageChannel } from 'node:worker_threads';
import { prepareEvaluationTransport, receiveEvaluationSnapshot, MAX_EVALUATION_INPUT_BYTES,
  MAX_EVALUATION_FRAME_BYTES } from '../../services/evaluationVectorTransport.mjs';
import { computeAutomaticSourcePair } from '../../services/automaticSourcePairComputation.mjs';
import { sourcePairFixture, sourcePairIdentity } from '../fixtures/sourceDescriptionPairFixture.mjs';

const key = 'a'.repeat(64);
const makeSnapshot = (values = [Math.PI, -0, Number.MIN_VALUE, Number.MAX_VALUE, 1 / 3]) => ({ inputs: {
  identity: { dimensions: values.length }, source: { vectors: new Map([[key, values]]), rows: [] } } });
async function roundTrip(snapshot) {
  const prepared = prepareEvaluationTransport(snapshot), { port1, port2 } = new MessageChannel();
  let frames = 0, maximumFrame = 0;
  const sender = prepared.createSender({ postMessage(message, buffers = []) {
    maximumFrame = Math.max(maximumFrame, serialize(message).byteLength);
    if (message.kind === 'evaluation_vectors') frames++;
    port1.postMessage(message, buffers);
    expect(buffers.every(buffer => buffer.byteLength === 0)).toBe(true);
  } });
  port1.on('message', message => sender.handle(message));
  try {
    const result = await receiveEvaluationSnapshot(structuredClone({ snapshot: prepared.snapshot,
      vectorManifest: prepared.vectorManifest }), port2);
    expect(sender.complete).toBe(true);
    return { result, frames, maximumFrame, metadataBytes: serialize(prepared.snapshot).byteLength };
  } finally { port1.close(); port2.close(); }
}

test('lossless acknowledged transfer preserves signed zero and caller-owned arrays', async () => {
  const original = makeSnapshot(), values = [...original.inputs.source.vectors.get(key)];
  const { result } = await roundTrip(original);
  expect(result).toEqual(original);
  values.forEach((value, index) => expect(Object.is(result.inputs.source.vectors.get(key)[index], value)).toBe(true));
  expect(original.inputs.source.vectors.get(key)).toEqual(values);
});
test('round trip retains evaluation fingerprint, cohort, result and aliasing', async () => {
  const original = { observedAt: '2026-09-25 01:00:00+00', inputs: { source: sourcePairFixture(), identity: sourcePairIdentity } };
  original.inputs.source.evaluationRows = original.inputs.source.rows;
  const { result: decoded } = await roundTrip(original);
  expect(decoded.inputs.source.rows).toBe(decoded.inputs.source.evaluationRows);
  const before = computeAutomaticSourcePair(original, null), after = computeAutomaticSourcePair(decoded, null);
  expect(after.fingerprint).toBe(before.fingerprint);
  expect(after.cohort).toEqual(before.cohort);
  expect({ ...after.report, durationMs: 0 }).toEqual({ ...before.report, durationMs: 0 });
});
test('larger-than-reported corpus transfers completely in bounded frames without increasing heap or vector limits', async () => {
  const vector = Array.from({ length: 1024 }, (_, i) => Math.sin(i));
  const vectors = new Map(Array.from({ length: 9000 }, (_, i) => [i.toString(16).padStart(64, '0'), [...vector]]));
  const snapshot = { inputs: { source: { vectors, metadata: 'x'.repeat(10_000_000) }, identity: { dimensions: 1024 } } };
  expect(serialize(snapshot).byteLength).toBeGreaterThan(MAX_EVALUATION_INPUT_BYTES);
  const transfer = await roundTrip(snapshot);
  expect(transfer.metadataBytes).toBeLessThan(MAX_EVALUATION_INPUT_BYTES);
  expect(transfer.maximumFrame).toBeLessThanOrEqual(MAX_EVALUATION_FRAME_BYTES);
  expect(transfer.frames).toBeGreaterThan(1);
  expect(transfer.result.inputs.source.vectors.size).toBe(9000);
  for (const restored of transfer.result.inputs.source.vectors.values()) {
    expect(restored.length).toBe(vector.length);
    expect(restored.every((value, index) => Object.is(value, vector[index]))).toBe(true);
  }
}, 60000); // Coverage instrumentation traverses over nine million numeric values.
test('producer sends no further frame until receiver acknowledgement', () => {
  const prepared = prepareEvaluationTransport(makeSnapshot()), worker = { postMessage: jest.fn() };
  const sender = prepared.createSender(worker);
  expect(sender.complete).toBe(false);
  expect(worker.postMessage).not.toHaveBeenCalled();
  sender.handle({ kind: 'evaluation_vectors_ready' });
  expect(worker.postMessage).toHaveBeenCalledTimes(1);
  expect(sender.complete).toBe(false);
  expect(() => sender.handle({ kind: 'evaluation_vectors_ack', sequence: 3, count: 1 })).toThrow('invalid');
  sender.handle({ kind: 'evaluation_vectors_ack', sequence: 0, count: 1 });
  expect(sender.complete).toBe(true);
  expect(worker.postMessage.mock.calls[1][0].kind).toBe('evaluation_vectors_end');
  expect(() => sender.handle({ kind: 'evaluation_vectors_ack', sequence: 0, count: 1 })).toThrow('invalid');
});
test.each([NaN, Infinity, undefined, '1', null])('rejects non-finite/non-numeric %s instead of coercion', value => {
  expect(() => prepareEvaluationTransport(makeSnapshot([value]))).toThrow('invalid');
});
test('rejects sparse, invalid dimensions and oversized vectors before allocation', () => {
  expect(() => prepareEvaluationTransport(makeSnapshot(new Array(4)))).toThrow('invalid');
  const wrong = makeSnapshot(); wrong.inputs.identity.dimensions = 3;
  expect(() => prepareEvaluationTransport(wrong)).toThrow('invalid');
  wrong.inputs.identity.dimensions = 16000;
  wrong.inputs.source.vectors = new Map(Array.from({ length: 2000 }, (_, i) => [i, []]));
  expect(() => prepareEvaluationTransport(wrong)).toThrow('evaluation_vector_budget');
});
test.each(['unknown', 'order', 'sequence', 'duplicate', 'missing', 'nonfinite', 'width', 'oversize', 'duplicate_manifest'])
('receiver rejects %s frames/manifests, never exposing partial evidence', async mode => {
  const prepared = prepareEvaluationTransport(makeSnapshot([1, 2]));
  const port = new EventEmitter(); port.postMessage = jest.fn();
  if (mode === 'duplicate_manifest') prepared.vectorManifest.hashes.push(key);
  if (mode === 'order') prepared.vectorManifest.hashes.unshift('b'.repeat(64));
  const promise = receiveEvaluationSnapshot(prepared, port);
  const assertion = expect(promise).rejects.toThrow('invalid');
  const entry = [key, new Float64Array([1, 2])];
  const message = { kind: 'evaluation_vectors', sequence: 0, entries: [entry] };
  if (mode === 'unknown') entry[0] = 'b'.repeat(64);
  if (mode === 'sequence') message.sequence = 1;
  if (mode === 'duplicate') message.entries.push(entry);
  if (mode === 'missing') Object.assign(message, { kind: 'evaluation_vectors_end', count: 1 });
  if (mode === 'nonfinite') entry[1][0] = NaN;
  if (mode === 'width') entry[1] = new Float32Array([1, 2]);
  if (mode === 'oversize') message.private = 'x'.repeat(MAX_EVALUATION_FRAME_BYTES);
  port.emit('message', message);
  await assertion;
  expect(port.listenerCount('message')).toBe(0);
});
test('empty map completes and absent projection uses ordinary envelope checks', async () => {
  const snapshot = makeSnapshot(); snapshot.inputs.source.vectors.clear();
  expect((await roundTrip(snapshot)).frames).toBe(0);
  const absent = { other: 'fixture' }, prepared = prepareEvaluationTransport(absent);
  expect(prepared.createSender({}).complete).toBe(true);
  expect(await receiveEvaluationSnapshot(prepared, {})).toBe(absent);
});
