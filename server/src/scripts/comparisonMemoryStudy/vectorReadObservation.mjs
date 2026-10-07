/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { VECTOR_READ_CHANNEL } from '../../services/inventoryVectorReadDiagnostics.mjs';

export const emptyVectorReadCounters = () => ({ batches: 0, rows: 0, components: 0, encodedChars: 0 });
export const emptyVectorReadObservation = () => Object.fromEntries(['owned', 'overlap'].map(scope =>
  [scope, { read: emptyVectorReadCounters(), decode: emptyVectorReadCounters() }]));

/** Synthetic window only. Catch subscriber failures: Node otherwise raises uncaughtException. */
export function createVectorReadObservation(identity, context) {
  const counters = emptyVectorReadObservation();
  let failed = false, closed = false, events = 0;
  const receive = message => {
    if (failed) return;
    try {
      if (++events > 8192 || !message || Object.keys(message).sort().join(' ') !== 'components encodedChars rows stage' ||
          !['read', 'decode'].includes(message.stage)) throw new Error();
      for (const key of ['rows', 'components', 'encodedChars']) {
        if (!Number.isSafeInteger(message[key]) || message[key] < 0) throw new Error();
      }
      if (message.rows > 10000 || message.components > message.rows * 16000 || message.components < message.rows ||
          (message.rows && message.components % message.rows !== 0) || message.encodedChars > 1_000_000_000 ||
          (!message.rows && message.encodedChars)) throw new Error();
      const current = context();
      const scope = current?.worker === identity.worker && current?.attempt === identity.attempt ? 'owned' : 'overlap';
      const target = counters[scope][message.stage];
      target.batches++;
      for (const key of ['rows', 'components', 'encodedChars']) target[key] += message[key];
    } catch { failed = true; }
  };
  subscribe(VECTOR_READ_CHANNEL, receive);
  return {
    close() {
      if (closed) return;
      closed = true;
      if (!unsubscribe(VECTOR_READ_CHANNEL, receive)) failed = true;
    },
    read() {
      if (failed) throw new Error('comparison_vector_observation_invalid');
      return structuredClone(counters);
    },
  };
}
