/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const db = await import('../../config/database.mjs');
const { QueuedRoutingReplayGuard } = await import('../../services/queuedRoutingReplayGuard.mjs');
const { releaseQueueClaim, completeQueueClaim } = await import('../../services/queueTaskAcknowledgementService.mjs');
const { ClassificationService } = await import('../../services/classificationServiceCore.mjs');
const { ClassificationPersistenceService } = await import('../../services/classificationPersistenceService.mjs');
const { buildPolicyNativeClassificationQuestionHandoff } = await import('../../services/policyNativeClassificationQuestionHandoff.mjs');
const { policyRuntimeQuestionPersistenceAdmissionService } = await import('../../services/policyRuntimeQuestionPersistenceAdmission.mjs');
let task, historyId, libraryId, adjacentId;
const guard = () => new QueuedRoutingReplayGuard({ db });
const readTask = async () => (await getPool().query('SELECT * FROM task_queue WHERE id=$1', [task.id])).rows[0];
const readHistory = async id => (await db.query('SELECT status,metadata FROM classification_history WHERE id=$1', [id])).rows[0];
beforeEach(async () => {
  adjacentId = null;
  libraryId = (await getPool().query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES('Queued routing fixture','queued-routing','movie') RETURNING id`)).rows[0].id;
  historyId = (await getPool().query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,library_name,method,status,metadata)
    VALUES(42,'movie','Fixture',$1,'Queued routing fixture','policy_auto','completed',
      '{"classification_details":{"evidence":"preserved"}}') RETURNING id`, [libraryId])).rows[0].id;
  task = (await getPool().query(`INSERT INTO task_queue(task_type,payload,status,claim_token,visible_at)
    VALUES('classification','{}','processing',$1,NOW()+INTERVAL '10 minutes') RETURNING *`, [randomUUID()])).rows[0];
});
afterEach(async () => {
  await getPool().query('DELETE FROM task_queue WHERE id=$1', [task.id]);
  await getPool().query('DELETE FROM classification_history WHERE id=ANY($1::bigint[])', [[historyId, adjacentId]]);
  await getPool().query('DELETE FROM libraries WHERE id=$1', [libraryId]);
});

async function useHistoryId(id) {
  await db.query('UPDATE classification_history SET id=$1 WHERE id=$2', [id, historyId]);
  historyId = id;
}

function automaticRoute({ routeToArr, beforeRoute, blocked = false, database = db }) {
  const service = new ClassificationService({ db: database, createLogger: () => ({ debug: jest.fn() }),
    classificationRoutingService: { routeToArr },
  });
  return service.routeClassificationResult(historyId, { tmdb_id: 42, media_type: 'movie' }, {
    library: { id: libraryId }, method: 'policy_auto', confidence: 95,
    policyResult: { action: 'auto_classify', library: { library_id: libraryId } },
  }, blocked, beforeRoute);
}

test('a malformed selected library persists as pending without a route marker or a native question', async () => {
  const routeToArr = jest.fn();
  const loadProfileEvidence = jest.fn();
  const resolveStoredRoutingConfig = jest.fn();
  const writer = new ClassificationPersistenceService();
  const logClassification = writer.logClassification.bind(writer);
  jest.spyOn(writer, 'logClassification').mockImplementation((metadata, result, ...rest) => {
    // Refuse an unexpected completed write before a test could dispatch embeddings.
    expect(result).toMatchObject({ library: null, needs_clarification: true });
    return logClassification(metadata, result, ...rest);
  });
  const service = new ClassificationService({
    db, createLogger: () => ({ debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
    idleDetector: { recordActivity: jest.fn() },
    discordBot: { isInitialized: false },
    clarificationService: { isRequireAllConfirmationsEnabled: jest.fn().mockResolvedValue(false) },
    classificationRoutingService: { routeToArr },
    classificationPersistenceService: writer,
    classificationMetadataService: { parseOverseerrPayload: jest.fn().mockReturnValue({
      media_type: 'movie', tmdbId: 420006, title: 'Malformed selected library fixture',
      existingMetadata: { overview: 'Local fixture', genres: ['Animation'] },
    }) },
    policyNativeClassificationQuestionHandoffService: { build: input =>
      buildPolicyNativeClassificationQuestionHandoff({ ...input, loadProfileEvidence, resolveStoredRoutingConfig }) },
    policyRuntimeQuestionPersistenceAdmissionService,
  });
  service.runDecisionTree = jest.fn().mockResolvedValue({
    library: { id: ` ${libraryId} `, name: 'Unverified selection' }, confidence: 95, method: 'policy_auto',
    policyResult: { action: 'auto_classify', library: { library_id: libraryId } },
  });

  const result = await service.classifyQueueTask(task);
  adjacentId = result.classification_id;
  expect(result).toMatchObject({ success: true, destination: { libraryId: null, libraryName: null },
    routingOutcome: { shouldRoute: false }, runtimeQueueQuestionReduction: null });
  const { rows: [saved] } = await db.query(`SELECT status,library_id,library_name,policy_question,pending_reason
    FROM classification_history WHERE id=$1`, [adjacentId]);
  expect(saved).toMatchObject({ status: 'awaiting_decision', library_id: null, library_name: null,
    policy_question: null, pending_reason: expect.stringContaining('Retry Classification') });
  expect((await readTask()).routing_classification_id).toBeNull();
  expect(routeToArr).not.toHaveBeenCalled();
  expect(loadProfileEvidence).not.toHaveBeenCalled();
  expect(resolveStoredRoutingConfig).not.toHaveBeenCalled();
});

test.each(['routed', 'arr_add_failed', 'confirmation_required'])('automatic %s patches only the exact History row', async routing => {
  await useHistoryId('9007199254740993');
  adjacentId = '9007199254740992';
  await db.query(`INSERT INTO classification_history(id,tmdb_id,media_type,title,library_id,method,status,metadata)
    VALUES($1,43,'movie','Adjacent fixture',$2,'policy_auto','completed','{"classification_details":{"routing":"untouched"}}')`,
  [adjacentId, libraryId]);
  const adjacent = await readHistory(adjacentId);
  const blocked = routing === 'confirmation_required';
  const routeToArr = jest.fn(async () => {
    expect((await readTask()).routing_classification_id).toBe(historyId);
    expect((await readHistory(historyId)).metadata.classification_details.routing).toBe('automatic_routing_pending');
    return { attempted: true, routed: routing === 'routed', reason: routing, error: routing === 'routed' ? null : 'Fixture failure' };
  });
  const beforeRoute = jest.fn(id => guard().admit(task, id));
  const result = await automaticRoute({ routeToArr, beforeRoute, blocked });
  expect(result.shouldRoute).toBe(!blocked);
  expect(routeToArr).toHaveBeenCalledTimes(blocked ? 0 : 1);
  expect(beforeRoute).toHaveBeenCalledTimes(blocked ? 0 : 1);
  expect(await readHistory(historyId)).toEqual({ status: routing === 'routed' ? 'routed' : 'completed',
    metadata: { classification_details: { evidence: 'preserved', routing,
      ...(routing === 'arr_add_failed' ? { routing_error: 'Fixture failure' } : {}),
    } },
  });
  expect(await readHistory(adjacentId)).toEqual(adjacent);
  if (blocked) expect((await readTask()).routing_classification_id).toBeNull();
  else expect(await guard().read(task)).toMatchObject({ classification_id: historyId, recovered: true,
    routingOutcome: { routeResult: { routed: routing === 'routed' } },
  });
});

test('lost admission acknowledgement at maximum BIGINT recovers the marker without provider dispatch', async () => {
  await useHistoryId('9223372036854775807');
  const lost = new QueuedRoutingReplayGuard({ db: { withTransaction: async work => {
    await db.withTransaction(work);
    throw new Error('Fixture admission acknowledgement lost');
  } } });
  const routeToArr = jest.fn();
  await expect(automaticRoute({ routeToArr, beforeRoute: id => lost.admit(task, id) })).rejects.toThrow('acknowledgement lost');
  expect((await readTask()).routing_classification_id).toBe(historyId);
  expect(await guard().read(task)).toMatchObject({ classification_id: historyId, recovered: true,
    routingOutcome: { routeResult: { routed: false, reason: 'automatic_routing_unconfirmed' } },
  });
  await expect(automaticRoute({ routeToArr, beforeRoute: id => guard().admit(task, id) })).rejects.toThrow('already_admitted');
  expect(routeToArr).not.toHaveBeenCalled();
});

test('lost automatic closeout acknowledgement recovers the saved outcome without a second provider call', async () => {
  await useHistoryId('9223372036854775807');
  const database = { ...db, query: async (sql, values) => {
    await db.query(sql, values);
    throw new Error('Fixture closeout acknowledgement lost');
  } };
  const routeToArr = jest.fn().mockResolvedValue({ attempted: true, routed: true, reason: 'routed' });
  const beforeRoute = id => guard().admit(task, id);
  await expect(automaticRoute({ routeToArr, beforeRoute, database })).rejects.toThrow('acknowledgement lost');
  expect(await guard().read(task)).toMatchObject({ classification_id: historyId, recovered: true,
    routingOutcome: { routeResult: { routed: true, reason: 'routed' } },
  });
  await expect(automaticRoute({ routeToArr, beforeRoute })).rejects.toThrow('already_admitted');
  expect(routeToArr).toHaveBeenCalledTimes(1);
});

test('fresh command admits once; a fresh guard returns uncertainty without modifying the original decision', async () => {
  expect(await guard().read(task)).toBeNull();
  await guard().admit(task, historyId);
  await expect(guard().admit(task, historyId)).rejects.toThrow('already_admitted');
  expect(await guard().read(task)).toMatchObject({ classification_id: historyId, method: 'policy_auto',
    routingOutcome: { routeResult: { routed: false, reason: 'automatic_routing_unconfirmed' } } });
  const { rows: [history] } = await getPool().query('SELECT status,metadata FROM classification_history WHERE id=$1', [historyId]);
  expect(history).toEqual({ status: 'completed', metadata: { classification_details: {
    evidence: 'preserved', routing: 'automatic_routing_pending',
  } } });
});

test('concurrent admission commits exactly one marker', async () => {
  await useHistoryId('9007199254740993');
  const results = await Promise.allSettled([guard().admit(task, historyId), guard().admit(task, historyId)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await readTask()).routing_classification_id).toBe(historyId);
});

test.each(['missing-token', 'wrong-token', 'expired', 'cancelled', 'wrong-type'])('%s claim cannot read or admit', async kind => {
  if (kind === 'missing-token') task.claim_token = null;
  if (kind === 'wrong-token') task.claim_token = randomUUID();
  if (kind === 'expired') await getPool().query("UPDATE task_queue SET visible_at=NOW()-INTERVAL '1 second' WHERE id=$1", [task.id]);
  if (kind === 'cancelled') await getPool().query("UPDATE task_queue SET status='cancelled' WHERE id=$1", [task.id]);
  if (kind === 'wrong-type') await getPool().query("UPDATE task_queue SET task_type='metadata_enrichment' WHERE id=$1", [task.id]);
  await expect(guard().read(task)).rejects.toThrow('claim_not_owned');
  await expect(guard().admit(task, historyId)).rejects.toThrow('claim_not_owned');
  expect((await readTask()).routing_classification_id).toBeNull();
});

test('marker survives release and a new claim; old claim cannot acknowledge', async () => {
  await guard().admit(task, historyId);
  expect(await releaseQueueClaim(db, task)).toBe(true);
  await getPool().query(`UPDATE task_queue SET status='processing',claim_token=$2,
    visible_at=NOW()+INTERVAL '10 minutes' WHERE id=$1`, [task.id, randomUUID()]);
  const next = await readTask();
  await expect(guard().read(task)).rejects.toThrow('claim_not_owned');
  expect(await completeQueueClaim(db.query, task.id, {}, task.claim_token)).toBeNull();
  expect(await guard().read(next)).toMatchObject({ classification_id: historyId, recovered: true });
  await expect(guard().admit(next, historyId)).rejects.toThrow('already_admitted');
});

test('missing or changed classification rolls back admission', async () => {
  await getPool().query("UPDATE classification_history SET status='failed' WHERE id=$1", [historyId]);
  await expect(guard().admit(task, historyId)).rejects.toThrow('classification_unavailable');
  expect((await readTask()).routing_classification_id).toBeNull();
});

test('transaction failure after updating history leaves neither marker nor pending status', async () => {
  await useHistoryId('9223372036854775807');
  const failing = new QueuedRoutingReplayGuard({ db: { withTransaction: work => db.withTransaction(client => work({
    query: (sql, values) => sql.startsWith('UPDATE task_queue SET routing_classification_id')
      ? Promise.reject(new Error('injected_commit_boundary')) : client.query(sql, values),
  })) } });
  await expect(failing.admit(task, historyId)).rejects.toThrow('injected_commit_boundary');
  expect((await readTask()).routing_classification_id).toBeNull();
  const { rows: [history] } = await getPool().query('SELECT metadata FROM classification_history WHERE id=$1', [historyId]);
  expect(history.metadata.classification_details).toEqual({ evidence: 'preserved' });
});

test('history retention does not reopen a command', async () => {
  await guard().admit(task, historyId);
  await getPool().query('DELETE FROM classification_history WHERE id=$1', [historyId]);
  expect(await guard().read(task)).toMatchObject({ classification_id: historyId, method: null,
    routingOutcome: { routeResult: { routed: false, reason: 'automatic_routing_unconfirmed' } } });
  await expect(guard().admit(task, historyId)).rejects.toThrow('already_admitted');
});

test.each([['routed', 'routed', true], ['completed', 'routed', false], ['routed', 'automatic_routing_pending', false],
  ['corrected', 'routed', false]])('saved status %s and routing %s recover routed=%s', async (status, routing, routed) => {
  await guard().admit(task, historyId);
  await getPool().query(`UPDATE classification_history SET status=$2,
    metadata=jsonb_set(metadata,'{classification_details,routing}',to_jsonb($3::text)) WHERE id=$1`, [historyId, status, routing]);
  expect((await guard().read(task)).routingOutcome.routeResult.routed).toBe(routed);
});

test('deadline is checked after a contended row lock, not before waiting', async () => {
  const blocker = await getPool().connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM task_queue WHERE id=$1 FOR UPDATE', [task.id]);
    const pending = guard().admit(task, historyId);
    const assertion = expect(pending).rejects.toThrow('claim_not_owned');
    await blocker.query("UPDATE task_queue SET visible_at=NOW()-INTERVAL '1 second' WHERE id=$1", [task.id]);
    await blocker.query('COMMIT');
    await assertion;
    expect((await readTask()).routing_classification_id).toBeNull();
  } finally { await blocker.query('ROLLBACK'); blocker.release(); }
});
