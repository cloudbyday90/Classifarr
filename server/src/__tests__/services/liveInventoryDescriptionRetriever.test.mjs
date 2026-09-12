/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLiveInventoryDescriptionRetriever } from '../../services/liveInventoryDescriptionRetriever.mjs';
import { createPolicyCandidateAdjudicationEvidenceService, projectPolicyCandidateAdjudicationEvidenceForProvider } from '../../services/policyCandidateAdjudicationEvidence.mjs';
import { projectLiveInventoryDescriptionEvidence } from '../../services/liveInventoryDescriptionEvidence.mjs';
import { formatCandidateAdjudication } from '../../services/aiPromptBuilderFormatters.mjs';
import { AIResponseParser } from '../../services/aiResponseParser.mjs';

const contract = { valid: true, candidates: [1, 2].map(libraryId => ({ libraryId, mediaType: 'movie',
  libraryNumber: libraryId, libraryName: `Library ${libraryId}`, policyScore: 45 })) };
const metadata = { title: 'Test', media_type: 'movie', tmdb_id: 90, overview: 'An ocean voyage documentary.' };
function setup() {
  const config = { rag_enabled: true, embedding_provider_mode: 'same', primary_provider: 'ollama',
    embedding_model: 'test', ollama_host: 'localhost' };
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 };
  const embedder = { provider: identity.provider, model: identity.model,
    inspect: jest.fn(async () => ({ ...identity })), embedBatch: jest.fn(async () => [[1, 0]]) };
  const candidates = [1, 2].map(libraryId => ({ libraryId, eligible: 4, indexed: 4,
    items: [{ description: `PRIVATE voyage ${libraryId}`, similarity: 0.7, sharedAcrossCandidates: false }] }));
  const repository = { readConfig: jest.fn(async () => ({ ...config })), readQueryVector: jest.fn(async () => [1, 0]),
    retrieve: jest.fn(async () => candidates) };
  return { config, identity, candidates, embedder, repository,
    retriever: createLiveInventoryDescriptionRetriever({ repository, createEmbedder: () => embedder }) };
}

test('warm retrieval uses the query cache, same representation and every candidate without inference', async () => {
  const { retriever, repository, embedder } = setup();
  expect((await retriever.retrieve({ contract, metadata })).statusId).toBe('available');
  expect(embedder.embedBatch).not.toHaveBeenCalled();
  expect(repository.retrieve).toHaveBeenCalledWith(expect.objectContaining({ request: expect.objectContaining({
    key: 'movie:90', libraryIds: [1, 2], text: metadata.overview,
  }) }));
  expect(embedder.inspect).toHaveBeenCalledTimes(2);
});

test('baseline retrieval checks representation after the fit and rejects foreign selected libraries', async () => {
  const { retriever, repository, embedder } = setup();
  expect((await retriever.retrieve({ contract, metadata, matchLibraryId: 99 })).statusId).toBe('not_applicable');
  expect(repository.readConfig).not.toHaveBeenCalled();
  expect((await retriever.retrieve({ contract, metadata, matchLibraryId: 2 })).statusId).toBe('available');
  expect(repository.retrieve.mock.calls[0][0].request.matchLibraryId).toBe(2);
  expect(embedder.inspect).toHaveBeenCalledTimes(3);
  const original = await embedder.inspect();
  embedder.inspect.mockResolvedValueOnce(original).mockResolvedValueOnce(original).mockResolvedValueOnce({ ...original, digest: 'b'.repeat(64) });
  expect((await retriever.retrieve({ contract, metadata, matchLibraryId: 2 })).statusId).toBe('unavailable');
});

test('only an explicitly bounded internal retriever can compare more than three libraries', async () => {
  const { retriever, repository, embedder } = setup();
  const expanded = { valid: true, candidates: [1, 2, 3, 4].map(libraryId => ({ libraryId, mediaType: 'movie' })) };
  expect((await retriever.retrieve({ contract: expanded, metadata })).statusId).toBe('not_applicable');
  expect(repository.readConfig).not.toHaveBeenCalled();
  const scorer = createLiveInventoryDescriptionRetriever({ repository, createEmbedder: () => embedder, maxCandidates: 64 });
  await scorer.retrieve({ contract: expanded, metadata });
  expect(repository.retrieve.mock.calls[0][0].request.libraryIds).toEqual([1, 2, 3, 4]);
  for (const maxCandidates of [0, 1, 65, NaN, '64']) {
    expect(() => createLiveInventoryDescriptionRetriever({ maxCandidates })).toThrow('invalid_candidate_limit');
  }
});

test('live metadata reaches the learner and only allowlisted fit reaches local and remote comparison prompts', async () => {
  const { retriever, repository, candidates } = setup();
  for (const candidate of candidates) candidate.learnedProfile = {
    version: 'contrastive_profile_v1', statusId: 'available', relativeFit: candidate.libraryId === 1 ? 0.8 : -0.8,
    trainingDescriptions: 100, snapshotId: 'PRIVATE fingerprint', features: ['PRIVATE studio'],
  };
  const service = createPolicyCandidateAdjudicationEvidenceService({ getProfileStats: async () => null,
    retrieveCurrentLibraryEvidence: async () => null, retrieveCurrentLibrarySemanticEvidence: async () => null,
    retrieveInventoryDescriptions: retriever.retrieve });
  const evidence = await service.build({ contract, metadata: { ...metadata, genres: [{ name: 'Documentary' }], content_rating: 'PG' } });
  expect(repository.retrieve.mock.calls[0][0].request.queryMetadata).toEqual({ genres: ['documentary'], rating: 'pg', studio: '' });
  for (const provider of [{ providerType: 'ollama', providerHost: 'localhost' }, { providerType: 'remote' }]) {
    const projected = projectPolicyCandidateAdjudicationEvidenceForProvider(evidence, provider);
    const prompt = formatCandidateAdjudication(projected);
    expect(prompt).toContain('Learned inventory fit: 0.8');
    expect(prompt).toContain('Learned inventory fit: -0.8');
    expect(prompt).not.toContain('PRIVATE fingerprint');
    expect(prompt).not.toContain('PRIVATE studio');
    expect(projected.candidates.map(candidate => candidate.libraryNumber)).toEqual([1, 2]);
    expect(projected.candidates.map(candidate => candidate.policyScore)).toEqual([45, 45]);
  }
});

test('cold query embeds only one synopsis; incomplete inventory stays partial', async () => {
  const { retriever, repository, candidates, embedder } = setup();
  repository.readQueryVector.mockResolvedValue(null);
  candidates[1].indexed = 1;
  expect((await retriever.retrieve({ contract, metadata })).statusId).toBe('partial');
  expect(embedder.embedBatch).toHaveBeenCalledTimes(1);
  expect(embedder.embedBatch.mock.calls[0][0]).toEqual([metadata.overview]);
});

test.each([{}, { ...metadata, tmdb_id: 0 }, { ...metadata, overview: '' }, { ...metadata, media_type: 'tv' }])(
  'invalid identity/content/type makes no DB or provider call', async input => {
    const { retriever, repository, embedder } = setup();
    expect((await retriever.retrieve({ contract, metadata: input })).statusId).toBe('not_applicable');
    expect(repository.readConfig).not.toHaveBeenCalled();
    expect(embedder.inspect).not.toHaveBeenCalled();
  },
);

test.each([null, { valid: false }, { ...contract, candidates: [contract.candidates[0]] },
  { ...contract, candidates: [contract.candidates[0], contract.candidates[0]] },
  { ...contract, candidates: [...contract.candidates, ...contract.candidates] }])('invalid candidate boundary is rejected', async input => {
  const { retriever, repository } = setup();
  expect((await retriever.retrieve({ contract: input, metadata })).statusId).toBe('not_applicable');
  expect(repository.readConfig).not.toHaveBeenCalled();
});

test.each(['disabled', 'changed_model', 'changed_config', 'invalid_batch', 'database', 'aborted', 'empty'])(
  'unusable evidence fails closed: %s', async failure => {
    const { retriever, repository, embedder, config, identity, candidates } = setup();
    const controller = new AbortController();
    if (failure === 'disabled') config.rag_enabled = false;
    if (failure === 'changed_model') embedder.inspect.mockResolvedValueOnce(identity).mockResolvedValue({ ...identity, digest: 'b'.repeat(64) });
    if (failure === 'changed_config') repository.readConfig.mockResolvedValueOnce(config).mockResolvedValue({ ...config, embedding_model: 'changed' });
    if (failure === 'invalid_batch') { repository.readQueryVector.mockResolvedValue(null); embedder.embedBatch.mockResolvedValue([]); }
    if (failure === 'database') repository.retrieve.mockRejectedValue(new Error('PRIVATE secret'));
    if (failure === 'aborted') controller.abort();
    if (failure === 'empty') candidates.forEach(candidate => { candidate.items = []; candidate.indexed = 0; });
    const result = await retriever.retrieve({ contract, metadata, signal: controller.signal });
    expect(result.statusId).toBe('unavailable');
    expect(JSON.stringify(result)).not.toContain('secret');
  },
);

test('complete descriptions replace historical semantic work; partial evidence retains fallback', async () => {
  const { retriever, candidates } = setup();
  const fallback = jest.fn(async () => null);
  const service = createPolicyCandidateAdjudicationEvidenceService({ getProfileStats: async () => null,
    retrieveCurrentLibraryEvidence: async () => null, retrieveCurrentLibrarySemanticEvidence: fallback,
    retrieveInventoryDescriptions: retriever.retrieve });
  const evidence = await service.build({ contract, metadata });
  expect(fallback).not.toHaveBeenCalled();
  expect(evidence.candidates[1].descriptionEvidence.items[0].description).toContain('voyage 2');
  const local = projectPolicyCandidateAdjudicationEvidenceForProvider(evidence, { providerType: 'ollama', providerHost: 'localhost' });
  const prompt = formatCandidateAdjudication(local);
  expect(prompt).toContain('PRIVATE voyage 1');
  expect(prompt).toContain('PRIVATE voyage 2');
  expect(prompt).toContain('ALL candidates');
  expect(prompt).toContain('NOT a probability');
  for (const provider of [{ providerType: 'openai' }, { providerType: 'ollama', providerHost: 'https://public.example' }]) {
    const remote = projectPolicyCandidateAdjudicationEvidenceForProvider(evidence, provider);
    expect(JSON.stringify(remote)).not.toContain('PRIVATE');
    expect(remote.candidates[0].descriptionEvidence).toEqual({ statusId: 'available', eligible: 4, indexed: 4 });
  }
  candidates[1].indexed = 1;
  await service.build({ contract, metadata });
  expect(fallback).toHaveBeenCalledTimes(1);
});

test('provider projection caps and allowlists untrusted descriptions', () => {
  const evidence = { statusId: 'available', eligible: 5, indexed: 5, secret: 'hidden',
    items: Array.from({ length: 9 }, () => ({ description: '🛥'.repeat(1000), similarity: 0.5, secret: 'hidden' })) };
  const projected = projectLiveInventoryDescriptionEvidence(evidence, true);
  expect(projected.items).toHaveLength(3);
  expect([...projected.items[0].description]).toHaveLength(600);
  expect(JSON.stringify(projected)).not.toContain('hidden');
  expect(projectLiveInventoryDescriptionEvidence({ statusId: 'bad', eligible: -1, indexed: Infinity,
    items: [{ description: 'text', similarity: NaN }, { description: null, similarity: 1 }] }, true))
    .toEqual({ statusId: 'unavailable', eligible: 0, indexed: 0, items: [] });
  expect(projectLiveInventoryDescriptionEvidence(null)).toBeNull();
});

test.each(['PRIVATE output', '{"decision":"PRIVATE"}', ' {"invalid":PRIVATE} ',
  'CLARIFY|PRIVATE problem|PRIVATE reason|Choose?|Library 1,Library 2'])('adjudication never logs response content: %s', response => {
  const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, jest.fn()]));
  const parser = new AIResponseParser({ logger });
  parser.parse(response, { metadata, libraries: contract.candidates.map(candidate => ({ id: candidate.libraryId, name: candidate.libraryName })) }, { mode: 'adjudicate' });
  expect(JSON.stringify(Object.values(logger).flatMap(mock => mock.mock.calls))).not.toContain('PRIVATE');
});
