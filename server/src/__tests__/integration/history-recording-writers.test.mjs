/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { buildQueueClassificationHistoryInsertQuery } from '../../services/queueClassificationHistoryQueries.mjs';
import { EVIDENCE_COVERAGE_SQL } from '../../services/evidenceCoverageQuery.mjs';
import { buildEvidenceCoverage } from '../../services/evidenceCoverageService.mjs';

// Exercise real writer SQL and transactions; provider/network effects stay stubbed.
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../services/classification.mjs', () => ({ classificationService: {} }));
jest.unstable_mockModule('../../services/embeddingService.mjs', () => ({ embeddingService: {
    generateAndStore: jest.fn(), isProviderBusyError: jest.fn().mockReturnValue(false),
} }));
jest.unstable_mockModule('../../services/libraryProfileService.mjs', () => ({ libraryProfileService: {
    getProfileStats: jest.fn().mockResolvedValue({}),
} }));
const db = await import('../../config/database.mjs');
const { QueueAdminService } = await import('../../services/queueAdminService.mjs');
const { ClassificationPersistenceService } = await import('../../services/classificationPersistenceService.mjs');
const graph = { director_name: null, primary_studio_name: null, genre_names: [], cast_ids: [], cast_names: [] };
let libraryId;
const metadata = () => ({ title: 'PRIVATE recording writer', media_type: 'movie', tmdb_id: 603,
    recorded_at: '1900-01-01T00:00:00Z', classification_details: { candidate_capture: { method: 'policy_auto', library_id: 88 } } });
beforeEach(async () => {
    libraryId = (await getPool().query(`INSERT INTO libraries(name,external_id,media_type)
        VALUES('Recording writer','recording-writer-fixture','movie') RETURNING id`)).rows[0].id;
});
afterEach(async () => {
    await getPool().query("DELETE FROM classification_history WHERE title='PRIVATE recording writer'");
    await getPool().query("DELETE FROM task_queue WHERE payload->>'recording_writer_fixture'='true'");
    await getPool().query('DELETE FROM libraries WHERE id=$1', [libraryId]);
});

async function expectRecorded(id, earliest) {
    const row = (await getPool().query(`SELECT recorded_at,recorded_at >= $2::timestamptz AS after_start,
        recorded_at <= statement_timestamp() AS before_read FROM classification_history WHERE id=$1`, [id, earliest])).rows[0];
    expect(row).toMatchObject({ after_start: true, before_read: true });
    expect(row.recorded_at).toBeInstanceOf(Date);
    expect(row.recorded_at.getUTCFullYear()).not.toBe(1900);
}
async function start() { return (await getPool().query('SELECT statement_timestamp()::text AS instant')).rows[0].instant; }

test.each([false, true])('classification persistence obtains a database instant, retry=%s', async retry => {
    const earliest = await start();
    const service = new ClassificationPersistenceService();
    const id = await service.logClassification(metadata(), {
        method: retry ? 'queued_for_retry' : 'policy_auto', confidence: 90, needs_retry: retry,
        library: { id: libraryId, name: 'Recording writer' }, recorded_at: '1900-01-01T00:00:00Z',
    });
    await expectRecorded(id, earliest);
});

async function expectOriginalType(field) {
    const coverage = buildEvidenceCoverage((await getPool().query(EVIDENCE_COVERAGE_SQL, [200])).rows[0]);
    expect(coverage.utc_library_coverage.totals).toMatchObject({ events: 1, captured_events: 1,
        observation_types: { [field]: 1, unknown_origin_events: 0 } });
    const stored = (await getPool().query("SELECT metadata FROM classification_history WHERE title='PRIVATE recording writer'")).rows[0].metadata;
    expect(stored.classification_details.candidate_capture).toMatchObject({ status: 'not_applicable', library_id: null });
}

test('source-library history SQL receives the same default and ignores metadata timestamps', async () => {
    const earliest = await start();
    const query = buildQueueClassificationHistoryInsertQuery({ tmdbId: 603, title: metadata().title,
        mediaType: 'movie', libraryId }, metadata(), 'Recording writer', graph);
    await getPool().query(query.text, query.values);
    const id = (await getPool().query("SELECT id FROM classification_history WHERE title='PRIVATE recording writer'")).rows[0].id;
    await expectRecorded(id, earliest);
    await expectOriginalType('imported_membership_events');
});

test('manual queue history is stamped after routing finishes inside the transaction', async () => {
    const taskId = (await getPool().query(`INSERT INTO task_queue(task_type,status,payload)
        VALUES('classification','pending',$1) RETURNING id`, [JSON.stringify({ media: metadata(), recording_writer_fixture: true })])).rows[0].id;
    let routeFinished;
    const routeToArr = jest.fn(async () => { routeFinished = await start(); });
    const service = new QueueAdminService({ db, logger: { info: jest.fn() },
        classificationService: { routeToArr }, ragGraphExtractor: { extract: () => graph } });
    const result = await service.manualClassifyTask(taskId, libraryId);
    expect(result.success).toBe(true);
    expect(routeToArr).toHaveBeenCalledTimes(1);
    await expectRecorded(result.classificationId, routeFinished);
    await expectOriginalType('manual_action_events');
    expect((await getPool().query('SELECT status FROM task_queue WHERE id=$1', [taskId])).rows[0].status).toBe('completed');
});
