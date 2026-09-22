/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { captureOrganizationMetadata, mergeOrganizationMetadata, normalizeOrganizationName } from '../utils/metadataOrganizations.mjs';
import { projectInventoryCandidateMetadata, projectClassificationCandidateMetadata } from '../services/inventoryMetadataProjection.mjs';
import { parseOverseerrPayload, mergeMetadataForRecheck } from '../services/classificationMetadataServiceShared.mjs';
import { buildRetryPayload, buildMetadataEnrichmentPayload } from '../utils/classificationRetryPayloads.mjs';

const company = (name, id) => ({ ...(id === undefined ? {} : { id }), name });

test('organization roles survive ingestion and both retry payloads without sharing provider objects', () => {
  const input = { studio: ' Ｓｔｕｄｉｏ A\u0000 ', production_companies: [
    { id: 2, name: 'Producer B', logo_path: '/private', instructions: 'route here' }, 'Producer C',
  ] };
  const expected = { studio: 'Studio A', production_companies: [company('Producer B', 2), company('Producer C')] };
  const parsed = parseOverseerrPayload(input).existingMetadata;
  const retry = buildRetryPayload({}, parsed, 1);
  const enrichment = buildMetadataEnrichmentPayload(retry, {}, 1);
  for (const value of [parsed, retry, enrichment]) expect(captureOrganizationMetadata(value)).toEqual(expected);
  expect(projectClassificationCandidateMetadata(parsed)).toEqual(projectInventoryCandidateMetadata({ studio: 'Studio A' }));
  input.production_companies[0].name = 'Changed later';
  expect(parsed.production_companies).toEqual(expected.production_companies);
  retry.production_companies[0].name = 'Changed retry';
  expect(enrichment.production_companies).toEqual(expected.production_companies);
});

test.each([undefined, null, {}, [], 7, ' ', 'x'.repeat(161), 'ﷺ'.repeat(20)])('invalid/oversized studio is neutral: %j', value => {
  expect(normalizeOrganizationName(value)).toBeNull();
  expect(projectClassificationCandidateMetadata({ studio: value }).studio).toBe('');
});

test('a bounded Unicode studio has identical query and training features', () => {
  expect(projectClassificationCandidateMetadata({ studio: ' Ｓｔｕｄｉｏ\u200b A ' }).studio).toBe('studio a');
  expect(normalizeOrganizationName('x'.repeat(160))).toHaveLength(160);
});

test.each([
  'not an array', ['Valid', null], [{ title: 'Not a company name' }], Array(33).fill('Company'),
  ['x'.repeat(161)], [{ id: -1, name: 'Company' }], [{ id: '1', name: 'Company' }],
  [company('A', 1), company('B', 1)], [company('A', 1), company('a', 2)],
])('malformed or conflicting company claims are not partially admitted: %j', value => {
  expect(captureOrganizationMetadata({ production_companies: value })).toEqual({ production_companies: [] });
  expect(mergeOrganizationMetadata({ production_companies: ['Good'] }, { production_companies: value }).production_companies).toEqual([]);
});

test('deduplicates normalized names, preserves provider IDs and is idempotent', () => {
  const metadata = { production_companies: [' Ａ ', company('a', 1), company('a', 1), 'Other'] };
  const projected = captureOrganizationMetadata(metadata);
  expect(projected.production_companies).toEqual([company('a', 1), company('Other')]);
  expect(captureOrganizationMetadata(projected)).toEqual(projected);
  expect(captureOrganizationMetadata({ production_companies: Array(32).fill('A') }).production_companies).toEqual([company('A')]);
});

test('does not invent studio from companies, networks, library name or authority fields', () => {
  const metadata = { production_companies: [company('Producer', 1)], networks: ['Network'], library_name: 'Studio', trusted: true };
  expect(captureOrganizationMetadata(metadata)).toEqual({ production_companies: [company('Producer', 1)] });
  expect(projectClassificationCandidateMetadata(metadata).studio).toBe('');
  expect(captureOrganizationMetadata({})).toEqual({});
});

test('rechecks fill missing roles and retain compatible expanded sets, regardless of order', () => {
  const short = { production_companies: ['B'] };
  const longer = { production_companies: ['A', 'B'], studio: 'Explicit' };
  expect(mergeOrganizationMetadata(short, longer)).toEqual({ studio: 'Explicit', production_companies: [company('A'), company('B')] });
  expect(mergeOrganizationMetadata(longer, short)).toEqual(mergeOrganizationMetadata(short, longer));
  expect(mergeOrganizationMetadata({}, { production_companies: null })).toEqual({ production_companies: [] });
  expect(mergeOrganizationMetadata({ studio: 'Studio' }, { studio: 'studio' }).studio).toBe('studio');
});

test('rechecks leave contradictory roles neutral instead of choosing the longer string/list', () => {
  const merged = mergeMetadataForRecheck({ studio: 'A', production_companies: ['A'], title: 'Keep' },
    { studio: 'Longer B', production_companies: ['B', 'C'] });
  expect(merged).toEqual({ studio: null, production_companies: [], title: 'Keep' });
  expect(mergeOrganizationMetadata({ production_companies: ['A', {}] }, { production_companies: ['A'] }).production_companies).toEqual([]);
  expect(mergeOrganizationMetadata({ studio: 'Valid' }, { studio: {} }).studio).toBeNull();
  expect(mergeOrganizationMetadata({ production_companies: [company('A', 1)] }, { production_companies: [company('A', 2)] }).production_companies).toEqual([]);
});

test('expanded rechecks preserve known IDs and reject cross-source ID/name conflicts', () => {
  const original = { production_companies: [company('A', 1)] };
  const expanded = { production_companies: ['A', 'B'] };
  expect(mergeOrganizationMetadata(original, expanded).production_companies).toEqual([company('A', 1), company('B')]);
  expect(mergeOrganizationMetadata(expanded, original).production_companies).toEqual([company('A', 1), company('B')]);
  expect(mergeOrganizationMetadata(original, { production_companies: ['A', company('B', 1)] }).production_companies).toEqual([]);
  const full = { production_companies: Array.from({ length: 32 }, (_, index) => company(`Company ${index}`, index + 1)) };
  expect(mergeOrganizationMetadata(full, full)).toEqual(full);
});
