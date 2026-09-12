/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { identifyDescriptionDisagreements, buildDescriptionInvestigationCandidates, investigateDescriptionDisagreements } from '../../services/inventoryDescriptionBenchmarkInvestigation.mjs';

function fixture() {
  const libraries = [1, 2, 3, 4].map(id => ({ id, name: `Private library ${id}`, media_type: 'movie', items: [{ hash: String(id) }] }));
  const entry = { overview: 'Private synopsis', mediaType: 'movie', itemIdentity: { mediaType: 'movie', tmdbId: 77 },
    observedLibraryIds: [4], candidates: libraries.slice(0, 3), investigationCandidates: libraries };
  return { cases: [entry], texts: new Map(libraries.map(library => [String(library.id), 'Private example'])) };
}
const votes = (...values) => new Map([9, 30, 100].map((budget, index) => [budget, values[index] ?? 1]));
const client = response => ({ generate: jest.fn(async () => ({ response })) });

test('finds changed answers, placement mismatch, abstentions and shortlist omissions separately', () => {
  const prepared = fixture();
  const result = identifyDescriptionDisagreements(prepared, [votes(1, 2, 0)]);
  expect(result[0].reasons).toEqual(['observed_destination_not_shortlisted', 'answer_changed_with_budget', 'answer_differs_from_placement', 'model_abstained']);
  prepared.cases[0].observedLibraryIds = [1];
  expect(identifyDescriptionDisagreements(prepared, [votes()])).toEqual([]);
  expect(identifyDescriptionDisagreements(prepared, [new Map()])[0].reasons).toEqual(['comparison_incomplete']);
  expect(identifyDescriptionDisagreements(prepared, [])).toEqual([]);
});

test('recheck includes omitted destination, reverses order, and does not reveal prior answers', async () => {
  const prepared = fixture(), provider = client('{"candidate":3}'), inspect = jest.fn();
  const result = await investigateDescriptionDisagreements(prepared, [votes()], { client: provider, onPrivateCase: inspect });
  const packet = JSON.parse(provider.generate.mock.calls[0][0].prompt.split('\n')[3]);
  expect(packet.libraries.map(library => library.name)).toEqual(['Private library 2', 'Private library 1', 'Private library 4']);
  expect(JSON.stringify(packet)).not.toMatch(/observed|earlier|tmdbId/);
  expect(result.cases[0]).toMatchObject({ status: 'recheck_changes_answer', nextCheck: 'compare_content_with_declared_library_intent' });
  expect(inspect.mock.calls[0][0]).toMatchObject({ recheckDestination: 'Private library 4', observedDestinations: ['Private library 4'] });
  expect(JSON.stringify(result)).not.toMatch(/Private|synopsis|tmdbId|libraryIds/);
  expect(result.verifiedLabelsCreated).toBe(0);
});

test.each([
  ['{"candidate":2}', 'recheck_matches_an_earlier_answer'], ['{"candidate":0}', 'recheck_abstained'],
  ['{"candidate":9}', 'invalid_or_limited'], ['bad', 'invalid_or_limited'],
])('categorizes response without making a reference label: %s', async (response, status) => {
  expect((await investigateDescriptionDisagreements(fixture(), [votes()], { client: client(response) })).cases[0].status).toBe(status);
});

test('missing scope and evidence do not trigger a preference question or model call', async () => {
  const prepared = fixture(), provider = client('{}');
  prepared.cases[0].observedLibraryIds = [99];
  expect(buildDescriptionInvestigationCandidates(prepared.cases[0])).toBeNull();
  expect((await investigateDescriptionDisagreements(prepared, [votes()], { client: provider })).cases[0].nextCheck).toBe('technical_evidence_check');
  prepared.cases[0].observedLibraryIds = [1, 2, 3, 4];
  expect(buildDescriptionInvestigationCandidates(prepared.cases[0])).toBeNull();
  prepared.cases[0].observedLibraryIds = [4]; prepared.cases[0].investigationCandidates[3].items = [];
  expect(buildDescriptionInvestigationCandidates(prepared.cases[0])).toBeNull();
  expect(provider.generate).not.toHaveBeenCalled();
});

test('preflight and incomplete comparisons do not invent model observations', async () => {
  const provider = client('{}');
  expect((await investigateDescriptionDisagreements(fixture(), [], { client: provider })).cases[0].status).toBe('comparison_not_run');
  expect((await investigateDescriptionDisagreements(fixture(), [new Map()], { client: provider })).cases[0].status).toBe('comparison_incomplete');
  expect(provider.generate).not.toHaveBeenCalled();
});

test('bounds calls, isolates private callback errors and mutations, and handles cancellation', async () => {
  const prepared = fixture(), provider = client('{"candidate":1}');
  prepared.cases = Array.from({ length: 30 }, () => prepared.cases[0]);
  const result = await investigateDescriptionDisagreements(prepared, prepared.cases.map(() => votes()), {
    client: provider, onPrivateCase: async entry => { entry.reasons.push('Private poison'); throw new Error('Private error'); },
  });
  expect(result.recheckCalls).toBe(25);
  expect(result.statuses.budget_deferred).toBe(5);
  expect(result.inspectionFailures).toBe(30);
  expect(JSON.stringify(result)).not.toContain('Private');
  const controller = new AbortController(); controller.abort();
  expect((await investigateDescriptionDisagreements(fixture(), [votes()], { client: provider, signal: controller.signal })).cases[0].status).toBe('cancelled');
  await expect(investigateDescriptionDisagreements(prepared, [], { maximumRechecks: 26 })).rejects.toThrow();
});

test('provider failure or truncated response remains a technical issue', async () => {
  for (const provider of [{ generate: async () => { throw new Error('private'); } }, { generate: async () => ({ response: '{"candidate":1}', outputLimitReached: true }) }]) {
    expect((await investigateDescriptionDisagreements(fixture(), [votes()], { client: provider })).cases[0].nextCheck).toBe('technical_evidence_check');
  }
});
