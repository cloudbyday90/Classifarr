/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { buildPolicyRuntimeQueueQuestionReductionProducer } from '../../services/policyRuntimeQueueQuestionReductionProducer.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { QueueService } = await import('../../services/queueService.mjs');

function buildProof(task, mapped) {
  const result = buildPolicyRuntimeQueueQuestionReductionProducer({
    task,
    runtimeEvidenceInput: {
      libraryProfile: { identityCandidates: [{ label: 'Movies', count: 8, trusted: true }] },
      operatorIntent: { belongsHere: [{ key: 'genre:animation', label: 'Movies' }] },
    },
    routing: { mapped, targetName: 'Movies' },
    classification: { completed: true, status: 'completed' },
  });
  expect(result).toMatchObject({ ok: true, audit: { ok: true } });
  return result.queueQuestionReduction;
}

test.each([
  [true, 'webhook', true],
  [true, 'manual', false],
  [false, 'manual', true],
  [false, 'webhook', false],
])('persists exact History references for routed=%s source=%s proof=%s', async (routed, source, withProof) => {
  const expectedIds = [87, '9007199254740992', '9007199254740993', '9223372036854775807'];
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: [library] } = await client.query(`
      INSERT INTO libraries (name, external_id, media_type)
      VALUES ('Movies', 'terminal-history-fixture', 'movie') RETURNING id`);
    await client.query(`
      INSERT INTO classification_history (id, tmdb_id, media_type, title, method, status, library_id)
      SELECT id, (42000 + position)::integer, 'movie', 'Owned terminal fixture', 'policy_auto', $2, $3
      FROM unnest($1::bigint[]) WITH ORDINALITY AS ids(id, position)`,
    [expectedIds, routed ? 'routed' : 'completed', library.id]);

    const logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const classificationService = { classifyQueueTask: jest.fn(async (task, payload) => {
      const { rows: [history] } = await client.query('SELECT id FROM classification_history WHERE tmdb_id=$1', [payload.tmdb_id]);
      return {
        success: true,
        classification_id: history.id,
        destination: { libraryId: library.id, libraryName: 'Movies' },
        routingOutcome: {
          shouldRoute: true,
          routeResult: { attempted: routed, routed, reason: routed ? 'routed' : 'no_mapping' },
        },
        ...(withProof ? { runtimeQueueQuestionReduction: buildProof(task, routed) } : {}),
      };
    }) };
    const queue = new QueueService({ db: client, logger, classificationService });
    for (const [index, expectedId] of expectedIds.entries()) {
      const taskId = await queue.enqueue('classification',
        { tmdb_id: 42001 + index, media_type: 'movie', title: 'Owned terminal fixture' }, { source });
      const claim = await queue.dequeue();
      expect(claim).toMatchObject({ id: taskId, claim_token: expect.any(String) });
      await queue.queueTaskProcessorService.processClassificationTask(claim);

      const { rows: [saved] } = await client.query(`
        SELECT t.status, t.claim_token, t.payload->'result' AS result, h.id AS linked_history_id
        FROM task_queue AS t
        LEFT JOIN classification_history AS h
          ON h.id::text=t.payload#>>'{result,requestDestinationAdmission,finalOutcome,itemId}'
        WHERE t.id=$1`, [taskId]);
      const sourceEventId = `classification:${expectedId}`;
      expect(saved).toMatchObject({
        status: 'completed',
        claim_token: null,
        linked_history_id: expectedId,
        result: {
          classification_id: expectedId,
          requestDestinationAdmission: {
            statusId: 'outcome_only',
            event: { sourceEventId },
            finalOutcome: { itemId: expectedId, status: routed ? 'routed' : 'route_failed_missing_mapping' },
            learningIntake: { sourceEventId },
            learningGuard: { finalOutcome: { itemId: expectedId } },
            learning: { canWriteLearning: false, profileRefreshQueued: false },
            questionReduction: { statusId: withProof ? 'valid' : 'missing' },
            audit: { ok: true },
          },
        },
      });
      expect(Object.values(saved.result.requestDestinationAdmission.sideEffects).every(effect => effect === false)).toBe(true);
    }
  } finally {
    try { await client.query('ROLLBACK'); } finally { client.release(); }
  }
});

test('an invalid History reference omits the summary and still completes the owned queue task', async () => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const classifyQueueTask = jest.fn().mockResolvedValue({
      success: true,
      classification_id: '087',
      destination: { libraryId: 6, libraryName: 'Movies' },
      routingOutcome: { shouldRoute: true, routeResult: { attempted: true, routed: true, reason: 'routed' } },
    });
    const queue = new QueueService({ db: client, logger, classificationService: { classifyQueueTask } });
    const taskId = await queue.enqueue('classification',
      { tmdb_id: 42001, media_type: 'movie', title: 'Owned invalid-reference fixture' }, { source: 'webhook' });
    const claim = await queue.dequeue();
    expect(claim).toMatchObject({ id: taskId, claim_token: expect.any(String) });
    await queue.queueTaskProcessorService.processClassificationTask(claim);
    const { rows: [saved] } = await client.query(`
      SELECT status, claim_token, payload->'result' AS result FROM task_queue WHERE id=$1`, [taskId]);
    expect(saved).toMatchObject({ status: 'completed', claim_token: null, result: { classification_id: '087' } });
    expect(saved.result).not.toHaveProperty('requestDestinationAdmission');
  } finally {
    try { await client.query('ROLLBACK'); } finally { client.release(); }
  }
});
