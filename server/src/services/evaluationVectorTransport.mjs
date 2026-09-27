/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { types } from 'node:util';
import { serialize } from 'node:v8';
export const MAX_EVALUATION_INPUT_BYTES = 64 * 1024 * 1024; // Non-vector worker envelope.
export const MAX_EVALUATION_FRAME_BYTES = 1024 * 1024;
export const MAX_EVALUATION_VECTOR_VALUES = 20_000_000; // Existing corpus admission ceiling.
const encoding = 'float64-chunks.v1';
const invalid = () => { throw new Error('evaluation_vector_transport_invalid'); };
const validHash = hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
const replaceVectors = (snapshot, vectors) => ({ ...snapshot,
  inputs: { ...snapshot.inputs, source: { ...snapshot.inputs.source, vectors } } });

function validateShape(count, dimensions) {
  if (!Number.isInteger(count) || count < 0 || count > 10000 || !Number.isInteger(dimensions) ||
    dimensions < 1 || dimensions > 16000) invalid();
  if (count * dimensions > MAX_EVALUATION_VECTOR_VALUES) throw new Error('evaluation_vector_budget');
}
function validateValues(vector, dimensions, packed) {
  if (!(packed ? types.isFloat64Array(vector) : Array.isArray(vector)) || vector.length !== dimensions) invalid();
  for (const value of vector) if (!Number.isFinite(value)) invalid();
}

/** Metadata travels once; only one newly allocated vector frame may be in flight. */
export function prepareEvaluationTransport(snapshot) {
  const vectors = snapshot?.inputs?.source?.vectors;
  if (vectors === undefined) return { snapshot, vectorManifest: null, createSender: () => ({ complete: true, handle: () => false }) };
  if (!types.isMap(vectors)) invalid();
  const dimensions = snapshot.inputs.identity?.dimensions;
  validateShape(vectors.size, dimensions);
  for (const [hash, vector] of vectors) {
    if (!validHash(hash)) invalid();
    validateValues(vector, dimensions, false);
  }
  const vectorManifest = { encoding, dimensions, hashes: [...vectors.keys()] };
  const countPerFrame = Math.max(1, Math.floor((MAX_EVALUATION_FRAME_BYTES - 1024) / (dimensions * 8 + 256)));
  return { snapshot: replaceVectors(snapshot, new Map()), vectorManifest,
    createSender(worker) {
      const iterator = vectors.entries();
      let ready = false, pending = null, sequence = 0, sent = 0, complete = false;
      const send = () => {
        const entries = [], transferList = [];
        for (let index = 0; index < countPerFrame; index++) {
          const entry = iterator.next();
          if (entry.done) break;
          const [hash, values] = entry.value;
          const vector = Float64Array.from(values);
          entries.push([hash, vector]); transferList.push(vector.buffer);
        }
        if (!entries.length) {
          if (sent !== vectorManifest.hashes.length) invalid();
          worker.postMessage({ kind: 'evaluation_vectors_end', sequence, count: sent });
          complete = true;
          return;
        }
        const message = { kind: 'evaluation_vectors', sequence, entries };
        if (serialize(message).byteLength > MAX_EVALUATION_FRAME_BYTES) invalid();
        pending = sequence++; sent += entries.length;
        worker.postMessage(message, transferList);
      };
      return {
        get complete() { return complete; },
        handle(message) {
          if (!['evaluation_vectors_ready', 'evaluation_vectors_ack'].includes(message?.kind)) return false;
          if (complete) invalid();
          if (message.kind === 'evaluation_vectors_ready') {
            if (ready || pending !== null) invalid();
            ready = true;
          } else {
            if (!ready || pending === null || message.sequence !== pending || message.count !== sent) invalid();
            pending = null;
          }
          send(); return true;
        },
      };
    },
  };
}

/** Reconstitute the exact complete vector map before allowing any evaluation. */
export async function receiveEvaluationSnapshot(workerData, port) {
  const { snapshot, vectorManifest: manifest } = workerData;
  if (manifest == null) return snapshot;
  if (manifest.encoding !== encoding || !Array.isArray(manifest.hashes) ||
    manifest.dimensions !== snapshot?.inputs?.identity?.dimensions ||
    !types.isMap(snapshot?.inputs?.source?.vectors) || snapshot.inputs.source.vectors.size !== 0) invalid();
  validateShape(manifest.hashes.length, manifest.dimensions);
  const expected = new Set(manifest.hashes);
  if (expected.size !== manifest.hashes.length || manifest.hashes.some(hash => !validHash(hash))) invalid();
  const vectors = new Map();
  await new Promise((resolve, reject) => {
    let sequence = 0;
    const fail = () => { port.removeListener('message', onMessage); reject(new Error('evaluation_vector_transport_invalid')); };
    const onMessage = message => {
      try {
        if (message?.sequence !== sequence) invalid();
        if (message.kind === 'evaluation_vectors_end') {
          if (message.count !== expected.size || vectors.size !== expected.size) invalid();
          port.removeListener('message', onMessage); resolve(); return;
        }
        if (message.kind !== 'evaluation_vectors' || !Array.isArray(message.entries) || !message.entries.length ||
          serialize(message).byteLength > MAX_EVALUATION_FRAME_BYTES) invalid();
        for (const entry of message.entries) {
          if (!Array.isArray(entry) || entry.length !== 2) invalid();
          const [hash, vector] = entry;
          if (!expected.has(hash) || vectors.has(hash) || hash !== manifest.hashes[vectors.size]) invalid();
          validateValues(vector, manifest.dimensions, true);
          vectors.set(hash, Array.from(vector));
        }
        port.postMessage({ kind: 'evaluation_vectors_ack', sequence: sequence++, count: vectors.size });
      } catch { fail(); }
    };
    port.on('message', onMessage);
    port.postMessage({ kind: 'evaluation_vectors_ready' });
  });
  return replaceVectors(snapshot, vectors);
}
