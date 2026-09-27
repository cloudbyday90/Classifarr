/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runAutomaticSourcePairThread } from '../../services/automaticSourcePairThreadClient.mjs';
import { runSourcePairQualityThread } from '../../services/sourcePairQualityThreadClient.mjs';
import { computeAutomaticSourcePair } from '../../services/automaticSourcePairComputation.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { qualitySnapshot } from '../fixtures/sourcePairQualityFixture.mjs';

describe.each(['automatic', 'quality'])('%s transfer lifecycle', role => {
  test.each(['abort', 'deadline', 'exit', 'error', 'messageerror', 'early_result', 'invalid_ack', 'duplicate_ready'])
  ('%s mid-transfer never evaluates partial input, stops sending, and joins', async mode => {
    let worker;
    class FakeWorker extends EventEmitter {
      constructor() {
        super(); worker = this;
        this.postMessage = jest.fn(); this.terminate = jest.fn(async () => 0);
      }
    }
    const snapshot = qualitySnapshot(), controller = new AbortController();
    const options = { WorkerClass: FakeWorker, timeoutMs: 30, signal: controller.signal };
    const promise = role === 'automatic'
      ? runAutomaticSourcePairThread(snapshot, null, controller.signal, options)
      : runSourcePairQualityThread(snapshot, null, null, options);
    const assertion = expect(promise).rejects.toThrow(/cancelled|deadline|worker_unavailable/);
    worker.emit('message', { kind: 'evaluation_vectors_ready' });
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    const frame = worker.postMessage.mock.calls[0][0];
    if (mode === 'abort') controller.abort();
    if (['exit', 'error', 'messageerror'].includes(mode)) worker.emit(mode, new Error('PRIVATE'));
    if (mode === 'early_result') worker.emit('message', { result: role === 'automatic'
      ? computeAutomaticSourcePair(snapshot, null) : prepareSourcePairQualityProtocol(snapshot).protocol });
    if (mode === 'invalid_ack') worker.emit('message', { kind: 'evaluation_vectors_ack', sequence: 9, count: frame.entries.length });
    if (mode === 'duplicate_ready') worker.emit('message', { kind: 'evaluation_vectors_ready' });
    await assertion;
    worker.emit('message', { kind: 'evaluation_vectors_ack', sequence: frame.sequence, count: frame.entries.length });
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
