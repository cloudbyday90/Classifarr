/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { calculateNetConfidence } = await import('../../services/autoLearningConfidence.mjs');
const { readEligibleLearningFeedback } = await import('../../services/autoLearningFeedbackEvidence.mjs');
const settings = async () => ({ genreLearnThreshold: 3, keywordLearnThreshold: 3, studioLearnThreshold: 3, minConfidenceRate: 0.75 });
const empty = { confirmCount: 0, rejectCount: 0, netConfidence: 0, confidenceRate: 0, shouldApply: false };
let db, candidate, other, inactive;

beforeEach(async () => {
    db = getPool();
    const libraries = (await db.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
        VALUES('Candidate','confidence-candidate','movie',true),('Other','confidence-other','movie',true),
            ('Inactive','confidence-inactive','movie',false) RETURNING id`)).rows;
    [candidate, other, inactive] = libraries.map(row => row.id);
});
afterEach(async () => {
    await db.query('DELETE FROM policy_feedback_log');
    await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [[candidate, other, inactive]]);
});
async function feedback(destination, { correction = false, days = 0, metadata = { genres: ['Action'], keywords: ['hero'], studio: 'Warner' } } = {}) {
    return (await db.query(`INSERT INTO policy_feedback_log(tmdb_id,selected_library_id,was_correction,item_metadata,prompted_at,user_reason_text)
        VALUES(123,$1,$2,$3,NOW()-$4::integer*INTERVAL '1 day','Preserved fixture reason') RETURNING id`,
    [destination, correction, metadata, days])).rows[0].id;
}
async function confirmations() { for (let i = 0; i < 3; i++) await feedback(candidate); }

test.each([['genre', 'Action'], ['keyword', 'hero'], ['studio', 'Warner']])(
    '%s confidence excludes detached/inactive evidence and preserves real rejections', async (type, value) => {
        await confirmations(); await feedback(other); await feedback(null); await feedback(null, { correction: true }); await feedback(inactive);
        const before = (await db.query('SELECT * FROM policy_feedback_log ORDER BY id')).rows;
        expect(await calculateNetConfidence(candidate, value, type, settings)).toEqual({
            confirmCount: 3, rejectCount: 1, netConfidence: 2, confidenceRate: 0.75, shouldApply: true,
        });
        expect((await db.query('SELECT * FROM policy_feedback_log ORDER BY id')).rows).toEqual(before);
    });

test.each([false, null])('candidate active state %s prevents automatic learning', async active => {
    await confirmations(); await db.query('UPDATE libraries SET is_active=$1 WHERE id=$2', [active, candidate]);
    expect(await calculateNetConfidence(candidate, 'Action', 'genre', settings)).toEqual(empty);
});

test('null destination activity and missing candidates remain ineligible', async () => {
    await feedback(other); await db.query('UPDATE libraries SET is_active=NULL WHERE id=$1', [other]);
    expect(await calculateNetConfidence(candidate, 'Action', 'genre', settings)).toEqual(empty);
    await db.query('DELETE FROM libraries WHERE id=$1', [candidate]);
    expect(await calculateNetConfidence(candidate, 'Action', 'genre', settings)).toEqual(empty);
});

test('a dangling non-null destination is excluded even when legacy FK enforcement was bypassed', async () => {
    const peer = await db.connect();
    try {
        await peer.query('BEGIN');
        // Deliberately create a historical corrupt fixture, then restore enforcement before the read.
        await peer.query('ALTER TABLE policy_feedback_log DISABLE TRIGGER ALL');
        await peer.query(`INSERT INTO policy_feedback_log(tmdb_id,selected_library_id,item_metadata)
            VALUES(123,2147483647,'{"genres":["Action"]}')`);
        await peer.query('ALTER TABLE policy_feedback_log ENABLE TRIGGER ALL'); await peer.query('COMMIT');
    } finally { await peer.query('ROLLBACK'); peer.release(); }
    expect(await calculateNetConfidence(candidate, 'Action', 'genre', settings)).toEqual(empty);
    expect((await db.query('SELECT count(*)::integer count FROM policy_feedback_log')).rows[0].count).toBe(1);
});

test('reset-style detachment remains excluded after library deletion and numeric ID reuse', async () => {
    await confirmations(); const record = await feedback(other, { metadata: { genres: ['Action'], library_snapshot: { libraryId: other } } });
    await db.query('UPDATE policy_feedback_log SET selected_library_id=NULL WHERE id=$1', [record]);
    await db.query('DELETE FROM libraries WHERE id=$1', [other]);
    await db.query(`INSERT INTO libraries(id,name,external_id,media_type,is_active) VALUES($1,'Replacement','confidence-reused','movie',true)`, [other]);
    const before = (await db.query('SELECT * FROM policy_feedback_log WHERE id=$1', [record])).rows[0];
    expect(await calculateNetConfidence(candidate, 'Action', 'genre', settings)).toEqual({
        confirmCount: 3, rejectCount: 0, netConfidence: 3, confidenceRate: 1, shouldApply: true,
    });
    expect((await db.query('SELECT * FROM policy_feedback_log WHERE id=$1', [record])).rows[0]).toEqual(before);
});

test('the existing 30-day window and correction scoring remain intact', async () => {
    await confirmations(); await feedback(candidate, { correction: true }); await feedback(other, { days: 31 });
    expect(await calculateNetConfidence(candidate, 'Action', 'genre', settings)).toEqual({
        confirmCount: 3, rejectCount: 1, netConfidence: 2, confidenceRate: 0.75, shouldApply: true,
    });
});

test('the reader is usable in a database-enforced read-only transaction', async () => {
    await confirmations(); const peer = await db.connect();
    try {
        await peer.query('BEGIN READ ONLY');
        expect(await readEligibleLearningFeedback(peer, candidate)).toHaveLength(3);
        await peer.query('COMMIT');
    } finally { await peer.query('ROLLBACK'); peer.release(); }
});
