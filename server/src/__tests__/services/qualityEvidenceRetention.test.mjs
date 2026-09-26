/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { qualitySnapshot, qualityReferences, qualityBatch } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { qualityHash } from '../../services/sourcePairQualityContract.mjs';
import { emptyQualityEvidence, validQualityEvidence } from '../../services/qualityEvidenceContract.mjs';
import { mergeQualityEvidence } from '../../services/qualityEvidenceMerge.mjs';
import { reportQualityEvidence } from '../../services/qualityEvidenceReport.mjs';
import { runSourcePairQualityThread } from '../../services/sourcePairQualityThreadClient.mjs';
import { runAutomaticSourcePairThread } from '../../services/automaticSourcePairThreadClient.mjs';
import { validQualityReviewPacket } from '../../services/qualityReviewPacket.mjs';

const protocol = prepareSourcePairQualityProtocol(qualitySnapshot(400)).protocol;
function windowEvidence(start, end, observedAt = protocol.createdAt) {
  const value = emptyQualityEvidence(protocol); value.observedAt = observedAt;
  for (let index = start; index < end; index++) {
    const row = value.cases[index];
    row.arms = [0, 1].map(arm => {
      const key = qualityHash([row.item, arm]), digest = qualityHash(['response', key]);
      value.requests.push({ key, digest, promptTokens: 100, outputTokens: 10, latencyMs: 5 });
      return { status: 'proposed', target: protocol.destinations.find(target => target.mediaType === row.mediaType).target,
        gap: 'none', requestKey: key, responseHash: digest };
    });
  }
  return value;
}

test('300 movie/TV cases accumulate across twelve disjoint 50-response windows without double-counting', () => {
  let retained = emptyQualityEvidence(protocol);
  for (let index = 0; index < 300; index += 25) {
    const observation = windowEvidence(index, index + 25);
    expect(observation.requests).toHaveLength(50);
    retained = mergeQualityEvidence(retained, observation, protocol);
    // Replaying a JSONB-shaped observation and restarting from serialized evidence is idempotent.
    const reordered = JSON.parse(JSON.stringify(observation));
    reordered.requests = reordered.requests.map(row => Object.fromEntries(Object.entries(row).reverse()));
    retained = mergeQualityEvidence(JSON.parse(JSON.stringify(retained)), reordered, protocol);
  }
  expect(validQualityEvidence(retained, protocol)).toBe(true);
  const report = reportQualityEvidence(retained, protocol, qualityReferences(protocol));
  expect(report).toMatchObject({ version: 'source_pair_quality_report.v2', status: 'synthetic_only',
    total: { sampled: 300, paired: 300, independent: { labels: 300, baseline: { correct: 300 }, sourceAware: { correct: 300 } } },
    usage: { uniqueCachedResponses: 600, historicalPromptTokens: 60000, historicalOutputTokens: 6000, historicalLatencyMs: 3000 },
    limits: { providerCalls: 0, routingWrites: 0, promotionAllowed: false, populationAccuracy: null } });
  expect(report.byMedia.movie.sampled).toBeGreaterThan(0); expect(report.byMedia.tv.sampled).toBeGreaterThan(0);
  expect(reportQualityEvidence(retained, protocol).status).toBe('insufficient_reference_labels');
  expect(JSON.stringify(retained)).not.toMatch(/PRIVATE|response":|title|overview|library_id/);
});

test('rejected responses persist, another arm backfills, and changed exact responses fail closed', () => {
  const previous = windowEvidence(0, 1), incoming = windowEvidence(0, 1);
  Object.assign(previous.cases[0].arms[0], { status: 'unavailable', target: null, gap: 'invalid_response' });
  const gap = emptyQualityEvidence(protocol).cases[0].arms[0];
  previous.requests.pop(); previous.cases[0].arms[1] = gap;
  incoming.requests.shift(); incoming.cases[0].arms[0] = gap;
  const merged = mergeQualityEvidence(previous, incoming, protocol);
  expect(merged.cases[0].arms.map(arm => arm.status)).toEqual(['unavailable', 'proposed']);
  expect(merged.requests).toHaveLength(2);
  const changed = structuredClone(merged); changed.requests[0].promptTokens++;
  expect(() => mergeQualityEvidence(merged, changed, protocol)).toThrow('quality_evidence_conflict');
});

test.each([
  value => { value.cases[0].title = 'private'; },
  value => { value.requests[0].promptTokens = 8193; },
  value => { value.cases[0].arms[0].target = qualityHash('outside destination'); },
  value => { value.cases[0].mediaType = 'music'; },
  value => { value.cases[0].arms[0].responseHash = qualityHash('different response'); },
  value => { value.cases[1].item = value.cases[0].item; },
  value => { value.observedAt = new Date(Date.parse(protocol.createdAt) + 30 * 86400000).toISOString(); },
])('strict persistence boundary rejects malformed or expired evidence (%#)', mutate => {
  const value = windowEvidence(0, 1); mutate(value); expect(validQualityEvidence(value, protocol)).toBe(false);
  expect(() => reportQualityEvidence(value, protocol)).toThrow('quality_observation_invalid');
});

test('stale observations cannot rewind retained evidence', () => {
  const newer = windowEvidence(0, 1, new Date(Date.parse(protocol.createdAt) + 1000).toISOString());
  expect(() => mergeQualityEvidence(newer, windowEvidence(0, 1), protocol)).toThrow('quality_observation_stale');
});

test('shared exact requests cost once and retained correction targets cannot silently change', () => {
  const observation = windowEvidence(0, 1), row = observation.cases[0];
  row.arms[1] = { ...row.arms[0] }; observation.requests.pop(); row.correctionTarget = row.arms[0].target;
  const merged = mergeQualityEvidence(observation, emptyQualityEvidence(protocol), protocol);
  expect(merged.cases[0].correctionTarget).toBe(row.correctionTarget);
  expect(reportQualityEvidence(merged, protocol).usage.uniqueCachedResponses).toBe(1);
  const conflicting = structuredClone(observation);
  conflicting.cases[0].correctionTarget = protocol.destinations.find(target => target.mediaType === row.mediaType && target.target !== row.correctionTarget).target;
  expect(() => mergeQualityEvidence(merged, conflicting, protocol)).toThrow('quality_evidence_conflict');
});

test('production worker returns hash-only observations and independently blinded review descriptions', async () => {
  const snapshot = qualitySnapshot(), source = snapshot.inputs.source;
  const capture = await runAutomaticSourcePairThread(snapshot, null, undefined, { includePlan: true });
  source.adjudicationBatch = qualityBatch(source.adjudicationConfig.fingerprint, capture.plan);
  const frozen = await runSourcePairQualityThread(snapshot);
  const evidence = await runSourcePairQualityThread(snapshot, frozen, null, { operation: 'collect' });
  expect(validQualityEvidence(evidence, frozen)).toBe(true);
  expect(reportQualityEvidence(evidence, frozen).total.paired).toBe(25);
  expect(JSON.stringify(evidence)).not.toMatch(/PRIVATE|response":|title|overview|library_id/);
  source.adjudicationBatch.records = source.adjudicationBatch.records.map(row => ({ ...row,
    generated: Object.fromEntries(Object.entries(row.generated).reverse()) }));
  const reordered = await runSourcePairQualityThread(snapshot, frozen, null, { operation: 'collect' });
  expect(reordered).toEqual(evidence);
  const packet = await runSourcePairQualityThread(snapshot, frozen, null, { operation: 'packet' });
  expect(validQualityReviewPacket(packet, frozen)).toBe(true);
  expect(validQualityReviewPacket(packet)).toBe(true);
  expect(packet.cases).toHaveLength(48); expect(packet.cases[0].title).toContain('PRIVATE title');
  expect(JSON.stringify(packet)).not.toMatch(/library_id|correctionTarget|requestKey|responseHash|destinationId|score|tmdb_id/);
  expect(validQualityReviewPacket({ ...packet, prediction: 'bad' })).toBe(false);
  expect(validQualityReviewPacket({ ...packet, cases: [null] })).toBe(false);
  expect(validQualityReviewPacket({ ...packet, destinations: [null] })).toBe(false);
  source.rows[0].overview += ' changed';
  await expect(runSourcePairQualityThread(snapshot, frozen, null, { operation: 'collect' })).rejects.toThrow('quality_');
}, 30000);
