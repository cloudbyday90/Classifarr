/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, test, expect } from '@jest/globals';
import { createNamedMockModule, createTransactionalDbMock, createLoggerModuleMock } from './helpers/mockFactory.mjs';

const db = createTransactionalDbMock();
const { module: loggerModule } = createLoggerModuleMock();
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));
jest.unstable_mockModule('../utils/logger.mjs', () => loggerModule);
const { calculateNetConfidence } = await import('../services/autoLearningConfidence.mjs');
const { readEligibleLearningFeedback } = await import('../services/autoLearningFeedbackEvidence.mjs');

const settings = async () => ({ genreLearnThreshold: 3, keywordLearnThreshold: 5, studioLearnThreshold: 2, minConfidenceRate: 0.75 });
const empty = { confirmCount: 0, rejectCount: 0, netConfidence: 0, confidenceRate: 0, shouldApply: false };
const row = (selected_library_id, item_metadata, was_correction = false) => ({ selected_library_id, item_metadata, was_correction });
beforeEach(() => { db.query.mockReset(); });

test.each([
    ['genre', 'Action', { genres: ['Action'] }],
    ['keyword', 'hero', { keywords: [{ name: 'Super Hero' }] }],
    ['studio', 'Warner', { studio: 'Warner Bros' }],
])('%s ignores detached records while preserving valid confirmations and rejections', async (type, value, metadata) => {
    db.query.mockResolvedValue({ rows: [
        ...Array.from({ length: 6 }, () => row(5, metadata)),
        row(7, metadata), row(5, metadata, true),
        row(null, metadata), row(null, metadata, true), row(undefined, metadata),
    ] });
    expect(await calculateNetConfidence(5, value, type, settings)).toEqual({
        confirmCount: 6, rejectCount: 2, netConfidence: 4, confidenceRate: 0.75, shouldApply: true,
    });
    expect(db.query.mock.calls[0][1]).toEqual(['30 days', 5]);
});

test('malformed returned destinations cannot become negative evidence or discard valid rows', async () => {
    const metadata = { genres: ['Action'] };
    db.query.mockResolvedValue({ rows: [row(5, metadata), null,
        ...[null, undefined, 0, -1, '5', true, 5.2, NaN, Infinity, 2147483648].map(id => row(id, metadata))] });
    expect(await calculateNetConfidence(5, 'Action', 'genre', settings)).toEqual({ ...empty, confirmCount: 1, netConfidence: 1, confidenceRate: 1 });
});

test.each([null, undefined, 0, -1, '5', true, 5.2, NaN, Infinity, 2147483648])(
    'invalid candidate %s cannot query or enable learning', async candidate => {
        expect(await calculateNetConfidence(candidate, 'Action', 'genre', settings)).toEqual(empty);
        expect(await readEligibleLearningFeedback(db, candidate)).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
    });

test.each([
    { label: 'empty', rows: [], rejects: 0 },
    { label: 'detached', rows: [row(null, { genres: ['Action'] })], rejects: 0 },
    { label: 'negative only', rows: [row(7, { genres: ['Action'] })], rejects: 1 },
])(
    '$label evidence never enables learning with zero confirmations and zero thresholds', async ({ rows, rejects }) => {
        db.query.mockResolvedValue({ rows });
        const result = await calculateNetConfidence(5, 'Action', 'genre', async () => ({ genreLearnThreshold: 0, minConfidenceRate: 0 }));
        expect(result).toEqual({ ...empty, rejectCount: rejects, netConfidence: -rejects || 0 });
    });

test('database failure returns zero confidence without attempting settings or writes', async () => {
    db.query.mockRejectedValue(new Error('read unavailable'));
    let settingsCalled = false;
    expect(await calculateNetConfidence(5, 'Action', 'genre', async () => { settingsCalled = true; return {}; })).toEqual(empty);
    expect(settingsCalled).toBe(false); expect(db.query).toHaveBeenCalledTimes(1);
});

test('archived metadata cannot supply a destination for detached feedback', async () => {
    db.query.mockResolvedValue({ rows: [row(null, { genres: ['Action'], libraryId: 5,
        library_snapshot: { libraryId: 5, nameAtDetachment: 'Original library' } })] });
    expect(await calculateNetConfidence(5, 'Action', 'genre', settings)).toEqual(empty);
});
