/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readAdjudicationBatch } from './cachedAdjudicationContract.mjs';
import { freezeAutomaticSourcePairCohort } from './automaticSourcePairCohort.mjs';
import { fingerprintSourcePairEvidence } from './automaticSourcePairComputation.mjs';
import { qualityHash, qualityTarget, qualityProtocolId, validQualityProtocol } from './sourcePairQualityContract.mjs';
const media = value => ['movie', 'tv'].includes(value);

/** Sampling sees no feedback labels; prediction still uses the existing feedback-group exclusions. */
export function prepareSourcePairQualityProtocol(snapshot, protocol = null) {
  if (protocol !== null && !validQualityProtocol(protocol)) throw new Error('quality_protocol_invalid');
  const { source } = snapshot.inputs;
  const state = protocol && { cohort: protocol.cohort, cohort_created_at: protocol.createdAt };
  const frozen = freezeAutomaticSourcePairCohort({ ...source, operatorFeedbackRows: [] }, state, snapshot.observedAt);
  if (protocol && frozen.reason !== 'reused') {
    if (protocol.cohort.length || frozen.cohort.length || Date.parse(snapshot.observedAt) - Date.parse(protocol.createdAt) < 0 ||
        Date.parse(snapshot.observedAt) - Date.parse(protocol.createdAt) >= 30 * 86400000) throw new Error('quality_cohort_changed');
    frozen.cohortCreatedAt = protocol.createdAt;
  }
  const identity = readAdjudicationBatch(source.adjudicationBatch, source.adjudicationConfig?.fingerprint)?.identity ?? null;
  const document = { version: 'source_pair_quality_protocol.v1', createdAt: new Date(frozen.cohortCreatedAt).toISOString(),
    cohort: frozen.cohort, evidenceRevision: fingerprintSourcePairEvidence(snapshot, { ...frozen, cohortCreatedAt: new Date(frozen.cohortCreatedAt).toISOString() }),
    modelRevision: qualityHash(identity && [identity.model, identity.digest, identity.contextLength]),
    cases: source.corpus.documents.filter(doc => frozen.fixedSampleKeys.has(doc.key))
      .map(doc => ({ item: qualityHash(doc.key), mediaType: doc.type })).sort((a, b) => a.item.localeCompare(b.item)),
    destinations: source.libraries.filter(row => row.is_active !== false && media(row.media_type))
      .map(row => ({ target: qualityTarget(row.media_type, row.id), mediaType: row.media_type })).sort((a, b) => a.target.localeCompare(b.target)),
    providerCalls: 0 };
  document.id = qualityProtocolId(document);
  if (!validQualityProtocol(document) || protocol && protocol.id !== document.id) throw new Error('quality_evidence_changed');
  return { protocol: document, fixedSampleKeys: frozen.fixedSampleKeys };
}
