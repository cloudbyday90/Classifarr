/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import { createHeldOutSemanticStudyScope, heldOutSemanticStudyParameters } from '../../services/heldOutSemanticStudyScope.mjs';
import { createHeldOutSemanticStudyCapture } from '../../services/heldOutSemanticStudyCapture.mjs';
import { createHeldOutSemanticStudyPreparation } from '../../services/heldOutSemanticStudyPreparation.mjs';
import { validatePolicyCandidateCurrentInventorySemanticStudySnapshotDocument } from '../../services/policyCandidateCurrentInventorySemanticStudySnapshotContract.mjs';
import { createCurrentLibraryCandidateSemanticRetriever } from '../../services/currentLibraryCandidateSemanticRetriever.mjs';

const id = (prefix, index) => `${prefix}_${String(index).padStart(16, '0')}`;
const request = () => ({
  snapshotSetId: id('snapshot_set', 1),
  cases: Array.from({ length: 24 }, (_, index) => ({
    fixtureId: id('fixture', index), snapshotId: id('snapshot', index),
    metadata: { tmdb_id: index + 1, media_type: 'movie', title: 'Private title', overview: 'Private overview' },
  })),
});
const candidateContract = {
  valid: true, candidates: [{ libraryId: 10, mediaType: 'movie' }, { libraryId: 20, mediaType: 'movie' }],
};
const policies = [{ id: 1, library_id: 10, library_media_type: 'movie' }];
function setup(overrides = {}) {
  const preparation = {
    loadPolicies: jest.fn(async () => policies),
    prepare: jest.fn(async () => candidateContract),
  };
  const retriever = { retrieve: jest.fn(async () => ({
    version: 'current_library.candidate_semantic_retrieval.v2', statusId: 'available',
    candidates: [{ libraryId: 10, topRelevance: 48 }, { libraryId: 20, topRelevance: 95 }],
  })) };
  const readConfig = jest.fn(async () => ({ rag_enabled: true, embedding_model: 'Private model', api_key: 'secret' }));
  return { preparation, retriever, readConfig, ...overrides };
}

describe('held-out semantic study', () => {
  test('freezes the whole cohort before preparation and passes it to every retrieval', async () => {
    const deps = setup();
    deps.retriever.retrieve.mockImplementation(async ({ heldOutScope }) => {
      expect(deps.preparation.prepare).toHaveBeenCalledTimes(24);
      expect(heldOutScope.entries).toHaveLength(24);
      return { statusId: 'unavailable' };
    });
    const result = await createHeldOutSemanticStudyCapture(deps).capture(request());
    expect(result.status.id).toBe('complete');
    expect(validatePolicyCandidateCurrentInventorySemanticStudySnapshotDocument(result.document).ok).toBe(true);
    expect(result.summary.unavailableCount).toBe(24);
    const scope = deps.preparation.prepare.mock.calls[0][0].heldOutScope;
    expect(deps.preparation.prepare.mock.calls.every(([value]) => value.heldOutScope === scope)).toBe(true);
    expect(deps.retriever.retrieve.mock.calls.every(([value]) => value.heldOutScope === scope)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/Private|secret|tmdb_id|libraryId|overview/u);
  });

  test.each(['duplicate', 'missing', 'type', 'overflow', 'contract', 'source', 'too_few', 'coerced_id'])('rejects %s before preparation or provider I/O', async (kind) => {
    const input = request();
    if (kind === 'duplicate') input.cases[1].metadata.tmdb_id = 1;
    if (kind === 'missing') delete input.cases[1].metadata.tmdb_id;
    if (kind === 'type') input.cases[1].metadata.tmdb_id = '2';
    if (kind === 'overflow') input.cases[1].metadata.tmdb_id = 2_147_483_648;
    if (kind === 'contract') input.cases[1].contract = candidateContract;
    if (kind === 'source') input.cases[1].metadata.source_library_id = 10;
    if (kind === 'too_few') input.cases.pop();
    if (kind === 'coerced_id') input.cases[1].fixtureId = [input.cases[1].fixtureId];
    const deps = setup();
    expect((await createHeldOutSemanticStudyCapture(deps).capture(input)).document).toBeNull();
    expect(deps.preparation.loadPolicies).not.toHaveBeenCalled();
    expect(deps.retriever.retrieve).not.toHaveBeenCalled();
    expect(deps.readConfig).not.toHaveBeenCalled();
  });

  test('does not replace an ineligible case or emit partial snapshots', async () => {
    const deps = setup();
    deps.preparation.prepare.mockResolvedValueOnce(candidateContract).mockResolvedValueOnce({ valid: false });
    expect((await createHeldOutSemanticStudyCapture(deps).capture(request())).document).toBeNull();
    expect(deps.preparation.prepare).toHaveBeenCalledTimes(2);
    expect(deps.retriever.retrieve).not.toHaveBeenCalled();
  });

  test.each(['missing', 'count', 'fingerprint_type', 'extra'])('rejects %s held-out provenance', async (kind) => {
    const result = await createHeldOutSemanticStudyCapture(setup()).capture(request());
    const document = JSON.parse(JSON.stringify(result.document));
    if (kind === 'missing') delete document.studyProvenance;
    if (kind === 'count') document.studyProvenance.excludedIdentityCount = 23;
    if (kind === 'fingerprint_type') document.studyProvenance.configurationFingerprint = [document.studyProvenance.configurationFingerprint];
    if (kind === 'extra') document.studyProvenance.rawMetadata = 'private';
    expect(validatePolicyCandidateCurrentInventorySemanticStudySnapshotDocument(document).ok).toBe(false);
  });

  test('rejects configuration drift even if it recovers before the final check', async () => {
    const deps = setup();
    let reads = 0;
    deps.readConfig.mockImplementation(async () => ({ rag_enabled: true, embedding_model: ++reads === 27 ? 'changed' : 'original' }));
    expect((await createHeldOutSemanticStudyCapture(deps).capture(request())).document).toBeNull();
  });

  test('scope order is canonical, movie/TV identities remain distinct, forged scopes fail closed', async () => {
    const identities = request().cases.map((item) => item.metadata);
    identities[1] = { media_type: 'tv', tmdb_id: 1 };
    const scope = createHeldOutSemanticStudyScope(identities);
    expect(createHeldOutSemanticStudyScope([...identities].reverse()).fingerprint).toBe(scope.fingerprint);
    expect(heldOutSemanticStudyParameters(scope)[1].filter((value) => value === 1)).toHaveLength(2);
    expect(() => heldOutSemanticStudyParameters({ ...scope })).toThrow('invalid_held_out_scope');
    const embed = jest.fn();
    const retriever = createCurrentLibraryCandidateSemanticRetriever({ embed });
    await expect(retriever.retrieve({ metadata: identities[0], heldOutScope: null })).rejects.toThrow('invalid_held_out_scope');
    await expect(retriever.retrieve({ metadata: { media_type: 'tv', tmdb_id: 99 }, heldOutScope: scope })).rejects.toThrow('case_outside');
    expect(embed).not.toHaveBeenCalled();
  });

  test('candidate preparation explicitly bypasses assignment, history, profiles and patterns', async () => {
    const scope = createHeldOutSemanticStudyScope(request().cases.map((item) => item.metadata));
    const matches = [{ libraryId: 20, similarity: 0.9 }];
    const search = jest.fn(async () => matches);
    const evaluate = jest.fn(async (_metadata, options, deps) => {
      expect(options.ragCache.matches).toBe(matches);
      expect(options.relatedEvidence).toEqual([]);
      expect(await deps.checkAuthoritativeSignals()).toBeNull();
      expect(await deps.getActivePolicies()).toBe(policies);
      const evaluation = await deps.evaluatePolicy({ ...policies[0], trust_history: true, trust_patterns: true }, {}, { matches: [] }, []);
      expect(evaluation.scores).toMatchObject({ history: 0, profile: 0, pattern: 0 });
      expect(deps.determineAction([]).action).toBe('manual');
      return { action: 'manual', ranked: [] };
    });
    const preparation = createHeldOutSemanticStudyPreparation({ search, evaluate, loadPolicies: async () => [{
      ...policies[0], trust_history: true, trust_patterns: true,
      policy_intent_contract: { purpose: [{ source: 'media_server_library_profile' }, { source: 'operator' }] },
    }] });
    expect((await preparation.loadPolicies())[0]).toMatchObject({
      trust_history: false, trust_patterns: false, policy_intent_contract: { purpose: [{ source: 'operator' }] },
    });
    const metadata = request().cases[0].metadata;
    expect((await preparation.prepare({ metadata, heldOutScope: scope, policies })).valid).toBe(false);
    expect(search).toHaveBeenCalledWith(metadata, scope);
  });
});
