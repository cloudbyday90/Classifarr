/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';

const mockDb = {
    query: jest.fn(),
    pool: { connect: jest.fn() }
};

const mockLoggerModule = {
    createLogger: jest.fn(() => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
    }))
};

const mockClassificationOutcomeService = { recordOutcome: jest.fn() };

const mockClassificationEvidenceService = {
    rememberExactMatch: jest.fn(),
    reinforceGenrePatterns: jest.fn()
};

const mockMetadataNormalization = {
    normalizeMetadataList: jest.fn(),
    normalizeMetadataListLower: jest.fn()
};

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLoggerModule, default: mockLoggerModule }));

jest.unstable_mockModule('../services/classificationOutcomeService.mjs', () => ({
    ...mockClassificationOutcomeService,
    classificationOutcomeService: mockClassificationOutcomeService
}));

jest.unstable_mockModule('../services/classificationEvidenceService.mjs', () => ({
    ...mockClassificationEvidenceService,
    classificationEvidenceService: mockClassificationEvidenceService
}));

jest.unstable_mockModule('../utils/metadataNormalization.mjs', () => ({ ...mockMetadataNormalization, default: mockMetadataNormalization }));

const { default: svc } = await import('../services/clarificationService.mjs');
const db = mockDb;
const classificationOutcomeService = mockClassificationOutcomeService;
const classificationEvidenceService = mockClassificationEvidenceService;
const { normalizeMetadataList, normalizeMetadataListLower } = mockMetadataNormalization;

const policyQuestionContext = {
    buildQuestionContextCacheKey: jest.fn(),
    extractQuestionContext: jest.fn(),
    getPolicyQuestionContextVersion: jest.fn(),
    isPolicyQuestionStale: jest.fn()
};

function makeMockClient() {
    return { query: jest.fn(), release: jest.fn() };
}

beforeEach(() => {
    db.query.mockReset();
    db.pool.connect.mockReset();
    classificationOutcomeService.recordOutcome.mockReset();
    classificationEvidenceService.rememberExactMatch.mockReset();
    classificationEvidenceService.reinforceGenrePatterns.mockReset();
    normalizeMetadataList.mockReset();
    normalizeMetadataListLower.mockReset();
    policyQuestionContext.buildQuestionContextCacheKey.mockReset();
    policyQuestionContext.extractQuestionContext.mockReset();
    policyQuestionContext.getPolicyQuestionContextVersion.mockReset();
    policyQuestionContext.isPolicyQuestionStale.mockReset();
    svc.policyQuestionContext = policyQuestionContext;
    jest.restoreAllMocks();
});

describe('createStatusError', () => {
    test('creates an Error with statusCode', () => {
        const err = svc.createStatusError('Not found', 404);
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Not found');
        expect(err.statusCode).toBe(404);
        expect(err.code).toBeUndefined();
    });

    test('attaches code when provided', () => {
        const err = svc.createStatusError('Invalid', 400, 'invalid_library_id');
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('invalid_library_id');
    });
});

describe('safeParseJson', () => {
    test('returns null for null/undefined/empty string', () => {
        expect(svc.safeParseJson(null)).toBeNull();
        expect(svc.safeParseJson(undefined)).toBeNull();
        expect(svc.safeParseJson('')).toBeNull();
    });

    test('returns null for non-JSON string (does not start with { or [)', () => {
        expect(svc.safeParseJson('plain text')).toBeNull();
        expect(svc.safeParseJson('123')).toBeNull();
    });

    test('parses valid JSON object string', () => {
        const obj = { question: 'Where?' };
        expect(svc.safeParseJson(JSON.stringify(obj))).toEqual(obj);
    });

    test('parses valid JSON array string', () => {
        expect(svc.safeParseJson('[1,2,3]')).toEqual([1, 2, 3]);
    });

    test('returns null for malformed JSON that starts with {', () => {
        expect(svc.safeParseJson('{bad json')).toBeNull();
    });
});

describe('parsePolicyQuestion', () => {
    test('returns null for falsy input', () => {
        expect(svc.parsePolicyQuestion(null)).toBeNull();
        expect(svc.parsePolicyQuestion('')).toBeNull();
    });

    test('calls safeParseJson for string input', () => {
        const input = JSON.stringify({ question: 'Where to route?' });
        const result = svc.parsePolicyQuestion(input);
        expect(result).toEqual({ question: 'Where to route?' });
    });

    test('returns object as-is when already an object', () => {
        const obj = { question: 'Already parsed' };
        expect(svc.parsePolicyQuestion(obj)).toBe(obj);
    });
});

describe('getQuestionOptionLibraryIds', () => {
    test('returns [] for null/undefined', () => {
        expect(svc.getQuestionOptionLibraryIds(null)).toEqual([]);
        expect(svc.getQuestionOptionLibraryIds(undefined)).toEqual([]);
    });

    test('returns [] when options is not an array', () => {
        expect(svc.getQuestionOptionLibraryIds({ options: null })).toEqual([]);
        expect(svc.getQuestionOptionLibraryIds({})).toEqual([]);
    });

    test('extracts valid integer library_ids', () => {
        const question = {
            options: [
                { library_id: '5' },
                { library_id: '10' },
                { library_id: '0' },
                { library_id: 'abc' },
                { library_id: null }
            ]
        };
        const ids = svc.getQuestionOptionLibraryIds(question);
        expect(ids).toContain(5);
        expect(ids).toContain(10);
        expect(ids).not.toContain(0);
        expect(ids.length).toBe(2);
    });

    test('deduplicates library_ids', () => {
        const question = {
            options: [{ library_id: '5' }, { library_id: '5' }, { library_id: '5' }]
        };
        expect(svc.getQuestionOptionLibraryIds(question)).toEqual([5]);
    });
});

describe('getTierFromPolicyThresholds', () => {
    const thresholds = { auto_classify_threshold: 80, prompt_threshold: 60 };

    test('returns null when thresholds is null', () => {
        expect(svc.getTierFromPolicyThresholds(75, null)).toBeNull();
    });

    test('returns auto tier when confidence >= auto threshold', () => {
        const result = svc.getTierFromPolicyThresholds(85, thresholds);
        expect(result.tier).toBe('auto');
        expect(result.action).toBe('auto_route');
        expect(result.min_confidence).toBe(80);
    });

    test('returns verify tier when confidence >= prompt but < auto', () => {
        const result = svc.getTierFromPolicyThresholds(70, thresholds);
        expect(result.tier).toBe('verify');
        expect(result.action).toBe('verify_buttons');
        expect(result.min_confidence).toBe(60);
    });

    test('returns null when confidence < prompt threshold', () => {
        expect(svc.getTierFromPolicyThresholds(50, thresholds)).toBeNull();
    });

    test('requireAllConfirmations=true forces verify even at auto-level confidence', () => {
        const result = svc.getTierFromPolicyThresholds(90, thresholds, true);
        expect(result?.tier).not.toBe('auto');
        expect(result.tier).toBe('verify');
    });

    test('clamps confidence values: >100 treated as 100', () => {
        const result = svc.getTierFromPolicyThresholds(150, thresholds);
        expect(result.tier).toBe('auto');
    });

    test('thresholds with equal auto and prompt: at auto threshold returns auto', () => {
        const eq = { auto_classify_threshold: 70, prompt_threshold: 70 };
        const result = svc.getTierFromPolicyThresholds(70, eq);
        expect(result.tier).toBe('auto');
    });

    test('normalizes missing policy thresholds conservatively', () => {
        expect(
            svc.getTierFromPolicyThresholds(84, { auto_classify_threshold: null, prompt_threshold: null })
        ).toBeNull();
    });

    test('clamps auto threshold above 95 before tiering', () => {
        const result = svc.getTierFromPolicyThresholds(90, {
            auto_classify_threshold: 100,
            prompt_threshold: 60,
        });
        expect(result.tier).toBe('verify');
        expect(result.max_confidence).toBe(94);
    });

    test('uses the higher threshold when prompt exceeds auto', () => {
        const result = svc.getTierFromPolicyThresholds(75, {
            auto_classify_threshold: 70,
            prompt_threshold: 80,
        });
        expect(result).toBeNull();
    });
});

describe('getThresholds', () => {
    test('returns rows from DB', async () => {
        const rows = [{ tier: 'auto', min_confidence: 80 }];
        db.query.mockResolvedValueOnce({ rows });
        const result = await svc.getThresholds();
        expect(result).toEqual(rows);
    });

    test('returns [] on error', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));
        const result = await svc.getThresholds();
        expect(result).toEqual([]);
    });
});

describe('getTierForConfidence', () => {
    test('returns matching tier from DB', async () => {
        const tier = { tier: 'auto', action: 'auto_route', min_confidence: 80, max_confidence: 100 };
        db.query.mockResolvedValueOnce({ rows: [tier] });
        const result = await svc.getTierForConfidence(90);
        expect(result).toEqual(tier);
        expect(db.query).toHaveBeenCalledWith(expect.any(String), [90]);
    });

    test('rounds confidence before querying', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ tier: 'auto' }] });
        await svc.getTierForConfidence(84.7);
        expect(db.query).toHaveBeenCalledWith(expect.any(String), [85]);
    });

    test('returns clarify fallback when no tier found and confidence < 70', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const result = await svc.getTierForConfidence(55);
        expect(result.tier).toBe('clarify');
        expect(result.action).toBe('clarify_questions');
    });

    test('returns auto fallback when no tier found and confidence >= 70', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const result = await svc.getTierForConfidence(75);
        expect(result.tier).toBe('auto');
        expect(result.action).toBe('auto_route');
    });

    test('returns null on DB error', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));
        const result = await svc.getTierForConfidence(80);
        expect(result).toBeNull();
    });
});

describe('isRequireAllConfirmationsEnabled', () => {
    test('returns true when setting value is "true"', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ value: 'true' }] });
        expect(await svc.isRequireAllConfirmationsEnabled()).toBe(true);
    });

    test('returns false when setting value is "false"', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ value: 'false' }] });
        expect(await svc.isRequireAllConfirmationsEnabled()).toBe(false);
    });

    test('returns false when setting row is absent', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await svc.isRequireAllConfirmationsEnabled()).toBe(false);
    });

    test('returns false on DB error', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));
        expect(await svc.isRequireAllConfirmationsEnabled()).toBe(false);
    });
});

describe('hasLanguagePresets', () => {
    test('returns true when DB returns at least one row', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
        expect(await svc.hasLanguagePresets()).toBe(true);
    });

    test('returns false when DB returns no rows', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        expect(await svc.hasLanguagePresets()).toBe(false);
    });

    test('appends mediaType clause when mediaType provided', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await svc.hasLanguagePresets('movie');
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('l.media_type = $1'),
            ['movie']
        );
    });

    test('returns false on DB error', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));
        expect(await svc.hasLanguagePresets()).toBe(false);
    });
});

describe('matchQuestions', () => {
    beforeEach(() => {
        normalizeMetadataListLower.mockReturnValue([]);
    });

    test('returns [] on DB error', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [] })
            .mockRejectedValueOnce(new Error('DB error'));
        const result = await svc.matchQuestions({ genres: [], keywords: [] });
        expect(result).toEqual([]);
    });

    test('returns [] when no questions score > 0', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 1, trigger_keywords: [], trigger_genres: [], question_type: 'general', score: 0 }] });
        const result = await svc.matchQuestions({ genres: [], keywords: [] });
        expect(result).toEqual([]);
    });

    test('keyword match adds score and returns question', async () => {
        normalizeMetadataListLower.mockImplementation(arr => (arr || []).map(x => x.toLowerCase()));
        db.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    trigger_keywords: ['action'],
                    trigger_genres: [],
                    question_type: 'general',
                    priority: 5
                }]
            });
        const result = await svc.matchQuestions({ genres: [], keywords: ['Action'] });
        expect(result.length).toBe(1);
        expect(result[0].id).toBe(1);
        expect(result[0].score).toBeGreaterThan(0);
    });

    test('respects maxQuestions limit', async () => {
        normalizeMetadataListLower.mockImplementation(arr => (arr || []).map(x => x.toLowerCase()));
        const questions = [1, 2, 3, 4].map(i => ({
            id: i,
            trigger_keywords: ['action'],
            trigger_genres: [],
            question_type: 'general',
            priority: i
        }));
        db.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: questions });
        const result = await svc.matchQuestions({ genres: [], keywords: ['action'] }, 2);
        expect(result.length).toBe(2);
    });

    test('language question gets 40-point boost when language is allowed', async () => {
        normalizeMetadataListLower.mockReturnValue([]);
        db.query
            .mockResolvedValueOnce({ rows: [{ 1: 1 }] })
            .mockResolvedValueOnce({
                rows: [{ id: 1, trigger_keywords: [], trigger_genres: [], question_type: 'language', priority: 1 }]
            });
        const result = await svc.matchQuestions({ genres: [], keywords: [], original_language: 'fr' });
        expect(result.length).toBe(1);
        expect(result[0].score).toBe(40);
    });
});

describe('getAllQuestions', () => {
    test('returns rows from DB ordered by priority', async () => {
        const rows = [{ id: 1, question_text: 'Where to route?' }];
        db.query.mockResolvedValueOnce({ rows });
        const result = await svc.getAllQuestions();
        expect(result).toEqual(rows);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY priority DESC'));
    });

    test('returns [] on error', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));
        expect(await svc.getAllQuestions()).toEqual([]);
    });
});

describe('createQuestion', () => {
    test('inserts question and returns new row', async () => {
        const row = { id: 42, question_text: 'Genre?' };
        db.query.mockResolvedValueOnce({ rows: [row] });
        const result = await svc.createQuestion({
            question_text: 'Genre?',
            question_type: 'genre',
            response_options: { a: { label: 'Option A' } }
        });
        expect(result).toEqual(row);
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO clarification_questions'),
            expect.arrayContaining(['Genre?', 'genre'])
        );
    });

    test('defaults trigger_keywords to [], priority to 0, enabled to true', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        await svc.createQuestion({ question_text: 'Q?', question_type: 't', response_options: {} });
        const params = db.query.mock.calls[0][1];
        expect(params[2]).toEqual([]);
        expect(params[3]).toEqual([]);
        expect(params[5]).toBe(0);
        expect(params[6]).toBe(true);
    });

    test('propagates DB errors', async () => {
        db.query.mockRejectedValueOnce(new Error('constraint violation'));
        await expect(svc.createQuestion({ question_text: 'Q?', question_type: 't', response_options: {} }))
            .rejects.toThrow('constraint violation');
    });
});

describe('deleteQuestion', () => {
    test('calls DELETE and returns true', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const result = await svc.deleteQuestion(5);
        expect(result).toBe(true);
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM clarification_questions'),
            [5]
        );
    });

    test('propagates DB errors', async () => {
        db.query.mockRejectedValueOnce(new Error('foreign key violation'));
        await expect(svc.deleteQuestion(5)).rejects.toThrow('foreign key violation');
    });
});

describe('updateQuestion', () => {
    test('builds UPDATE with only supplied fields', async () => {
        const row = { id: 1, question_text: 'Updated?' };
        db.query.mockResolvedValueOnce({ rows: [row] });
        const result = await svc.updateQuestion(1, { question_text: 'Updated?' });
        expect(result).toEqual(row);
        const sql = db.query.mock.calls[0][0];
        expect(sql).toContain('question_text');
        expect(sql).not.toContain('trigger_keywords');
    });

    test('propagates DB errors', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));
        await expect(svc.updateQuestion(1, { enabled: false })).rejects.toThrow('DB error');
    });
});

describe('updateThreshold', () => {
    test('builds UPDATE for supplied fields and returns row', async () => {
        const row = { tier: 'auto', min_confidence: 75 };
        db.query.mockResolvedValueOnce({ rows: [row] });
        const result = await svc.updateThreshold('auto', { min_confidence: 75 });
        expect(result).toEqual(row);
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE confidence_thresholds'),
            expect.arrayContaining([75, 'auto'])
        );
    });

    test('propagates DB errors', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));
        await expect(svc.updateThreshold('auto', { min_confidence: 75 })).rejects.toThrow('DB error');
    });
});

describe('recordResponse', () => {
    test('records response, updates classification, returns result', async () => {
        const question = {
            rows: [{
                id: 1,
                response_options: {
                    yes: { label: 'Yes', confidence_boost: 20 }
                }
            }]
        };
        const insertedRow = { id: 99, classification_id: 5, response_value: 'yes' };
        db.query
            .mockResolvedValueOnce(question)
            .mockResolvedValueOnce({ rows: [insertedRow] })
            .mockResolvedValueOnce({ rows: [] });
        const result = await svc.recordResponse(5, 1, 'yes', 'discordUser1', 60);
        expect(result.success).toBe(true);
        expect(result.confidenceAfter).toBe(80);
        expect(result.response).toEqual(insertedRow);
        expect(result.shouldReclassify).toBe(true);
    });

    test('clamps confidenceAfter at 100', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 1, response_options: { yes: { label: 'Yes', confidence_boost: 50 } } }] })
            .mockResolvedValueOnce({ rows: [{}] })
            .mockResolvedValueOnce({ rows: [] });
        const result = await svc.recordResponse(5, 1, 'yes', 'u', 90);
        expect(result.confidenceAfter).toBe(100);
    });

    test('shouldReclassify=false when confidenceAfter < 70', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 1, response_options: { no: { label: 'No', confidence_boost: 5 } } }] })
            .mockResolvedValueOnce({ rows: [{}] })
            .mockResolvedValueOnce({ rows: [] });
        const result = await svc.recordResponse(5, 1, 'no', 'u', 50);
        expect(result.shouldReclassify).toBe(false);
    });

    test('throws when question not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        await expect(svc.recordResponse(5, 99, 'yes', 'u', 60)).rejects.toThrow('Question not found');
    });

    test('throws when response value invalid', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, response_options: { yes: { label: 'Yes' } } }] });
        await expect(svc.recordResponse(5, 1, 'invalid_option', 'u', 60)).rejects.toThrow('Invalid response value');
    });
});

describe('getResponses', () => {
    test('returns joined rows for classificationId', async () => {
        const rows = [{ id: 1, response_value: 'yes' }];
        db.query.mockResolvedValueOnce({ rows });
        const result = await svc.getResponses(5);
        expect(result).toEqual(rows);
        expect(db.query).toHaveBeenCalledWith(expect.any(String), [5]);
    });

    test('returns [] on error', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));
        expect(await svc.getResponses(5)).toEqual([]);
    });
});

describe('getPendingClassifications', () => {
    test('returns rows with policy_question_stale=false when no policy_question', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ id: 1, status: 'awaiting_decision', policy_question: null }]
        });
        const result = await svc.getPendingClassifications();
        expect(result[0].policy_question_stale).toBe(false);
        expect(result[0].policy_question).toBeNull();
    });

    test('enriches rows with stale check when policy_question present', async () => {
        const parsedQ = { question: 'Where?', context: { version: 1 } };
        policyQuestionContext.buildQuestionContextCacheKey.mockReturnValue('key1');
        policyQuestionContext.extractQuestionContext.mockReturnValue({ version: 1 });
        policyQuestionContext.getPolicyQuestionContextVersion.mockResolvedValueOnce(2);
        policyQuestionContext.isPolicyQuestionStale.mockReturnValueOnce(true);
        db.query.mockResolvedValueOnce({
            rows: [{ id: 1, status: 'awaiting_decision', policy_question: JSON.stringify(parsedQ) }]
        });
        const result = await svc.getPendingClassifications();
        expect(result[0].policy_question_stale).toBe(true);
        expect(result[0].policy_question_stale_reason).toBe('policy_context_changed');
    });

    test('returns [] on DB error', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));
        expect(await svc.getPendingClassifications()).toEqual([]);
    });
});

describe('resolvePolicyQuestion', () => {
    test('resolves successfully when classification is awaiting_decision', async () => {
        const client = makeMockClient();
        db.pool.connect.mockResolvedValueOnce(client);
        const classification = {
            id: 1, status: 'awaiting_decision',
            library_id: null, library_name: 'Movies',
            media_type: 'movie', metadata: null, policy_question: null
        };
        client.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [classification] })
            .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', arr_type: 'radarr', media_type: 'movie', is_active: true }] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});
        classificationOutcomeService.recordOutcome.mockResolvedValueOnce({});
        normalizeMetadataList.mockReturnValue([]);
        const result = await svc.resolvePolicyQuestion(1, 5, 'option_a', 'adminUser');
        expect(result.success).toBe(true);
        expect(result.libraryId).toBe(5);
        expect(result.shouldRoute).toBe(true);
        expect(client.query).toHaveBeenCalledWith('COMMIT');
        expect(client.release).toHaveBeenCalled();
    });

    test('throws 404 when classification does not exist', async () => {
        const client = makeMockClient();
        db.pool.connect.mockResolvedValueOnce(client);
        client.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 5 }] })
            .mockResolvedValueOnce({ rows: [] });
        await expect(svc.resolvePolicyQuestion(999, 5, 'opt', 'admin'))
            .rejects.toThrow('Classification not found');
        expect(client.query).toHaveBeenCalledWith('ROLLBACK');
        expect(client.release).toHaveBeenCalled();
    });

    test('returns alreadyResolved=true when status is completed with same library', async () => {
        const client = makeMockClient();
        db.pool.connect.mockResolvedValueOnce(client);
        client.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 5 }] })
            .mockResolvedValueOnce({ rows: [{ status: 'completed', library_id: '5', library_name: 'Movies' }] })
            .mockResolvedValueOnce({});
        const result = await svc.resolvePolicyQuestion(1, 5, 'opt', 'admin');
        expect(result.alreadyResolved).toBe(true);
        expect(result.success).toBe(true);
        expect(client.query).toHaveBeenCalledWith('COMMIT');
    });

    test('throws 409 when classification is no longer awaiting_decision (different state)', async () => {
        const client = makeMockClient();
        db.pool.connect.mockResolvedValueOnce(client);
        client.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 5 }] })
            .mockResolvedValueOnce({ rows: [{ status: 'pending_retry', library_id: '99', library_name: 'Other' }] });
        await expect(svc.resolvePolicyQuestion(1, 5, 'opt', 'admin'))
            .rejects.toThrow('Classification is no longer awaiting decision');
        expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('throws 400 when library is inactive', async () => {
        const client = makeMockClient();
        db.pool.connect.mockResolvedValueOnce(client);
        client.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [{ id: 1, status: 'awaiting_decision', media_type: 'movie', policy_question: null, metadata: null, library_name: 'M' }] })
            .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', arr_type: 'radarr', media_type: 'movie', is_active: false }] });
        await expect(svc.resolvePolicyQuestion(1, 5, 'opt', 'admin'))
            .rejects.toThrow('Selected library is inactive');
        expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('throws 400 on media type mismatch', async () => {
        const client = makeMockClient();
        db.pool.connect.mockResolvedValueOnce(client);
        client.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [{ id: 1, status: 'awaiting_decision', media_type: 'movie', policy_question: null, metadata: null, library_name: 'M' }] })
            .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Shows', arr_type: 'sonarr', media_type: 'show', is_active: true }] });
        await expect(svc.resolvePolicyQuestion(1, 5, 'opt', 'admin'))
            .rejects.toThrow('not valid for this media type');
        expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('throws 409 when policy question is stale', async () => {
        const client = makeMockClient();
        db.pool.connect.mockResolvedValueOnce(client);
        const policyQ = { question: 'Where?', context: { version: 1 } };
        client.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [{ id: 1, status: 'awaiting_decision', media_type: 'movie', metadata: null, library_name: 'M', policy_question: JSON.stringify(policyQ) }] })
            .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: true }] });
        policyQuestionContext.extractQuestionContext.mockReturnValueOnce({ version: 1 });
        policyQuestionContext.getPolicyQuestionContextVersion.mockResolvedValueOnce(2);
        policyQuestionContext.isPolicyQuestionStale.mockReturnValueOnce(true);
        await expect(svc.resolvePolicyQuestion(1, 5, 'opt', 'admin'))
            .rejects.toThrow('Policy question is stale');
        expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('generates learned pattern when generateRule=true and tmdb_id present', async () => {
        const client = makeMockClient();
        db.pool.connect.mockResolvedValueOnce(client);
        const classification = {
            id: 1, status: 'awaiting_decision',
            library_name: 'Movies', media_type: 'movie',
            metadata: JSON.stringify({ tmdb_id: 12345, genres: ['Action'] }),
            policy_question: null
        };
        client.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [classification] })
            .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: true }] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});
        classificationOutcomeService.recordOutcome.mockResolvedValueOnce({});
        classificationEvidenceService.rememberExactMatch.mockResolvedValueOnce({ id: 77 });
        classificationEvidenceService.reinforceGenrePatterns.mockResolvedValueOnce({});
        normalizeMetadataList.mockReturnValue(['Action']);
        const result = await svc.resolvePolicyQuestion(1, 5, 'opt', 'admin', true);
        expect(result.generatedPattern).toEqual({ id: 77 });
        expect(classificationEvidenceService.rememberExactMatch).toHaveBeenCalled();
        expect(classificationEvidenceService.reinforceGenrePatterns).toHaveBeenCalled();
    });

    test('does not generate pattern when generateRule=false', async () => {
        const client = makeMockClient();
        db.pool.connect.mockResolvedValueOnce(client);
        const classification = {
            id: 1, status: 'awaiting_decision',
            library_name: 'Movies', media_type: 'movie',
            metadata: JSON.stringify({ tmdb_id: 12345 }),
            policy_question: null
        };
        client.query
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [classification] })
            .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Movies', media_type: 'movie', is_active: true }] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});
        classificationOutcomeService.recordOutcome.mockResolvedValueOnce({});
        normalizeMetadataList.mockReturnValue([]);
        const result = await svc.resolvePolicyQuestion(1, 5, 'opt', 'admin', false);
        expect(result.generatedPattern).toBeNull();
        expect(classificationEvidenceService.rememberExactMatch).not.toHaveBeenCalled();
    });
});
