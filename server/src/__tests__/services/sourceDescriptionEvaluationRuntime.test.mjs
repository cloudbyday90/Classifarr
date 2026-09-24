/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { createSourceDescriptionEvaluationRepository, runSourceDescriptionEvaluation } from '../../services/sourceDescriptionEvaluationRuntime.mjs';
import { runOperatorCorrectionPolicyEvaluation } from '../../scripts/runOperatorCorrectionPolicyEvaluation.mjs';
import { sourcePairFixture, sourcePairIdentity as identity } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { FRESH_POLICY_CONFIG_SQL } from '../../services/freshInventoryPolicyRuntime.mjs';
import { INVENTORY_OUTCOME_LABEL_SQL } from '../../services/inventoryOutcomeLabels.mjs';

const originalEnvironment = { ...process.env };
afterEach(() => { process.env = { ...originalEnvironment }; });

test('repository captures source aliases, config, labels and partial cache in one read-only transaction', async () => {
  const source = sourcePairFixture(); let open = false;
  const query = jest.fn(async sql => {
    expect(open).toBe(true);
    return { rows: sql.includes('FROM media_server_items msi') ? source.rows : sql.includes('SELECT id, name') ? source.libraries
      : sql === FRESH_POLICY_CONFIG_SQL ? [source.config] : sql === INVENTORY_OUTCOME_LABEL_SQL ? []
        : sql.includes('embedding::text') ? [...source.vectors].slice(1).map(([description_hash, embedding]) => ({ description_hash,
          get embedding() { expect(open).toBe(false); return JSON.stringify(embedding); } })) : [] };
  });
  const withTransaction = jest.fn(async callback => { open = true; try { return await callback({ query }); } finally { open = false; } });
  const captured = await createSourceDescriptionEvaluationRepository({ withTransaction }).read(identity);
  expect(withTransaction).toHaveBeenCalledTimes(1);
  expect(captured.corpus.documents).toHaveLength(48); expect(captured.vectors.size).toBe(47);
  expect(captured.candidateMetadata.size).toBe(48);
  expect(query.mock.calls[0][0]).toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  expect(query.mock.calls.every(([sql]) => /^(SET |\s*SELECT )/.test(sql))).toBe(true);
  const corpusSql = query.mock.calls.find(([sql]) => sql.includes('FROM media_server_items msi'))[0];
  expect(corpusSql).toContain('msi.tmdb_id IS NULL'); expect(corpusSql).toContain('msi.imdb_id, msi.tvdb_id');
  expect(corpusSql).toContain('NOT EXISTS'); expect(corpusSql).not.toContain('msi.title');
});

test.each(['complete', 'cache_incomplete', 'failure', 'changed_configuration', 'aborted'])('runtime always closes on %s and never generates or embeds', async kind => {
  const source = sourcePairFixture();
  const runtime = { config: { ...source.config }, repository: { read: jest.fn(async () => source) }, close: jest.fn(),
    embedder: { inspect: jest.fn(async () => identity), embedBatch: jest.fn() }, createClient: jest.fn() };
  if (kind === 'failure') runtime.repository.read.mockRejectedValue(new Error('PRIVATE failure'));
  if (kind === 'changed_configuration') source.config.embedding_model = 'changed';
  if (kind === 'cache_incomplete') source.vectors.clear();
  const loadRuntime = jest.fn(async () => runtime);
  const promise = runSourceDescriptionEvaluation({ seed: 'source-pair-test-seed', size: 8 },
    { loadRuntime, ...(kind === 'aborted' ? { signal: AbortSignal.abort() } : {}) });
  if (['failure', 'changed_configuration', 'aborted'].includes(kind)) await expect(promise).rejects.toThrow();
  else expect((await promise).status).toBe(kind);
  expect(loadRuntime).toHaveBeenCalledWith({ createRepository: createSourceDescriptionEvaluationRepository });
  expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(runtime.embedder.embedBatch).not.toHaveBeenCalled(); expect(runtime.createClient).not.toHaveBeenCalled();
});

test('CLI opts into source pair with 300 cases, safe logging and read-only SQL defaults', async () => {
  const evaluate = jest.fn(async () => ({ status: 'complete' }));
  await runOperatorCorrectionPolicyEvaluation({ argv: ['--source-pair'], evaluate });
  expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ size: 300, generateCases: 0 }));
  expect(process.env.LOG_LEVEL).toBe('fatal'); expect(process.env.FILE_LOGGING_ENABLED).toBe('false');
  expect(process.env.PGOPTIONS).toContain('default_transaction_read_only=on');
});
test.each([['--generate-cases', '1'], ['--folds', '3'], ['--max-minutes', '1']])('source pair rejects misleading options before loading a runtime: %s', async (flag, value) => {
  const evaluate = jest.fn();
  await expect(runOperatorCorrectionPolicyEvaluation({ argv: ['--source-pair', flag, value], evaluate })).rejects.toThrow('fixed_grouped_folds');
  expect(evaluate).not.toHaveBeenCalled();
});
