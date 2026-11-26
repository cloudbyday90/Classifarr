/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { buildPolicyRequestImportDestinationAdmission } from '../../services/policyRequestImportDestinationAdmission.mjs';
import { buildPolicyRuntimeQueueQuestionReductionProducer } from '../../services/policyRuntimeQueueQuestionReductionProducer.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { QueueService } = await import('../../services/queueService.mjs');

function produce(task) {
  const result = buildPolicyRuntimeQueueQuestionReductionProducer({
    task,
    runtimeEvidenceInput: {
      libraryProfile: { identityCandidates: [{ label: 'Animated Movies', count: 8, trusted: true }] },
      operatorIntent: { belongsHere: [{ key: 'genre:animated', label: 'Animated Movies' }] },
    },
    routing: { mapped: true, targetName: 'Radarr Animated Movies' },
    classification: { completed: true, status: 'completed' },
    policyEvaluation: { hardLimitsSatisfied: true, avoidRulesSatisfied: true, highRiskConflicts: [] },
  });
  expect(result).toMatchObject({ ok: true, audit: { ok: true } });
  return result.queueQuestionReduction;
}

function admit(task, queueQuestionReduction) {
  const result = buildPolicyRequestImportDestinationAdmission({
    task,
    queueQuestionReduction,
    classification: {
      classification_id: 87,
      destination: { libraryId: 6, libraryName: 'Animated Movies' },
      routingOutcome: {
        shouldRoute: true,
        reason: 'policy_auto',
        routeResult: { attempted: true, routed: true, reason: 'routed' },
      },
    },
  });
  expect(result).toMatchObject({
    ok: true,
    statusId: 'outcome_only',
    finalOutcome: { status: 'routed', destinationLibraryId: 6 },
    learning: { canWriteLearning: false, profileRefreshQueued: false },
    audit: { ok: true },
  });
  expect(Object.values(result.sideEffects).every(effect => effect === false)).toBe(true);
  return result;
}

test('claimed queue IDs and attempts bind exact evidence through request import admission', async () => {
  const ids = [9007199254740991, '9007199254740992', '9007199254740993', '9223372036854775807'];
  const payloadTitle = 'Private queued media title';
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO task_queue (id, task_type, payload, priority, source)
      SELECT id, 'classification', $2::jsonb, (5 - position)::integer, 'webhook'
      FROM unnest($1::bigint[]) WITH ORDINALITY AS seeds(id, position)`,
    [ids, { title: payloadTitle }]);
    const logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const queue = new QueueService({ db: client, logger });
    const claims = [];
    const proofs = [];

    for (const id of ids) {
      const task = await queue.dequeue({ onlyTaskTypes: ['classification'] });
      expect(task).toMatchObject({ id, status: 'processing', attempts: 0, claim_token: expect.any(String) });
      const proof = produce(task);
      const expectedDigest = createHash('sha256').update(String(id), 'utf8').digest('hex');
      expect(proof.queueEvidence).toMatchObject({ taskFingerprint: expectedDigest, attempt: 0 });
      const result = admit(task, proof);
      expect(result.questionReduction).toEqual({
        statusId: 'valid', evidenceFingerprint: proof.queueEvidence.evidenceFingerprint,
      });
      const serialized = JSON.stringify({ proof, result });
      expect(serialized).not.toContain(payloadTitle);
      expect(serialized).not.toContain(task.claim_token);
      expect(serialized).not.toContain(String(id));
      claims.push(task);
      proofs.push(proof);
    }

    const canonicalTextClaim = { ...claims[0], id: String(claims[0].id) };
    expect(produce(canonicalTextClaim)).toEqual(proofs[0]);
    expect(admit(canonicalTextClaim, proofs[0]).questionReduction.statusId).toBe('valid');
    const adjacentEvidence = proofs[2].queueEvidence;
    expect(proofs[1].queueEvidence).toMatchObject({ evidenceFingerprint: adjacentEvidence.evidenceFingerprint });
    expect(proofs[1].queueEvidence.taskFingerprint).not.toBe(adjacentEvidence.taskFingerprint);
    expect(proofs[1].queueEvidence.executionFingerprint).not.toBe(adjacentEvidence.executionFingerprint);

    const rejected = { statusId: 'invalid', evidenceFingerprint: null };
    const crossTask = admit(claims[2], proofs[1]);
    expect(crossTask.questionReduction).toEqual(rejected);
    expect(crossTask.requestTimeDecision).toBeNull();

    const previousClaim = claims[2];
    expect(await queue.failTask(previousClaim.id, 'task_processing_failed', 0, 5, previousClaim.claim_token)).toBe(true);
    await client.query('UPDATE task_queue SET next_retry_at=NOW() WHERE id=$1', [previousClaim.id]);
    const nextClaim = await queue.dequeue({ onlyTaskTypes: ['classification'] });
    expect(nextClaim).toMatchObject({ id: previousClaim.id, attempts: 1 });
    expect(nextClaim.claim_token).not.toBe(previousClaim.claim_token);
    const staleAttempt = admit(nextClaim, proofs[2]);
    expect(staleAttempt.questionReduction).toEqual(rejected);
    expect(staleAttempt.requestTimeDecision).toBeNull();
    const freshProof = produce(nextClaim);
    expect(freshProof.queueEvidence.taskFingerprint).toBe(adjacentEvidence.taskFingerprint);
    expect(freshProof.queueEvidence.executionFingerprint).not.toBe(adjacentEvidence.executionFingerprint);
    expect(admit(nextClaim, freshProof).questionReduction.statusId).toBe('valid');
  } finally {
    try { await client.query('ROLLBACK'); } finally { client.release(); }
  }
});
