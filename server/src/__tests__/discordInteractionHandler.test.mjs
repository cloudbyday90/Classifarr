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
import { ComponentType, EmbedBuilder } from 'discord.js';
import { formatDeliveryMarker } from '../services/discordDeliveryMarker.mjs';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn(), withTransaction: async callback => callback(mockDb) };
const mockClarificationService = {
    resolvePolicyQuestion: jest.fn(),
    resolveRuntimeQuestionAnswer: jest.fn(),
    recordResponse: jest.fn()
};
const mockClassificationOutcomeService = { recordOutcome: jest.fn().mockResolvedValue({ updated: true }) };
const mockClassificationRoutingService = { routeToArr: jest.fn() };
const mockNativePendingRouteOutcomePersistence = {
    recordNativePendingRouteOutcome: jest.fn(),
};
const mockDiscordPendingAnswerIntakeService = { build: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/clarificationService.mjs', () => createNamedMockModule('clarificationService', mockClarificationService));

jest.unstable_mockModule('../services/classificationOutcomeService.mjs', () => ({
    ...mockClassificationOutcomeService,
    classificationOutcomeService: mockClassificationOutcomeService
}));

jest.unstable_mockModule('../services/classificationRoutingService.mjs', () => ({ ...mockClassificationRoutingService }));

jest.unstable_mockModule('../services/policyNativePendingRouteOutcomePersistence.mjs', () => ({
    ...mockNativePendingRouteOutcomePersistence,
}));

jest.unstable_mockModule('../services/policyDiscordPendingAnswerIntake.mjs', () => ({
    DISCORD_PENDING_ANSWER_ACTION_IDS: {
        VERIFY_DESTINATION: 'verify_destination',
        CORRECT_DESTINATION: 'correct_destination',
    },
    policyDiscordPendingAnswerIntakeService: mockDiscordPendingAnswerIntakeService,
}));
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
const classificationOutcomeService = mockClassificationOutcomeService;
const classificationRoutingService = mockClassificationRoutingService;
const nativePendingRouteOutcomePersistence = mockNativePendingRouteOutcomePersistence;
const discordPendingAnswerIntakeService = mockDiscordPendingAnswerIntakeService;

const savedMessageId = '111111111111111111';
const confidenceBinding = { discordMessageId: savedMessageId, notificationKind: 'confidence' };
const classificationBinding = { discordMessageId: savedMessageId, notificationKind: 'classification' };
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
    discord_message_id: savedMessageId,
};
const completedClassification = { ...MOCK_CLASSIFICATION, status: 'completed' };
const deliveryMatch = { rows: [{ '?column?': 1 }], rowCount: 1 };

const deliveryMarker = formatDeliveryMarker('100', 'cf_abcdefghijklmnopqrstuv');
let interactions = [];
function makeInteraction(overrides = {}) {
    const interaction = {
        deferUpdate: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined),
        reply: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        user: { username: 'testUser', id: 'user-001' },
        message: {
            id: savedMessageId,
            embeds: [new EmbedBuilder().setFooter({ text: deliveryMarker })],
            components: [{ components: [
                { customId: 'ai_clarify_100_0', label: 'Option A' },
                { customId: 'ai_clarify_100_1', label: 'Option B' },
            ] }],
        },
        replied: false,
        deferred: false,
        ...overrides,
    };
    interactions.push(interaction);
    return interaction;
}

afterEach(() => {
    for (const interaction of interactions) {
        if (interaction.message?.embeds?.[0]?.data?.footer?.text !== deliveryMarker) continue;
        for (const [payload] of [...interaction.editReply.mock.calls, ...interaction.update.mock.calls]) {
            if (payload.embeds) expect(payload.embeds[0].data.footer.text).toContain(`\n${deliveryMarker}`);
        }
    }
});

beforeEach(() => {
    interactions = [];
    jest.clearAllMocks();
    db.query.mockReset();
    clarificationService.resolvePolicyQuestion.mockReset();
    clarificationService.resolveRuntimeQuestionAnswer.mockReset();
    clarificationService.recordResponse.mockReset();
    classificationRoutingService.routeToArr.mockReset();
    nativePendingRouteOutcomePersistence.recordNativePendingRouteOutcome.mockReset();
    discordPendingAnswerIntakeService.build.mockReset();
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    discordPendingAnswerIntakeService.build.mockReturnValue({
        statusId: 'outcome_only',
        sourceStateId: 'legacy_pending_state',
        learningIntake: { sourceEventId: 'classification:100:discord_pending_answer:legacy' },
        learningGuard: { learning: { decisionId: 'outcome_only' } },
        audit: { ok: true },
        reasonCodes: [],
    });
    clarificationService.resolvePolicyQuestion.mockResolvedValue({ shouldRoute: false });
    clarificationService.recordResponse.mockResolvedValue(undefined);
    classificationRoutingService.routeToArr.mockResolvedValue({ routed: true, reason: 'routed' });
    nativePendingRouteOutcomePersistence.recordNativePendingRouteOutcome.mockResolvedValue({
        persisted: false,
        reason: 'not_applicable',
        routeOutcome: { eventTypeId: null },
    });
});

describe('handleInteraction', () => {
    const fingerprint = 'abcd_efghijklmnopqrstu';
    test.each([
        `ai_answer_01_c_10_${fingerprint}`, `ai_answer_9223372036854775808_c_10_${fingerprint}`,
        `ai_answer_100_c_10x_${fingerprint}`, `ai_answer_100_c_2147483648_${fingerprint}`,
        `ai_answer_100_x_10_${fingerprint}`, `ai_answer_100_c_10_${fingerprint}_extra`,
        `ai_answer_100_c_10_${fingerprint}\n`, 'ai_answer_100_c_10_short',
        'ai_clarify_100x_0', 'ai_clarify_9007199254740993_0', 'ai_clarify_100_5',
        'ai_clarify_100_0x', 'ai_clarify_100_0_extra',
    ])(
        'rejects invalid or unsupported button %s before lookup', async customId => {
            const interaction = makeInteraction({ customId, isButton: () => true });
            await handleInteraction(interaction);
            expect(interaction.reply).toHaveBeenCalledWith({ content: 'Invalid policy question action.', ephemeral: true });
            expect(interaction.deferUpdate).not.toHaveBeenCalled();
            expect(db.query).not.toHaveBeenCalled();
        },
    );
    test.each([[], ['100_10', '100_11'], ['100_10_x'], ['100x_10'], ['100_1e1'],
        ['100_2147483648'], ['9007199254740993_10']].map(values => ({ values })))('refuses selector values $values before lookup', async ({ values }) => {
        const interaction = makeInteraction({ isButton: () => false, isStringSelectMenu: () => true,
            customId: 'library_select', values });
        await handleInteraction(interaction);
        expect(interaction.reply).toHaveBeenCalledWith({ content: 'Invalid library selection', ephemeral: true });
        expect(db.query).not.toHaveBeenCalled();
    });
    test('ignores an unrelated string select menu', async () => {
        const interaction = makeInteraction({ isButton: () => false, isStringSelectMenu: () => true,
            customId: 'unrelated', values: ['100_10'] });
        await handleInteraction(interaction);
        expect(interaction.deferUpdate).not.toHaveBeenCalled();
        expect(db.query).not.toHaveBeenCalled();
    });
    test('refuses a matching selector value without the recorded message', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ ...MOCK_CLASSIFICATION, discord_message_id: null }] });
        const interaction = makeInteraction({ isButton: () => false, isStringSelectMenu: () => true,
            customId: 'library_select', values: ['100_11'], message: { id: savedMessageId,
                components: [{ components: [{ type: ComponentType.StringSelect, customId: 'library_select',
                    placeholder: 'Or choose a different library...', options: [{ value: '100_11' }] }] }] } });
        await handleInteraction(interaction);
        expect(db.query).toHaveBeenCalledTimes(1);
        expect(classificationOutcomeService.recordOutcome).not.toHaveBeenCalled();
        expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Open Classifarr') }));
    });
    test.each([100, '9007199254740993', '9223372036854775807'])(
        'passes exact History ID %s and the entire fingerprint to the resolver', async id => {
            db.query.mockResolvedValueOnce({ rows: [{ id, discord_message_id: savedMessageId }] });
            clarificationService.resolveRuntimeQuestionAnswer.mockResolvedValueOnce({ alreadyResolved: true });
            const customId = `ai_answer_${id}_c_2147483647_${fingerprint}`;
            const interaction = makeInteraction({ customId, isButton: () => true, message: { id: savedMessageId,
                components: [{ components: [{ type: ComponentType.Button, customId }] }] } });
            await handleInteraction(interaction);
            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('classification_history'), [id]);
            expect(clarificationService.resolveRuntimeQuestionAnswer).toHaveBeenCalledWith(id, {
                contract_version: 'policy.runtime_question_answer.v1', contract_fingerprint: fingerprint,
                action_id: 'confirm_destination', destination_library_id: 2147483647,
            }, 'testUser', { authenticated: true, allowBigintHistoryId: true, discordMessageId: savedMessageId });
            expect(interaction.customId.length).toBeLessThanOrEqual(100);
        },
    );
    test('acknowledgement preserves the existing receipt footer', async () => {
        const interaction = makeInteraction({ customId: 'acknowledge_100', isButton: () => true });
        await handleInteraction(interaction);
        expect(interaction.update).toHaveBeenCalledTimes(1);
        expect(interaction.update.mock.calls[0][0].embeds[0].data.footer.text).toContain(deliveryMarker);
    });
    test('routes an offered "correct" button through the History lock', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ ...MOCK_CLASSIFICATION, status: 'pending' }] })
            .mockResolvedValue({ rows: [], rowCount: 1 });

        const interaction = makeInteraction({
            customId: 'correct_100',
            message: { id: savedMessageId, components: [{ components: [{ type: ComponentType.Button, customId: 'correct_100' }] }] },
            isButton: jest.fn(() => true),
            isStringSelectMenu: jest.fn(() => false),
        });

        await handleInteraction(interaction);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('classification_history'),
            expect.arrayContaining([100]),
        );
        expect(interaction.update).not.toHaveBeenCalled();
        expect(classificationOutcomeService.recordOutcome).not.toHaveBeenCalled();
    });

    test.each(['correct_100x', 'verify_yes_01', 'verify_no_9007199254740992', 'reclassify_100_2147483648',
        'reclassify_100', 'reclassify_100_10_extra', 'correct_100\n', 'verify_no_100_10'])(
        'refuses malformed completed button %s before database work', async customId => {
            const interaction = makeInteraction({ customId, isButton: () => true,
                message: { id: savedMessageId, components: [{ components: [{ type: ComponentType.Button, customId }] }] } });
            await handleInteraction(interaction);
            expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Open Classifarr') }));
            expect(db.query).not.toHaveBeenCalled();
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

        await processVerification(100, interaction, confidenceBinding);

        expect(callOrder.indexOf('deferUpdate')).toBeLessThan(callOrder.indexOf('db.query'));
    });

    test('uses editReply for the success embed — NOT update() or reply()', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [completedClassification] })
            .mockResolvedValueOnce(deliveryMatch)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 });

        const interaction = makeInteraction();
        await processVerification(100, interaction, confidenceBinding);

        expect(interaction.editReply).toHaveBeenCalledTimes(1);
        expect(interaction.update).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
        expect(classificationOutcomeService.recordOutcome).toHaveBeenCalledWith(100, expect.objectContaining({
            type: 'verified',
            source: 'discord_verification',
        }), { client: mockDb, requireWrite: true });
        expect(discordPendingAnswerIntakeService.build).toHaveBeenCalledWith(expect.objectContaining({
            classification: completedClassification,
            actionId: 'verify_destination',
            finalOutcomeRecorded: true,
        }));
    });

    test('idempotency guard: followUp + early exit when status is already "verified"', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ ...MOCK_CLASSIFICATION, status: 'verified' }] }).mockResolvedValueOnce(deliveryMatch);

        const interaction = makeInteraction();
        await processVerification(100, interaction, confidenceBinding);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Already processed') })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    test('idempotency guard: followUp + early exit when status is already "routed"', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ ...MOCK_CLASSIFICATION, status: 'routed' }] }).mockResolvedValueOnce(deliveryMatch);

        const interaction = makeInteraction();
        await processVerification(100, interaction, confidenceBinding);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Already processed') })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    test('followUp (not reply) when classification is not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const interaction = makeInteraction();
        await processVerification(100, interaction, confidenceBinding);

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
        await processVerification(100, interaction, confidenceBinding);

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
            processVerification(100, interaction, confidenceBinding)
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

        await processCorrection(100, 10, interaction, classificationBinding);

        expect(callOrder.indexOf('deferUpdate')).toBeLessThan(callOrder.indexOf('db.query'));
    });

    test('uses editReply for the success embed — NOT update() or reply()', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [completedClassification] })
            .mockResolvedValueOnce(deliveryMatch)
            .mockResolvedValueOnce({ rows: [{ name: 'Series', media_type: MOCK_CLASSIFICATION.media_type, is_active: true }] })
            .mockResolvedValue({ rows: [], rowCount: 1 });

        const interaction = makeInteraction();
        await processCorrection(100, 11, interaction, classificationBinding);

        expect(interaction.editReply).toHaveBeenCalledTimes(1);
        expect(interaction.update).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
        expect(classificationOutcomeService.recordOutcome).toHaveBeenCalledWith(100, expect.objectContaining({
            type: 'corrected',
            source: 'discord_correction',
            final_library_id: 11,
            final_library_name: 'Series'
        }), { client: mockDb });
        expect(discordPendingAnswerIntakeService.build).toHaveBeenCalledWith(expect.objectContaining({
            classification: completedClassification,
            destination: {
                libraryId: 11,
                libraryName: 'Series',
            },
            actionId: 'correct_destination',
            finalOutcomeRecorded: true,
        }));
    });

    test('followUp (not reply) when classification is not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const interaction = makeInteraction();
        await processCorrection(100, 10, interaction, classificationBinding);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Classification not found', ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('followUp (not reply) when library is not found', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [completedClassification] })
            .mockResolvedValueOnce(deliveryMatch)
            .mockResolvedValueOnce({ rows: [] });                     // library not found

        const interaction = makeInteraction();
        await processCorrection(100, 99, interaction, classificationBinding);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Library not found', ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('idempotency guard: followUp + early exit when correction targets the existing library', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ ...MOCK_CLASSIFICATION, status: 'corrected', library_id: 10 }] })
            .mockResolvedValueOnce(deliveryMatch)
            .mockResolvedValueOnce({ rows: [{ name: 'Movies', media_type: 'movie', is_active: true }] });

        const interaction = makeInteraction();
        await processCorrection(100, 10, interaction, classificationBinding);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('Already processed') })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(db.query).toHaveBeenCalledTimes(3);
    });

    test('catch block uses followUp, not reply', async () => {
        db.query.mockRejectedValueOnce(new Error('DB timeout'));

        const interaction = makeInteraction();
        await processCorrection(100, 10, interaction, classificationBinding);

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
            processCorrection(100, 10, interaction, classificationBinding)
        ).resolves.toBeUndefined();

        expect(interaction.reply).not.toHaveBeenCalled();
    });
});

// ── processClarificationResponse ──────────────────────────────────────────────

describe('processClarificationResponse', () => {
    test.each([null, '222222222222222222'])('refuses a legacy action when the stored message is %p', async discord_message_id => {
        db.query.mockResolvedValueOnce({ rows: [{ ...MOCK_CLASSIFICATION, discord_message_id }] });
        const interaction = makeInteraction();
        await processClarificationResponse(100, 0, interaction);
        expect(clarificationService.resolvePolicyQuestion).not.toHaveBeenCalled();
        expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Open Classifarr') }));
    });

    test('refuses an index with no option on the saved notification', async () => {
        db.query.mockResolvedValueOnce({ rows: [MOCK_CLASSIFICATION] });
        const interaction = makeInteraction();
        await processClarificationResponse(100, 4, interaction);
        expect(clarificationService.resolvePolicyQuestion).not.toHaveBeenCalled();
        expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: 'Invalid library selection' }));
    });

    test('refuses when the option at the presented index has a different button ID', async () => {
        db.query.mockResolvedValueOnce({ rows: [MOCK_CLASSIFICATION] });
        const interaction = makeInteraction();
        interaction.message.components[0].components[0].customId = 'ai_clarify_100_1';
        await processClarificationResponse(100, 0, interaction);
        expect(clarificationService.resolvePolicyQuestion).not.toHaveBeenCalled();
        expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: 'Invalid library selection' }));
    });

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
            'Option A',
            'testUser',
            false,
            { discordMessageId: savedMessageId },
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

    test('rejects an old Discord button for a native policy-runtime question', async () => {
        db.query
            .mockResolvedValueOnce({
                rows: [{
                    ...MOCK_CLASSIFICATION,
                    status: 'awaiting_decision',
                    library_id: null,
                    policy_question: {
                        version: 'policy.runtime_question_persistence.v1',
                        options: [
                            {
                                label: 'Resolve current item',
                                outcomeId: 'resolve_current_item',
                                library_id: 10,
                            },
                            {
                                label: 'Do not learn',
                                outcomeId: 'do_not_learn',
                            },
                        ],
                        runtimeQuestion: {
                            contractVersion: 'policy.runtime_question_reduction.v1',
                        },
                        runtimeQuestionReductionPlan: {
                            version: 'policy.runtime_question_reduction.v1',
                        },
                        meta: {
                            runtime_question_persistence: {
                                destinationLibraryId: 10,
                                destinationLibraryName: 'Movies',
                            },
                        },
                    },
                }],
            });

        const interaction = makeInteraction();
        await processClarificationResponse(100, 1, interaction);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('latest Classifarr queue state'),
                ephemeral: true,
            }),
        );
        expect(clarificationService.resolvePolicyQuestion).not.toHaveBeenCalled();
        expect(interaction.editReply).not.toHaveBeenCalled();
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
            return { rows: [completedClassification] };
        });
        db.query.mockResolvedValueOnce(deliveryMatch).mockResolvedValueOnce({ rows: [{ id: 1, name: 'Movies', media_type: 'movie' }] });

        const interaction = makeInteraction({
            deferUpdate: jest.fn().mockImplementation(async () => {
                callOrder.push('deferUpdate');
            }),
        });

        await showLibrarySelection(100, interaction, confidenceBinding);

        expect(callOrder.indexOf('deferUpdate')).toBeLessThan(callOrder.indexOf('db.query'));
    });

    test('uses editReply for the library dropdown — NOT update() or reply()', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [completedClassification] })
            .mockResolvedValueOnce(deliveryMatch)
            .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Movies', media_type: 'movie' }] });

        const interaction = makeInteraction();
        await showLibrarySelection(100, interaction, confidenceBinding);

        expect(interaction.editReply).toHaveBeenCalledTimes(1);
        expect(interaction.update).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('followUp (not reply) when classification is not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const interaction = makeInteraction();
        await showLibrarySelection(100, interaction, confidenceBinding);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'Classification not found', ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('followUp (not reply) when no libraries are available for the media type', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [completedClassification] })
            .mockResolvedValueOnce(deliveryMatch)
            .mockResolvedValueOnce({ rows: [] }); // no libraries

        const interaction = makeInteraction();
        await showLibrarySelection(100, interaction, confidenceBinding);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'No libraries available', ephemeral: true })
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    test('catch block uses followUp, not reply', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));

        const interaction = makeInteraction();
        await showLibrarySelection(100, interaction, confidenceBinding);

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
            showLibrarySelection(100, interaction, confidenceBinding)
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
