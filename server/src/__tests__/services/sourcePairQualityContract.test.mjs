/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { qualitySnapshot, qualityReferences, qualityBatch } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { validQualityProtocol, readQualityReferences, qualityHash, qualityProtocolId } from '../../services/sourcePairQualityContract.mjs';

test('freezes 300 movie/TV cases independently of correction-priority sampling and keeps only opaque references', () => {
  const snapshot = qualitySnapshot(400), first = prepareSourcePairQualityProtocol(snapshot);
  snapshot.inputs.source.operatorFeedbackRows = snapshot.inputs.source.rows.filter(row => row.tmdb_id !== null)
    .map(row => ({ media_type: row.media_type, tmdb_id: row.tmdb_id, selected_library_id: row.library_id, was_correction: true, observed_at: '2026-09-20' }));
  const second = prepareSourcePairQualityProtocol(snapshot);
  expect(first.fixedSampleKeys).toEqual(second.fixedSampleKeys);
  expect(first.protocol.cases).toHaveLength(300);
  expect(new Set(first.protocol.cases.map(row => row.mediaType))).toEqual(new Set(['movie', 'tv']));
  expect(validQualityProtocol(first.protocol)).toBe(true);
  expect(JSON.stringify(first.protocol)).not.toMatch(/PRIVATE|localhost|test:latest|library_id/);
  expect(first.protocol.evidenceRevision).not.toBe(second.protocol.evidenceRevision);
  expect(prepareSourcePairQualityProtocol(snapshot, second.protocol).protocol).toEqual(second.protocol);
});

test.each(['expired', 'future', 'removed', 'policy', 'model', 'invalid'])('rejects changed %s evidence rather than silently rotating', kind => {
  const snapshot = qualitySnapshot(), protocol = prepareSourcePairQualityProtocol(snapshot).protocol;
  if (kind === 'expired') snapshot.observedAt = '2026-10-25T12:00:00.000Z';
  if (kind === 'future') snapshot.observedAt = '2026-09-24T12:00:00.000Z';
  if (kind === 'removed') snapshot.inputs.source.corpus.documents.pop();
  if (kind === 'policy') snapshot.inputs.source.policies[0].priority++;
  if (kind === 'model') snapshot.inputs.source.adjudicationBatch = qualityBatch(snapshot.inputs.source.adjudicationConfig.fingerprint, []);
  if (kind === 'invalid') protocol.providerCalls = 1;
  expect(() => prepareSourcePairQualityProtocol(snapshot, protocol)).toThrow(/quality_(cohort_changed|evidence_changed|protocol_invalid)/);
});

test('empty cohorts remain empty and are still age bounded', () => {
  const snapshot = qualitySnapshot(0), protocol = prepareSourcePairQualityProtocol(snapshot).protocol;
  expect(prepareSourcePairQualityProtocol(snapshot, protocol).protocol).toEqual(protocol);
  snapshot.observedAt = '2026-10-25T12:00:00.000Z';
  expect(() => prepareSourcePairQualityProtocol(snapshot, protocol)).toThrow('quality_cohort_changed');
});

test.each(['extra', 'duplicate', 'music', 'oversize', 'date', 'hash'])('protocol rejects %s even with a recomputed checksum', kind => {
  const protocol = prepareSourcePairQualityProtocol(qualitySnapshot()).protocol;
  if (kind === 'extra') protocol.private = 'PRIVATE';
  if (kind === 'duplicate') protocol.cases[1] = protocol.cases[0];
  if (kind === 'music') protocol.cases[0].mediaType = 'music';
  if (kind === 'oversize') protocol.cohort = Array.from({ length: 301 }, (_, i) => qualityHash(i));
  if (kind === 'date') protocol.createdAt = 'yesterday';
  if (kind === 'hash') protocol.evidenceRevision = 'invalid';
  protocol.id = qualityProtocolId(protocol);
  expect(validQualityProtocol(protocol)).toBeFalsy();
});

test('reference conflicts remain ungradable, duplicates deduplicate, and absent labels stay absent', () => {
  const protocol = prepareSourcePairQualityProtocol(qualitySnapshot()).protocol, reference = qualityReferences(protocol);
  const label = reference.labels[0];
  reference.labels.push({ ...label }, { ...label, target: protocol.destinations.find(row => row.mediaType === label.mediaType && row.target !== label.target).target });
  const result = readQualityReferences(reference, protocol);
  expect(result.conflicts).toEqual(new Set([label.item]));
  expect(result.labels.size).toBe(protocol.cases.length - 1);
  expect(readQualityReferences(null, protocol)).toEqual({ labels: new Map(), conflicts: new Set(), provenance: 'none' });
  expect(() => readQualityReferences(reference, {})).toThrow('quality_protocol_invalid');
});

test.each(['extra', 'wrong_protocol', 'provenance', 'music', 'item', 'target', 'reviewers', 'consensus', 'adjudicated', 'oversize', 'null'])('references reject %s', kind => {
  const protocol = prepareSourcePairQualityProtocol(qualitySnapshot()).protocol, reference = qualityReferences(protocol);
  if (kind === 'extra') reference.labels[0].private = 'PRIVATE';
  if (kind === 'wrong_protocol') reference.protocolId = qualityHash('another');
  if (kind === 'provenance') reference.provenance = 'model_agreement';
  if (kind === 'music') reference.labels[0].mediaType = 'music';
  if (kind === 'item') reference.labels[0].item = qualityHash('another');
  if (kind === 'target') reference.labels[0].target = protocol.destinations.find(row => row.mediaType !== reference.labels[0].mediaType).target;
  if (kind === 'reviewers') reference.labels[0].reviewerCount = 1;
  if (kind === 'consensus') reference.labels[0].consensus = 'majority';
  if (kind === 'adjudicated') reference.labels[0].consensus = 'adjudicated';
  if (kind === 'oversize') reference.labels = Array(601).fill(reference.labels[0]);
  if (kind === 'null') reference.labels[0] = null;
  expect(() => readQualityReferences(reference, protocol)).toThrow('quality_reference_invalid');
});
