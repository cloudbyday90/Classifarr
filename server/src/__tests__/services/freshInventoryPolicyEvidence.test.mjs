/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { freshFixture, freshSettings } from '../fixtures/freshInventoryPolicyFixture.mjs';
import { prepareDescriptionBenchmark } from '../../services/inventoryDescriptionBenchmarkSample.mjs';
import { createFreshInventoryPolicyEvidence, projectFreshInventoryMetadata } from '../../services/freshInventoryPolicyEvidence.mjs';
import { prepareFreshInventoryPolicyCase } from '../../services/freshInventoryPolicyPreparation.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { projectFreshPolicyConfiguration } from '../../services/freshInventoryPolicyRuntime.mjs';

function setup(source = freshFixture().source) {
  const prepared = prepareDescriptionBenchmark(source, source.vectors, 2, freshSettings,
    { learnedProfiles: true, includeComparisonEvidence: true, preserveDescriptionCandidate: true });
  return { source, prepared, evidence: createFreshInventoryPolicyEvidence(source, prepared) };
}

test('all folds exclude held-out identities and duplicated descriptions from profiles and neighbors', async () => {
  const source = freshFixture().source;
  source.evaluationRows.push({ ...source.evaluationRows[0], tmdb_id: 500, library_id: 2 });
  source.corpus = prepareInventoryDescriptionCorpus(source.evaluationRows);
  const { prepared, evidence } = setup(source);
  for (const sample of prepared.cases) {
    const runtime = evidence.forCase(sample);
    const candidates = source.libraries.filter(library => library.media_type === sample.mediaType)
      .map(library => ({ libraryId: library.id, mediaType: sample.mediaType }));
    const result = await runtime.retrieve({ contract: { valid: true, candidates } });
    const heldKeys = new Set(source.corpus.documents.filter(doc => sample.heldDescriptionHashes.has(doc.hash)).map(doc => doc.key));
    for (const candidate of candidates) {
      const expected = source.evaluationRows.filter(row => row.library_id === candidate.libraryId && !heldKeys.has(`${row.media_type}:${row.tmdb_id}`));
      expect((await runtime.readProfile(candidate.libraryId)).totalItems).toBe(expected.length);
    }
    expect(result.statusId).toBe('available');
    expect(result.candidates.flatMap(candidate => candidate.items).every(item => item.description !== sample.overview)).toBe(true);
    expect(new Set(result.candidates.map(candidate => candidate.learnedProfile.snapshotId)).size).toBe(1);
    expect(await runtime.retrieveCurrent()).toBeNull();
    expect(runtime.metadata).not.toHaveProperty('library_id');
    expect(runtime.metadata).not.toHaveProperty('source_library_id');
    expect(runtime.metadata.keywords).toEqual(['voyage']);
    expect(runtime.metadata.original_language).toBe('en');
  }
});

test('conflicting query metadata is unavailable instead of selecting a convenient copy', () => {
  const { source, prepared } = setup();
  const sample = prepared.cases[0];
  const row = source.evaluationRows.find(row => row.tmdb_id === sample.itemIdentity.tmdbId);
  source.evaluationRows.push({ ...row, title: 'Different identity description' });
  expect(createFreshInventoryPolicyEvidence(source, prepared).forCase(sample)).toBeNull();
  expect(projectFreshInventoryMetadata({ ...row, title: '' })).toBeNull();
  expect(projectFreshInventoryMetadata({ ...row, year: 'bad', source_library_id: 999, metadata: { policyResult: { confidence: 100 } } }))
    .toMatchObject({ year: null });
});

test('missing folds, mismatched identities and leaked neighbor evidence fail closed', async () => {
  const { prepared, evidence } = setup();
  const sample = prepared.cases[0];
  expect(() => evidence.forCase({ ...sample, heldDescriptionHashes: null })).toThrow('fold_missing');
  expect(() => evidence.forCase({ ...sample, descriptionHash: 'other' })).toThrow('identity_mismatch');
  const runtime = evidence.forCase(sample);
  const candidate = sample.investigationCandidates[0];
  candidate.items[0].hash = sample.descriptionHash;
  expect(await runtime.retrieve({ contract: { valid: true, candidates: [{ libraryId: candidate.id, mediaType: sample.mediaType }] } }))
    .toEqual({ statusId: 'unavailable', candidates: [] });
  expect(await runtime.retrieve({ contract: { valid: false } })).toEqual({ statusId: 'unavailable', candidates: [] });
});

test('fresh policy scoring uses content without query placement shortcuts or stored results', async () => {
  const { source, prepared, evidence } = setup();
  const sample = prepared.cases[0], before = structuredClone(source);
  const result = await prepareFreshInventoryPolicyCase(sample, source, evidence);
  expect(result.policyResult.ranked.length).toBeGreaterThan(0);
  expect(result.policyResult.ranked.every(candidate => candidate.scores.history === 0 && candidate.scores.pattern === 0 && candidate.scores.rag === 0)).toBe(true);
  const changedLabels = await prepareFreshInventoryPolicyCase({ ...sample, observedLibraryIds: [999] }, source, evidence);
  expect(changedLabels.policyResult).toEqual(result.policyResult);
  expect(source).toEqual(before);
  expect(result.modeReason).toEqual(expect.any(String));
});

test('resolved native policy projection preserves scoring, constraints and decision mode', async () => {
  const { source, prepared, evidence } = setup();
  source.policies = source.policies.map(policy => ({ ...policy,
    configuration_view: { unused: 'Private authoring view' },
    policy_runtime_authority: { sourceId: 'native_intent', validationOk: true },
    policy_intent_contract: { source: 'native_intent', validation: { valid: true },
      purpose: [{ signal_type: 'genres', operator: 'require_any', values: { require_any: [`Genre ${policy.id - 1}`] }, semantics: 'identity' }],
      hard_limits: [], helpful_hints: [], avoid: [], review_behavior: { combination_mode: 'best_match' } },
  }));
  const full = await prepareFreshInventoryPolicyCase(prepared.cases[0], source, evidence);
  const projected = await prepareFreshInventoryPolicyCase(prepared.cases[0], {
    ...source, policies: source.policies.map(projectFreshPolicyConfiguration),
  }, evidence);
  expect(projected.policyResult).toEqual(full.policyResult);
  expect(projected.mode).toBe(full.mode);
  expect(projected.policyResult.ranked[0].native_intent_runtime.eligible).toBe(true);
});
