/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * Discord interaction handler tests
 *
 * These tests verify the key safety contracts added to prevent the interaction-
 * timeout crash (see fix commits 4863ec5 and 5aa1744):
 *
 *   1. deferUpdate() is called before any slow async work (DB / arr API)
 *   2. editReply() is used for the success embed  (NOT update() or reply())
 *   3. followUp() is used for early-exit messages (NOT reply())
 *   4. The catch block never re-throws — so a double-click / expired token
 *      cannot produce an unhandled rejection that crashes the process.
 */

import { jest } from '@jest/globals';
import { EmbedBuilder } from 'discord.js';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
const mockClarificationService = {
    resolvePolicyQuestion: jest.fn(),
    recordResponse: jest.fn()
};
const mockAutoLearningService = { learnFromFeedback: jest.fn() };
const mockClassificationOutcomeService = { recordOutcome: jest.fn().mockResolvedValue({ updated: true }) };
const mockClassificationRoutingService = { routeToArr: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/clarificationService.mjs', () => createNamedMockModule('clarificationService', mockClarificationService));

jest.unstable_mockModule('../services/autoLearningService.mjs', () => createNamedMockModule('autoLearningService', mockAutoLearningService));

jest.unstable_mockModule('../services/classificationOutcomeService.mjs', () => ({
    ...mockClassificationOutcomeService,
    classificationOutcomeService: mockClassificationOutcomeService
}));

jest.unstable_mockModule('../services/classificationRoutingService.mjs', () => ({ ...mockClassificationRoutingService }));
const {
    handleInteraction,
    processVerification,
    processCorrection,
    processClarificationResponse,
    showLibrarySelection,
    processQuestionResponse,
} = await import('../services/discordInteractionHandler.mjs');
const db = mockDb;
const clarificationService = mockClarificationService;
const autoLearningService = mockAutoLearningService;
const classificationOutcomeService = mockClassificationOutcomeService;
const classificationRoutingService = mockClassificationRoutingService;

const MOCK_CLASSIFICATION = {
    id: 100,
    library_id: 10,
    status: 'pending',
    item_metadata: null,
    tmdb_id: 'tt1234567',
    media_type: 'movie',
    metadata: null,
    confidence: 85,
    policy_question: null,
};

function makeInteraction(overrides = {}) {
    return {
        deferUpdate: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined),
        reply: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        user: { username: 'testUser', id: 'user-001' },
        message: {
            embeds: [new EmbedBuilder()],
            components: [{ components: [{ label: 'Option A' }, { label: 'Option B' }] }],
        },
        replied: false,
        deferred: false,
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    autoLearningService.learnFromFeedback.mockReset();
    clarificationService.resolvePolicyQuestion.mockReset();
    clarificationService.recordResponse.mockReset();
    classificationRoutingService.routeToArr.mockReset();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    autoLearningService.learnFromFeedback.mockResolvedValue({ learned: false, preferences: [] });
    clarificationService.resolvePolicyQuestion.mockResolvedValue({ shouldRoute: false });
    clarificationService.recordResponse.mockResolvedValue(undefined);
    classificationRoutingService.routeToArr.mockResolvedValue({ routed: true, reason: 'routed' });
});

describe('handleInteraction', () => {
    test('routes the "correct" button through processVerification — DB is queried for classification', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ ...MOCK_CLASSIFICATION, status: 'pending' }] })
            .mockResolvedValue({ rows: [], rowCount: 1 });

        const interaction = makeInteraction({
            customId: 'correct_100',
            isButton: jest.fn(() => true),
            isStringSelectMenu: jest.fn(() => false),
        });

        await handleInteraction(interaction);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('classification_history'),
            expect.arrayContaining([100]),
        );
        expect(interaction.update).not.toHaveBeenCalled();
    });
});

// ── processVerification ───────────────────────────────────────────────────────

describe('processVerification', () => {
    test('calls deferUpdate before performing DB work', async () => {
        const callOrder = [];

        db.query.mockImplementationOnce(async () => {
            callOrder.push('db.query');
            return { rows: [MOCK_CLASSIFICATION] };
        });
        db.query
            .mockResolvedValueOnce({ rows: [{ name: 'Series' }] })
            .mockResolvedValue({ rows: [], rowCount: 0 });

        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockImplementation(async () => {
                callOrder.push('deferUpdate');
            }),
        });

        await processVerification(100, true, interaction);

        expect(callOrder.indexOf('deferUpdate')).toBeLessThan(callOrder.indexOf('db.query'));
    });

    test('uses editReply for the success embed — NOT update() or reply()', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [MOCK_CLASSIFICATION] })
            .mockResolvedValue({ rows: [], rowCount: 0 });

        const interaction = makeInteraction();
        await processVerification(100, true, interaction);

        expect(interaction.editReply).toHaveBeenCalledTimes(1);
        expect(interaction.update).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
        expect(classificationOutcomeService.recordOutcome).toHaveBeenCalledWith(100, expect.objectContaining({
            type: 'verified',
            source: 'discord_verification',
        }));
    });

    test('idempotency guard: followUp + early exit when status is already "verified"', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ ...MOCK_CLASSIFICATION, status: 'verified' }] });

        const interaction = makeInteraction();
        await processVerification(100, true, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Already processed') })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    test('idempotency guard: followUp + early exit when status is already "routed"', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ ...MOCK_CLASSIFICATION, status: 'routed' }] });

        const interaction = makeInteraction();
        await processVerification(100, true, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Already processed') })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    test('followUp (not reply) when classification is not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const interaction = makeInteraction();
        await processVerification(100, true, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('not found'), ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('catch block uses followUp, not reply, so the process cannot crash', async () => {
        // deferUpdate succeeds; the first DB call throws (simulating a DB outage)
        db.query.mockRejectedValueOnce(new Error('DB connection lost'));

        const interaction = makeInteraction();
        await processVerification(100, true, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ ephemeral: true })
        );
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('double-click / token-timeout safety: no crash when deferUpdate + followUp both throw', async () => {
        // This reproduces the original crash scenario:
        //   deferUpdate throws DiscordAPIError (token expired)
        //   then followUp also throws (interaction already handled)
        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockRejectedValue(new Error('Interaction token expired')),
            followUp: jest.fn().mockRejectedValue(new Error('Unknown interaction')),
        });

        // The key assertion: the function must resolve without rejecting.
        await expect(
            processVerification(100, true, interaction)
        ).resolves.toBeUndefined();

        // And it must NEVER use reply() — that was the original cause of the process crash.
        expect(interaction.reply).not.toHaveBeenCalled();
    });
});

// ── processCorrection ─────────────────────────────────────────────────────────

describe('processCorrection', () => {
    test('calls deferUpdate before performing DB work', async () => {
        const callOrder = [];

        db.query.mockImplementationOnce(async () => {
            callOrder.push('db.query');
            return { rows: [MOCK_CLASSIFICATION] };
        });
        db.query.mockResolvedValue({ rows: [], rowCount: 0 });

        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockImplementation(async () => {
                callOrder.push('deferUpdate');
            }),
        });

        await processCorrection(100, 10, interaction);

        expect(callOrder.indexOf('deferUpdate')).toBeLessThan(callOrder.indexOf('db.query'));
    });

    test('uses editReply for the success embed — NOT update() or reply()', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [MOCK_CLASSIFICATION] })           // classification
            .mockResolvedValueOnce({ rows: [{ name: 'Series' }] })            // library lookup
            .mockResolvedValue({ rows: [], rowCount: 1 });

        const interaction = makeInteraction();
        await processCorrection(100, 11, interaction);

        expect(interaction.editReply).toHaveBeenCalledTimes(1);
        expect(interaction.update).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
        expect(classificationOutcomeService.recordOutcome).toHaveBeenCalledWith(100, expect.objectContaining({
            type: 'corrected',
            source: 'discord_correction',
            final_library_id: 11,
            final_library_name: 'Series'
        }));
    });

    test('followUp (not reply) when classification is not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const interaction = makeInteraction();
        await processCorrection(100, 10, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Classification not found', ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('followUp (not reply) when library is not found', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [MOCK_CLASSIFICATION] })  // classification found
            .mockResolvedValueOnce({ rows: [] });                     // library not found

        const interaction = makeInteraction();
        await processCorrection(100, 99, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Library not found', ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('idempotency guard: followUp + early exit when correction targets the existing library', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ ...MOCK_CLASSIFICATION, status: 'corrected', library_id: 10 }] })
            .mockResolvedValueOnce({ rows: [{ name: 'Movies' }] });

        const interaction = makeInteraction();
        await processCorrection(100, 10, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Already processed') })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(db.query).toHaveBeenCalledTimes(2);
    });

    test('catch block uses followUp, not reply', async () => {
        db.query.mockRejectedValueOnce(new Error('DB timeout'));

        const interaction = makeInteraction();
        await processCorrection(100, 10, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ ephemeral: true })
        );
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('no crash when deferUpdate + followUp both throw', async () => {
        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockRejectedValue(new Error('Interaction token expired')),
            followUp: jest.fn().mockRejectedValue(new Error('Unknown interaction')),
        });

        await expect(
            processCorrection(100, 10, interaction)
        ).resolves.toBeUndefined();

        expect(interaction.reply).not.toHaveBeenCalled();
    });
});

// ── processClarificationResponse ──────────────────────────────────────────────

describe('processClarificationResponse', () => {
    test('calls deferUpdate before performing DB work', async () => {
        const callOrder = [];

        db.query.mockImplementationOnce(async () => {
            callOrder.push('db.query');
            return { rows: [MOCK_CLASSIFICATION] };
        });
        db.query.mockResolvedValue({ rows: [], rowCount: 0 });

        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockImplementation(async () => {
                callOrder.push('deferUpdate');
            }),
        });

        await processClarificationResponse(100, 0, interaction);

        expect(callOrder.indexOf('deferUpdate')).toBeLessThan(callOrder.indexOf('db.query'));
    });

    test('uses editReply for the success embed — NOT update() or reply()', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [MOCK_CLASSIFICATION] })
            .mockResolvedValue({ rows: [], rowCount: 0 });

        const interaction = makeInteraction();
        await processClarificationResponse(100, 0, interaction);

        expect(interaction.editReply).toHaveBeenCalledTimes(1);
        expect(interaction.update).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('routes through classificationRoutingService when resolvePolicyQuestion requests routing', async () => {
        db.query
            .mockResolvedValueOnce({
                rows: [{
                    ...MOCK_CLASSIFICATION,
                    status: 'awaiting_decision',
                    policy_question: {
                        options: [{ label: 'Movies', library_id: 10 }]
                    }
                }]
            })
            .mockResolvedValueOnce({
                rows: [{
                    ...MOCK_CLASSIFICATION,
                    status: 'completed',
                    library_id: 10,
                    arr_type: 'radarr',
                    arr_id: 22,
                    library_name: 'Movies',
                    radarr_settings: { root_folder_path: '/movies', quality_profile_id: 4 },
                    sonarr_settings: null,
                    root_folder: '/movies',
                    quality_profile_id: 4,
                    metadata: { title: 'Test Movie', media_type: 'movie', tmdb_id: 'tt1234567' }
                }]
            })
            .mockResolvedValueOnce({ rows: [], rowCount: 1 });
        clarificationService.resolvePolicyQuestion.mockResolvedValueOnce({ shouldRoute: true, alreadyResolved: false });

        const interaction = makeInteraction();
        await processClarificationResponse(100, 0, interaction);

        expect(clarificationService.resolvePolicyQuestion).toHaveBeenCalledWith(
            100,
            10,
            'Movies',
            'testUser',
            false,
        );
        expect(classificationRoutingService.routeToArr).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Test Movie', media_type: 'movie' }),
            expect.objectContaining({
                id: 10,
                arr_type: 'radarr',
                arr_id: 22,
                name: 'Movies'
            })
        );
    });

    test('followUp (not reply) when classification is not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const interaction = makeInteraction();
        await processClarificationResponse(100, 0, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Classification not found', ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('idempotency guard: followUp + early exit when clarification is already resolved to the same library', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                ...MOCK_CLASSIFICATION,
                status: 'completed',
                library_id: 10,
                policy_question: {
                    options: [{ label: 'Movies', library_id: 10 }]
                }
            }]
        });

        const interaction = makeInteraction();
        await processClarificationResponse(100, 0, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Already processed') })
        );
        expect(clarificationService.resolvePolicyQuestion).not.toHaveBeenCalled();
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    test('does not fall back to legacy mutation when resolvePolicyQuestion reports stale resolution', async () => {
        const staleError = new Error('Classification is no longer awaiting decision');
        staleError.statusCode = 409;
        db.query.mockResolvedValueOnce({
            rows: [{
                ...MOCK_CLASSIFICATION,
                status: 'awaiting_decision',
                library_id: 10,
                policy_question: {
                    options: [{ label: 'Movies', library_id: 10 }]
                }
            }]
        });
        clarificationService.resolvePolicyQuestion.mockRejectedValueOnce(staleError);

        const interaction = makeInteraction();
        await processClarificationResponse(100, 0, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Already processed') })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('shows a stale-question retry message instead of already-processed when policy context changed', async () => {
        const staleQuestionError = new Error('Policy question is stale and must be retried');
        staleQuestionError.statusCode = 409;
        staleQuestionError.code = 'policy_question_stale';
        db.query.mockResolvedValueOnce({
            rows: [{
                ...MOCK_CLASSIFICATION,
                status: 'awaiting_decision',
                library_id: 10,
                policy_question: {
                    options: [{ label: 'Movies', library_id: 10 }]
                }
            }]
        });
        clarificationService.resolvePolicyQuestion.mockRejectedValueOnce(staleQuestionError);

        const interaction = makeInteraction();
        await processClarificationResponse(100, 0, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('stale') })
        );
        expect(interaction.followUp).not.toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Already processed') })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('does not fall back to a direct mutation when authoritative resolution fails unexpectedly', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                ...MOCK_CLASSIFICATION,
                status: 'awaiting_decision',
                library_id: 10,
                policy_question: {
                    options: [{ label: 'Movies', library_id: 10 }]
                }
            }]
        });
        clarificationService.resolvePolicyQuestion.mockRejectedValueOnce(new Error('Database unavailable'));

        const interaction = makeInteraction();
        await processClarificationResponse(100, 0, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('No changes were made'),
                ephemeral: true,
            })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('catch block uses followUp, not reply', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));

        const interaction = makeInteraction();
        await processClarificationResponse(100, 0, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ ephemeral: true })
        );
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('no crash when deferUpdate + followUp both throw', async () => {
        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockRejectedValue(new Error('Interaction token expired')),
            followUp: jest.fn().mockRejectedValue(new Error('Unknown interaction')),
        });

        await expect(
            processClarificationResponse(100, 0, interaction)
        ).resolves.toBeUndefined();

        expect(interaction.reply).not.toHaveBeenCalled();
    });
});

// ── showLibrarySelection ──────────────────────────────────────────────────────

describe('showLibrarySelection', () => {
    test('calls deferUpdate before performing DB work', async () => {
        const callOrder = [];

        db.query.mockImplementationOnce(async () => {
            callOrder.push('db.query');
            return { rows: [{ media_type: 'movie' }] };
        });
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Movies', media_type: 'movie' }] });

        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockImplementation(async () => {
                callOrder.push('deferUpdate');
            }),
        });

        await showLibrarySelection(100, interaction);

        expect(callOrder.indexOf('deferUpdate')).toBeLessThan(callOrder.indexOf('db.query'));
    });

    test('uses editReply for the library dropdown — NOT update() or reply()', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ media_type: 'movie' }] })
            .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Movies', media_type: 'movie' }] });

        const interaction = makeInteraction();
        await showLibrarySelection(100, interaction);

        expect(interaction.editReply).toHaveBeenCalledTimes(1);
        expect(interaction.update).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('followUp (not reply) when classification is not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const interaction = makeInteraction();
        await showLibrarySelection(100, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Classification not found', ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('followUp (not reply) when no libraries are available for the media type', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ media_type: 'movie' }] })
            .mockResolvedValueOnce({ rows: [] }); // no libraries

        const interaction = makeInteraction();
        await showLibrarySelection(100, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'No libraries available', ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('catch block uses followUp, not reply', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));

        const interaction = makeInteraction();
        await showLibrarySelection(100, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ ephemeral: true })
        );
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('no crash when deferUpdate + followUp both throw', async () => {
        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockRejectedValue(new Error('Interaction token expired')),
            followUp: jest.fn().mockRejectedValue(new Error('Unknown interaction')),
        });

        await expect(
            showLibrarySelection(100, interaction)
        ).resolves.toBeUndefined();

        expect(interaction.reply).not.toHaveBeenCalled();
    });
});

// ── processQuestionResponse ───────────────────────────────────────────────────

describe('processQuestionResponse', () => {
    test('calls deferUpdate before performing DB work', async () => {
        const callOrder = [];

        db.query.mockImplementationOnce(async () => {
            callOrder.push('db.query');
            return { rows: [MOCK_CLASSIFICATION] };
        });

        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockImplementation(async () => {
                callOrder.push('deferUpdate');
            }),
        });

        await processQuestionResponse(100, 5, 'yes', interaction);

        expect(callOrder.indexOf('deferUpdate')).toBeLessThan(callOrder.indexOf('db.query'));
    });

    test('uses editReply for the success message — NOT update() or reply()', async () => {
        db.query.mockResolvedValueOnce({ rows: [MOCK_CLASSIFICATION] });

        const interaction = makeInteraction();
        await processQuestionResponse(100, 5, 'yes', interaction);

        expect(interaction.editReply).toHaveBeenCalledTimes(1);
        expect(interaction.update).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('followUp (not reply) when classification is not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const interaction = makeInteraction();
        await processQuestionResponse(100, 5, 'yes', interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Classification not found', ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('catch block uses followUp, not reply', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));

        const interaction = makeInteraction();
        await processQuestionResponse(100, 5, 'yes', interaction);

        expect(interaction.followUp).toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('no crash when deferUpdate + followUp both throw', async () => {
        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockRejectedValue(new Error('Interaction token expired')),
            followUp: jest.fn().mockRejectedValue(new Error('Unknown interaction')),
        });

        await expect(
            processQuestionResponse(100, 5, 'yes', interaction)
        ).resolves.toBeUndefined();

        expect(interaction.reply).not.toHaveBeenCalled();
    });
});
