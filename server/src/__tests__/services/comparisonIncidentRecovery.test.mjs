/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { expect, jest, test } from '@jest/globals';
import { createComparisonIncidentRecovery } from '../../services/comparisonIncidentRecovery.mjs';
import { COMPARISON_WARNING, MAX_COMPARISON_INCIDENT_IDS } from '../../services/comparisonIncidentRepository.mjs';
import { createComparisonRecoveryScope } from '../../services/comparisonRecoveryScope.mjs';

function setup() {
  const scopeId = randomUUID(), id = randomUUID();
  const log = { warn: jest.fn(async () => id), info: jest.fn() };
  const repository = { resolve: jest.fn(async ({ errorIds }) => errorIds) };
  return { scopeId, id, log, repository, tracker: createComparisonIncidentRecovery({ log, repository }) };
}

test('only verified recovery resolves exact persisted warnings once and preserves diagnostic data', async () => {
  const v = setup(), diagnostic = { code: 'cached_vectors_incomplete', coverage: { missingDescriptions: 37 } };
  await v.tracker.warn(diagnostic, v.scopeId);
  const metadata = v.log.warn.mock.calls[0][1];
  expect(v.log.warn).toHaveBeenCalledWith(COMPARISON_WARNING, { ...diagnostic, comparisonIncident: {
    version: 1, scopeId: v.scopeId, episodeId: expect.any(String),
  } });
  for (const status of ['deferred', 'disabled', 'stopped', 'cancelled', 'invalidated', 'degraded', 'not_due', 'yielded', 'unavailable']) {
    expect(await v.tracker.recover({ status }, v.scopeId)).toBeNull();
  }
  expect(v.repository.resolve).not.toHaveBeenCalled();
  expect(await v.tracker.recover({ status: 'revalidated' }, v.scopeId)).toEqual({
    episodeId: metadata.comparisonIncident.episodeId, scopeId: v.scopeId, resolvedCount: 1,
  });
  expect(v.repository.resolve).toHaveBeenCalledWith(expect.objectContaining({ errorIds: [v.id], status: 'revalidated' }));
  await v.tracker.recover({ status: 'ready' }, v.scopeId);
  expect(v.repository.resolve).toHaveBeenCalledTimes(1);
});

test('an uncertain resolution retries exact IDs only after another verified result', async () => {
  const v = setup();
  await v.tracker.warn({}, v.scopeId);
  v.repository.resolve.mockRejectedValueOnce(new Error('PRIVATE database details'));
  expect(await v.tracker.recover({ status: 'ready' }, v.scopeId)).toBeNull();
  expect(v.log.info).toHaveBeenCalledWith(expect.any(String), {
    code: 'comparison_resolution_deferred', episodeId: expect.any(String), scopeId: v.scopeId,
  });
  await v.tracker.recover({ status: 'not_due' }, v.scopeId);
  expect(v.repository.resolve).toHaveBeenCalledTimes(1);
  await v.tracker.recover({ status: 'revalidated' }, v.scopeId);
  expect(v.repository.resolve).toHaveBeenCalledTimes(2);
  expect(v.repository.resolve.mock.calls[1][0].errorIds).toEqual([v.id]);
});

test('repeated resolution failures log a fixed reference once, never database details', async () => {
  const v = setup(); await v.tracker.warn({}, v.scopeId);
  v.repository.resolve.mockRejectedValue(new Error('PRIVATE SQL credentials'));
  v.log.info.mockImplementation(() => { throw new Error('PRIVATE logger'); });
  await expect(v.tracker.recover({ status: 'ready' }, v.scopeId)).resolves.toBeNull();
  await v.tracker.recover({ status: 'revalidated' }, v.scopeId);
  expect(v.log.info).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(v.log.info.mock.calls)).not.toContain('PRIVATE');
});

test.each(['stop', 'reset', 'scope', 'unknown'])(
  '%s abandons ownership rather than resolving a different episode', async change => {
    const v = setup(); await v.tracker.warn({}, v.scopeId);
    if (change === 'stop' || change === 'reset') v.tracker[change]();
    const scope = change === 'scope' ? randomUUID() : change === 'unknown' ? null : v.scopeId;
    expect(await v.tracker.recover({ status: 'ready' }, scope)).toBeNull();
    expect(v.repository.resolve).not.toHaveBeenCalled();
  });

test('late warning persistence after stop cannot be recovered by a replacement', async () => {
  const v = setup(); let release;
  v.log.warn.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  const pending = v.tracker.warn({}, v.scopeId); v.tracker.stop(); release(v.id); await pending;
  await v.tracker.recover({ status: 'ready' }, v.scopeId);
  const replacement = createComparisonIncidentRecovery(v);
  await replacement.recover({ status: 'ready' }, v.scopeId);
  expect(v.repository.resolve).not.toHaveBeenCalled();
  await v.tracker.warn({}, v.scopeId); expect(v.log.warn).toHaveBeenCalledTimes(1);
});

test('stop invalidates an in-flight resolution and suppresses its success receipt', async () => {
  const v = setup(); let release;
  await v.tracker.warn({}, v.scopeId);
  v.repository.resolve.mockImplementationOnce(async ({ isCurrent }) => {
    expect(isCurrent()).toBe(true);
    await new Promise(resolve => { release = resolve; });
    expect(isCurrent()).toBe(false); return [v.id];
  });
  const pending = v.tracker.recover({ status: 'ready' }, v.scopeId);
  v.tracker.stop(); release(); expect(await pending).toBeNull();
});

test('null, invalid, throwing and unscoped logger results cannot become recoverable IDs', async () => {
  const v = setup();
  v.log.warn.mockResolvedValueOnce(null).mockResolvedValueOnce('PRIVATE invalid id').mockRejectedValueOnce(new Error('PRIVATE'));
  for (let i = 0; i < 3; i++) await v.tracker.warn({}, v.scopeId);
  await v.tracker.recover({ status: 'ready' }, v.scopeId);
  await v.tracker.warn({}, null);
  expect(v.log.warn.mock.calls[3][1]).toEqual({});
  await v.tracker.recover({ status: 'ready' }, null);
  expect(v.repository.resolve).not.toHaveBeenCalled();
});

test('tracking is bounded without suppressing overflow warnings', async () => {
  const v = setup(); v.log.warn.mockImplementation(async () => randomUUID());
  for (let i = 0; i < MAX_COMPARISON_INCIDENT_IDS + 2; i++) await v.tracker.warn({}, v.scopeId);
  expect(v.log.warn).toHaveBeenCalledTimes(130);
  expect(v.log.warn.mock.calls[128][1]).toEqual({});
  await v.tracker.recover({ status: 'ready' }, v.scopeId);
  expect(v.repository.resolve.mock.calls[0][0].errorIds).toHaveLength(128);
});

test('opaque scope changes with configuration or known model identity, not a new refresh cycle', () => {
  const scope = createComparisonRecoveryScope();
  const identity = { provider: 'ollama', model: 'private-model', digest: 'private-digest', dimensions: 4 };
  expect(scope.current()).toBeNull();
  scope.configure('private endpoint and credentials'); const first = scope.current();
  scope.identify(identity); expect(scope.current()).toBe(first);
  scope.begin(); expect(scope.current()).toBeNull();
  scope.configure('private endpoint and credentials'); scope.identify(identity); expect(scope.current()).toBe(first);
  scope.identify({ ...identity, digest: 'changed' }); expect(scope.current()).not.toBe(first);
  const second = scope.current();
  scope.configure('new credentials'); expect(scope.current()).not.toBe(second);
  expect(scope.current()).toMatch(/^[a-f0-9-]{36}$/);
  scope.clear(); expect(scope.current()).toBeNull();
  scope.configure(null); expect(scope.current()).toBeNull();
  scope.configure('private endpoint and credentials'); expect(scope.current()).not.toBe(first);
});
