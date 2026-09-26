/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { qualitySnapshot } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { runSourcePairQualityThread, runSourcePairQualityRuntime } from '../../services/sourcePairQualityRuntime.mjs';

const priorOptions = process.env.PGOPTIONS;
afterEach(() => { if (priorOptions === undefined) delete process.env.PGOPTIONS; else process.env.PGOPTIONS = priorOptions; });

test.each(['abort', 'deadline', 'error', 'exit', 'invalid', 'success'])('worker %s always joins and strips private errors', async mode => {
  let instance, options;
  class FakeWorker extends EventEmitter {
    constructor(url, supplied) {
      super(); instance = this; options = supplied;
      expect(url.pathname).toMatch(/sourcePairQualityThread.mjs$/);
      this.stdout = { resume: jest.fn() }; this.stderr = { resume: jest.fn() }; this.terminate = jest.fn(async () => 0);
    }
  }
  const input = qualitySnapshot(), controller = new AbortController();
  const promise = runSourcePairQualityThread(input, null, null, { signal: controller.signal, WorkerClass: FakeWorker, timeoutMs: 20 });
  const assertion = mode === 'success' ? expect(promise).resolves.toMatchObject({ version: 'source_pair_quality_protocol.v1' })
    : expect(promise).rejects.toThrow(/quality_(cancelled|deadline|worker_unavailable)/);
  if (mode === 'abort') controller.abort();
  if (mode === 'error') instance.emit('error', new Error('PRIVATE'));
  if (mode === 'exit') instance.emit('exit', 0);
  if (mode === 'invalid') instance.emit('message', { result: { private: 'PRIVATE' } });
  if (mode === 'success') instance.emit('message', { result: prepareSourcePairQualityProtocol(input).protocol });
  await assertion;
  expect(instance.terminate).toHaveBeenCalledTimes(1);
  expect(options).toMatchObject({ env: { LOG_LEVEL: 'fatal', FILE_LOGGING_ENABLED: 'false' }, execArgv: [], stdout: true, stderr: true,
    workerData: { role: 'automatic-source-pair' }, resourceLimits: { maxOldGenerationSizeMb: 512 } });
  expect(Object.keys(options.env)).toHaveLength(2);
});

test('pre-cancelled or over-budget work never starts a worker; worker validation failures are generic', async () => {
  const WorkerClass = jest.fn(), controller = new AbortController(); controller.abort();
  await expect(runSourcePairQualityThread({}, null, null, { signal: controller.signal, WorkerClass })).rejects.toThrow();
  await expect(runSourcePairQualityThread({ private: 'x'.repeat(65 * 1024 * 1024) }, null, null, { WorkerClass })).rejects.toThrow('quality_input_budget');
  expect(WorkerClass).not.toHaveBeenCalled();
  await expect(runSourcePairQualityThread(qualitySnapshot(), { private: 'PRIVATE' })).rejects.toThrow('quality_worker_unavailable');
});

test.each(['logging', 'file', 'postgres'])('refuses unsafe %s before loading a database', async kind => {
  const logging = { level: 'fatal', fileLoggingEnabled: false }, loadDatabase = jest.fn();
  process.env.PGOPTIONS = '-c default_transaction_read_only=on';
  if (kind === 'logging') logging.level = 'info';
  if (kind === 'file') logging.fileLoggingEnabled = true;
  if (kind === 'postgres') process.env.PGOPTIONS = '';
  await expect(runSourcePairQualityRuntime({}, { logging, loadDatabase })).rejects.toThrow('quality_private_runtime_required');
  expect(loadDatabase).not.toHaveBeenCalled();
});

test.each(['busy', 'query'])('runtime closes its pool on %s failure without writing data', async failure => {
  process.env.PGOPTIONS = '-c default_transaction_read_only=on';
  const statements = [], pool = { end: jest.fn() }, runThread = jest.fn();
  const database = { pool, readMemory: () => ({ available: 4e9, constrained: 8e9, total: 8e9 }),
    withSessionAdvisoryLock: async (_key, callback) => { if (failure === 'busy') return false; await callback(); return true; },
    withTransaction: async callback => callback({ query: async sql => { statements.push(sql); if (sql.startsWith('SET ')) return {}; throw new Error('unavailable'); } }) };
  await expect(runSourcePairQualityRuntime({}, { logging: { level: 'fatal', fileLoggingEnabled: false }, loadDatabase: async () => database, runThread })).rejects.toThrow();
  expect(pool.end).toHaveBeenCalledTimes(1);
  expect(runThread).not.toHaveBeenCalled();
  expect(statements.join(' ')).not.toMatch(/\b(DELETE|INSERT|UPDATE)\b/);
  if (failure === 'query') expect(statements[0]).toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
});
