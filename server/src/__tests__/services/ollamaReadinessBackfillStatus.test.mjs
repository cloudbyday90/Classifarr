/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { normalizeReadinessObservation, projectReadinessBackfill } from '../../services/ollamaReadinessBackfillStatus.mjs';
import { readReadinessBackfill } from '../../services/ollamaReadinessBackfillObservation.mjs';
import { resolveOllamaVerificationCapabilityIdentity } from '../../services/ollamaVerificationCapabilityIdentity.mjs';

const config = { primary_provider: 'ollama', ollama_host: 'fixture', ollama_model: 'model', configuration_revision: 2 };
const now = Date.parse('2026-10-14T12:00:00Z');
const identity = resolveOllamaVerificationCapabilityIdentity(config);
const row = { configuration_revision: '2', configuration_fingerprint: identity.fingerprint,
  observed_at: new Date(now - 1000), status: 'waiting', reason: 'busy' };

test.each([['completed', undefined, 'completed', 'completed'], ['checking', undefined, 'checking', 'checking'],
  ['stopped', undefined, 'waiting', 'stopped'], ['deferred', 'memory_pressure', 'waiting', 'memory_pressure'],
  ['failed', 'secret endpoint', 'failed', 'unavailable'], ['deferred', 'pending', 'waiting', 'unavailable']])(
  'normalizes %s/%s to fixed diagnostics', (status, reason, expectedStatus, expectedReason) => {
    expect(normalizeReadinessObservation({ status, reason })).toEqual({ status: expectedStatus, reason: expectedReason });
  });
test('current waiting observation is safe and never a capability verdict', () => {
  const state = projectReadinessBackfill(config, row, now);
  expect(state).toMatchObject({ status: 'pending', reason: 'busy', observedAt: '2026-10-14T11:59:59.000Z' });
  expect(state.message).toContain('other background work');
  expect(JSON.stringify(state)).not.toContain(identity.fingerprint);
});
test.each([{ configuration_revision: 3 }, { configuration_fingerprint: 'b'.repeat(64) },
  { observed_at: new Date(now + 1000) }, { observed_at: new Date(now - 600001) }, { observed_at: 'invalid' },
  { status: 'completed', reason: 'completed' }, { reason: 'secret' },
  { status: 'checking', reason: 'checking', observed_at: new Date(now - 120001) }])(
  'stale or untrusted observation becomes pending: %j', override => {
    expect(projectReadinessBackfill(config, { ...row, ...override }, now)).toMatchObject({ status: 'pending', reason: 'pending' });
  });
test('recent checking is visible; any saved test or non-Ollama configuration hides automatic work', () => {
  expect(projectReadinessBackfill(config, { ...row, status: 'checking', reason: 'checking' }, now).status).toBe('checking');
  expect(projectReadinessBackfill({ ...config, ollama_verification_capability_checked_at: new Date(now) }, row, now)).toBeNull();
  expect(projectReadinessBackfill({ ...config, primary_provider: 'openai' }, row, now)).toBeNull();
  expect(projectReadinessBackfill(null, null, now)).toBeNull();
});
test('read projection is SELECT-only and degrades to pending on diagnostic storage failure', async () => {
  const database = { query: jest.fn(async () => ({ rows: [] })) };
  expect((await readReadinessBackfill(database, config)).reason).toBe('pending');
  expect(database.query.mock.calls[0][0]).toMatch(/^SELECT /);
  database.query.mockRejectedValue(new Error('private'));
  expect((await readReadinessBackfill(database, config)).reason).toBe('pending');
  const count = database.query.mock.calls.length;
  expect(await readReadinessBackfill(database, { ...config, ollama_verification_capability_checked_at: '2020-01-01' })).toBeNull();
  expect(await readReadinessBackfill(database, {})).toBeNull();
  expect(database.query).toHaveBeenCalledTimes(count);
});
