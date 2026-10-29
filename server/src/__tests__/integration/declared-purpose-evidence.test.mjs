/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { purposeMatchFixture } from '../fixtures/purposeMatchEvidenceFixture.mjs';
import { buildNonClassifierHistoryMetadata } from '../../services/nonClassifierHistoryMetadata.mjs';
import { buildPolicyRuntimeQuestionDecisionPresentation } from '../../services/policyRuntimeQuestionDecisionPresentation.mjs';

test.each(['policy_engine', 'manual_classification', 'source_library'])('stored %s origin controls new declaration proof', async method => {
  const fixture = purposeMatchFixture();
  const metadata = method === 'policy_engine' ? fixture.sourceMetadata : buildNonClassifierHistoryMetadata(fixture.sourceMetadata, method);
  const row = (await getPool().query(`INSERT INTO classification_history(title,tmdb_id,media_type,method,status,metadata,confidence)
    VALUES('PRIVATE SOURCE',42,'movie',$1,'awaiting_decision',$2,70) RETURNING *`, [method, metadata])).rows[0];
  const before = JSON.stringify(row.metadata);
  const presentation = buildPolicyRuntimeQuestionDecisionPresentation({ classification: row,
    question: { meta: { candidates: [fixture.candidate] } }, candidateDestinations: [{ library_id: 4, library_name: 'Animation' }] });
  expect(presentation.deterministic.candidate_evidence_card.purpose_evidence.origin).toBe(method === 'policy_engine' ? 'declared_native' : 'unverified');
  expect(presentation.deterministic.candidate_evidence_card.version).toBe('policy.candidate_evidence_card.v2');
  expect(JSON.stringify(presentation.deterministic.candidate_evidence_card)).not.toMatch(/PRIVATE|Animation|policyId|tmdbId|require_any/);
  expect(JSON.stringify((await getPool().query('SELECT metadata FROM classification_history WHERE id=$1', [row.id])).rows[0].metadata)).toBe(before);
});
