/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { readAdjudicationProviderStatus } from '../../services/adjudicationProviderStatus.mjs';
import { runOperatorCorrectionPolicyEvaluation } from '../../scripts/runOperatorCorrectionPolicyEvaluation.mjs';

function fixture() {
  let inTransaction = false;
  const config = { primary_provider: 'ollama', ollama_host: 'PRIVATE endpoint', ollama_model: 'PRIVATE model' };
  const query = jest.fn(async () => ({ rows: [config] }));
  const database = { withTransaction: async callback => {
    inTransaction = true;
    try { return await callback({ query }); } finally { inTransaction = false; }
  } };
  const inspect = jest.fn(async signal => {
    expect(inTransaction).toBe(false);
    expect(signal).toBeInstanceOf(AbortSignal);
    return { model: 'PRIVATE', digest: 'PRIVATE' };
  });
  const createClient = jest.fn(() => ({ inspect }));
  return { database, query, inspect, createClient };
}

test('metadata-only report ends read-only transaction before HTTP and exposes no configuration/identity', async () => {
  const { database, query, createClient } = fixture();
  const result = await readAdjudicationProviderStatus(database, { createClient });
  expect(result).toMatchObject({ status: 'complete', providerStatus: 'ready', generationCalls: 0,
    databaseWrites: 0, capturePermissionChanged: false, scope: 'provider_metadata_only' });
  expect(query.mock.calls.slice(0, 3).map(([sql]) => sql)).toEqual([
    'SET TRANSACTION READ ONLY', "SET LOCAL statement_timeout='3s'", "SET LOCAL lock_timeout='1s'",
  ]);
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
  expect(result.recovery).toContain('does not enable capture');
});

test.each([
  ['description_benchmark_model_ambiguous', 'model_ambiguous'],
  ['description_benchmark_installed_local_model_required', 'model_missing'],
  ['description_benchmark_remote_model', 'remote_model'],
  ['description_benchmark_model_identity_invalid', 'model_identity_invalid'],
  ['description_benchmark_model_capability_invalid', 'model_capability_invalid'],
  ['description_benchmark_local_provider_required', 'unsupported_provider'],
  ['local_study_endpoint_required', 'unsupported_endpoint'],
  ['local_study_embedding_model_invalid', 'invalid_model_name'],
  ['description_benchmark_provider_failed', 'provider_unavailable'],
  ['PRIVATE token=secret https://user:password@example.com', 'inspection_unavailable'],
])('fixed diagnosis for %s never returns raw errors', async (message, providerStatus) => {
  const { database, createClient, inspect } = fixture();
  inspect.mockRejectedValue(new Error(message));
  const result = await readAdjudicationProviderStatus(database, { createClient });
  expect(result).toMatchObject({ status: 'blocked', providerStatus, generationCalls: 0, databaseWrites: 0 });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|token=|password|example\.com/);
  if (providerStatus === 'inspection_unavailable') expect(result.recovery).toContain('GitHub issue');
});

test('database failure and pre-cancelled inspection never reach the provider', async () => {
  const { database, createClient } = fixture();
  database.withTransaction = async () => { throw new Error('PRIVATE database context'); };
  expect(await readAdjudicationProviderStatus(database, { createClient })).toMatchObject({ providerStatus: 'inspection_unavailable' });
  expect(await readAdjudicationProviderStatus(database, { createClient, signal: AbortSignal.abort(new Error('PRIVATE')) }))
    .toMatchObject({ providerStatus: 'cancelled' });
  expect(createClient).not.toHaveBeenCalled();
});

test('duplicate model guidance names the upstream remedy conditionally without enabling capture', async () => {
  const { database, createClient, inspect } = fixture();
  inspect.mockRejectedValue(new Error('description_benchmark_model_ambiguous'));
  const result = await readAdjudicationProviderStatus(database, { createClient });
  expect(result).toMatchObject({ status: 'blocked', providerStatus: 'model_ambiguous',
    generationCalls: 0, databaseWrites: 0, capturePermissionChanged: false });
  expect(result.recovery).toContain('If the server runs Ollama 0.40.1');
  expect(result.recovery).toContain('update it to 0.40.2');
  expect(result.recovery).toContain('Otherwise, review the provider model mapping');
  expect(result.recovery).toContain('Repeat this check before enabling capture');
  expect(result.recovery).toContain('Do not delete models or bypass digest checks');
  expect(inspect).toHaveBeenCalledTimes(1);
});

test('inspection deadline cancels transport and retains a fixed diagnosis', async () => {
  const { database, createClient, inspect } = fixture();
  const controller = new AbortController();
  const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  try {
    inspect.mockImplementation(async signal => { controller.abort(new Error('PRIVATE timeout')); signal.throwIfAborted(); });
    expect(await readAdjudicationProviderStatus(database, { createClient })).toMatchObject({ providerStatus: 'inspection_timeout' });
    expect(timeout).toHaveBeenCalledWith(15000);
  } finally { timeout.mockRestore(); }
});

test('provider CLI is explicit, read-only and cannot mix inspection with activation or capture', async () => {
  const env = { ...process.env }, evaluate = jest.fn(async () => ({ status: 'complete' }));
  try {
    for (const extra of [['--source-pair-ai-budget-status'], ['--capture-source-pair-ai', '--max-calls', '5'],
      ['--configure-source-pair-ai-budget', '--daily-calls', '5', '--daily-tokens', '42240'], ['--source-pair'], ['--size', '5']]) {
      await expect(runOperatorCorrectionPolicyEvaluation({ argv: ['--source-pair-ai-provider-status', ...extra], evaluate })).rejects.toThrow();
    }
    expect(evaluate).not.toHaveBeenCalled();
    await runOperatorCorrectionPolicyEvaluation({ argv: ['--source-pair-ai-provider-status'], evaluate });
    expect(evaluate).toHaveBeenCalledWith({ providerStatus: true });
    expect(process.env.PGOPTIONS).toContain('default_transaction_read_only=on');
    expect(process.env.LOG_LEVEL).toBe('fatal');
    expect(process.env.FILE_LOGGING_ENABLED).toBe('false');
  } finally { process.env = env; }
});
