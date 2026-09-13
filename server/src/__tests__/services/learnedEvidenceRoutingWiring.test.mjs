/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import * as db from '../../config/database.mjs';
import * as policyQueries from '../../services/policyEngineQueries.mjs';
import { learnedRoutingDependencies, learnedRoutingFixture } from '../fixtures/learnedEvidenceRoutingFixture.mjs';
import { hasCandidateConsensusReceipt } from '../../services/policyCandidateConsensusReceipt.mjs';

const getActivePolicies = jest.fn();
jest.unstable_mockModule('../../services/policyEngineQueries.mjs', () => ({ ...policyQueries, getActivePolicies }));
const { createLearnedEvidenceRoutingService } = await import('../../services/learnedEvidenceRoutingService.mjs');
const { createLiveInventoryDescriptionRetriever } = await import('../../services/liveInventoryDescriptionRetriever.mjs');

test('default configuration, active-policy and library readers preserve the strict route contract', async () => {
  const input = learnedRoutingFixture(), deps = learnedRoutingDependencies(input);
  const config = await deps.readConfig();
  const query = jest.fn(async sql => ({ rows: sql.includes('ai_provider_config') ? [config] : input.libraries }));
  const connect = jest.spyOn(db.pool, 'connect').mockResolvedValue({ query, release: jest.fn() });
  getActivePolicies.mockResolvedValue(input.policies);
  try {
    const service = createLearnedEvidenceRoutingService({ readPolicy: deps.readPolicy, retriever: deps.retriever });
    const learnedContext = await service.prepare(input);
    const result = await service.resolve({ ...input, learnedContext });
    expect(hasCandidateConsensusReceipt(result)).toBe(true);
    expect(getActivePolicies).toHaveBeenCalledWith({ throwOnError: true });
    expect(query.mock.calls.some(([sql]) => sql.includes("key='require_all_confirmations'"))).toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('is_active = true'), [[1, 2, 3]]);
    config.confirmation_setting = 'true';
    const heldContext = await service.prepare(input);
    expect(heldContext).not.toBeNull();
    expect(await service.resolve({ ...input, learnedContext: heldContext })).toBe(input.result);
    expect(service.shadowStatus().counts).toMatchObject({ prepared_admin_held: 1, strict_qualified_admin_held: 1 });
  } finally { connect.mockRestore(); }
});

test('default retriever uses a read-only transaction and refuses unavailable configuration without generation', async () => {
  const client = { query: jest.fn(async () => ({ rows: [] })), release: jest.fn() };
  const connect = jest.spyOn(db.pool, 'connect').mockResolvedValue(client);
  const createEmbedder = jest.fn();
  try {
    const result = await createLiveInventoryDescriptionRetriever({ createEmbedder }).retrieve({
      contract: { valid: true, candidates: [1, 2].map(libraryId => ({ libraryId, mediaType: 'movie' })) },
      metadata: { media_type: 'movie', tmdb_id: 90, overview: 'Test synopsis' },
      matchLibraryId: 1, neighborCalibration: true,
    });
    expect(result).toEqual({ statusId: 'unavailable', candidates: [] });
    expect(client.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(createEmbedder).not.toHaveBeenCalled();
  } finally { connect.mockRestore(); }
});
