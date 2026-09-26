/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourcePairFixture, sourcePairIdentity } from './sourceDescriptionPairFixture.mjs';
import { projectAdjudicationConfig } from '../../services/cachedAdjudicationRepository.mjs';

export function qualitySnapshot(count = 48) {
  const source = sourcePairFixture(count);
  source.rows = source.rows.map((row, index) => ({ ...row, title: `PRIVATE title ${index}`, year: 2020 }));
  source.evaluationRows = source.rows;
  source.policies = source.libraries.map(library => ({ id: library.id, library_id: library.id, enabled: true,
    name: 'PRIVATE policy', library_name: library.name, library_media_type: library.media_type,
    priority: 1, auto_classify_threshold: 85, prompt_threshold: 60, profile_weight: .5, rag_weight: .5,
    trust_rag: true, trust_patterns: false, trust_history: false, presets: [] }));
  source.policySourceRevisionRows = source.policies.map(policy => ({ policy_id: policy.id,
    media_type: policy.library_media_type, source_updated_at: '2026-09-01', mutable_attachment: false }));
  source.adjudicationConfig = projectAdjudicationConfig({ primary_provider: 'ollama', ollama_model: 'test:latest', ollama_host: 'localhost' });
  return { observedAt: '2026-09-25T12:00:00.000Z', inputs: { source, identity: sourcePairIdentity } };
}

// Deliberately synthetic. Never use source placement or model predictions as human truth.
export function qualityReferences(protocol, provenance = 'synthetic_fixture.v1') {
  return { version: 'source_pair_quality_reference.v1', protocolId: protocol.id, provenance,
    labels: protocol.cases.map(row => ({ ...row, target: protocol.destinations.find(target => target.mediaType === row.mediaType).target,
      consensus: 'unanimous', reviewerCount: 2 })) };
}

export const qualityBatch = (configuration, plan) => ({ version: 'cached_adjudication.v1', configuration,
  identity: { model: 'test:latest', digest: 'a'.repeat(64), contextLength: 8192 },
  records: plan.map(row => ({ key: row.key, generated: { response: '{"decision":"ABSTAIN","library_number":null}',
    latencyMs: 5, promptTokens: 100, outputTokens: 10, outputLimitReached: false, contextLimitSuspected: false, inputTruncation: 'unknown' } })) });
