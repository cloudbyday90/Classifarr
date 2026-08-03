import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { EmbedBuilder } from 'discord.js';

import {
  createLoggerModuleMock,
  createNamedMockModule,
  createServiceStubs,
} from './helpers/mockFactory.mjs';

const { module: mockLoggerModule } = createLoggerModuleMock();
const mockDb = { query: jest.fn() };
const mockClarificationService = createServiceStubs(['resolveRuntimeQuestionAnswer']);
const mockRouting = { routeAfterClarification: jest.fn() };
const mockRouteOutcomePersistence = createServiceStubs(['recordNativePendingRouteOutcome']);

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));
jest.unstable_mockModule('../utils/logger.mjs', () => mockLoggerModule);
jest.unstable_mockModule('../services/clarificationService.mjs', () => (
  createNamedMockModule('clarificationService', mockClarificationService)
));
jest.unstable_mockModule('../services/discordClarificationRouting.mjs', () => mockRouting);
jest.unstable_mockModule('../services/policyNativePendingRouteOutcomePersistence.mjs', () => (
  mockRouteOutcomePersistence
));

const { processPolicyQuestionAnswer } = await import('../services/discordPolicyQuestionAnswerHandler.mjs');

function interaction(overrides = {}) {
  return {
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    message: {
      id: 'discord-message-1',
      embeds: [new EmbedBuilder().setTitle('Pending classification')],
    },
    user: { id: 'discord-user-1', username: 'operator' },
    ...overrides,
  };
}

function answer() {
  return {
    classificationId: 91,
    destinationLibraryId: 7,
    contractVersion: 'policy.runtime_question_answer.v1',
    contractFingerprint: 'server-owned-fingerprint',
    actionId: 'confirm_destination',
  };
}

describe('discordPolicyQuestionAnswerHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query.mockReset();
    mockClarificationService.resolveRuntimeQuestionAnswer.mockReset();
    mockRouting.routeAfterClarification.mockReset();
    mockRouteOutcomePersistence.recordNativePendingRouteOutcome.mockReset();
  });

  test('rejects a button interaction from a message other than the recorded pending notification', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 91, discord_message_id: 'expected-pending-message' }],
    });
    const currentInteraction = interaction();

    await processPolicyQuestionAnswer(answer(), currentInteraction);

    expect(currentInteraction.deferUpdate).toHaveBeenCalledTimes(1);
    expect(currentInteraction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('does not belong'),
      ephemeral: true,
    }));
    expect(mockClarificationService.resolveRuntimeQuestionAnswer).not.toHaveBeenCalled();
  });

  test('submits only the contract-bound action to the shared policy resolver', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 91, discord_message_id: 'discord-message-1' }],
    });
    mockClarificationService.resolveRuntimeQuestionAnswer.mockResolvedValueOnce({
      success: true,
      libraryId: 7,
      libraryName: 'Family Movies',
      shouldRoute: false,
    });
    const currentInteraction = interaction();

    await processPolicyQuestionAnswer(answer(), currentInteraction);

    expect(mockClarificationService.resolveRuntimeQuestionAnswer).toHaveBeenCalledWith(
      91,
      {
        contract_version: 'policy.runtime_question_answer.v1',
        contract_fingerprint: 'server-owned-fingerprint',
        action_id: 'confirm_destination',
        destination_library_id: 7,
      },
      'operator',
    );
    expect(mockRouting.routeAfterClarification).not.toHaveBeenCalled();
    expect(currentInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      components: [],
    }));
  });

  test('does not repeat routing for an idempotent answer replay', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 91, discord_message_id: 'discord-message-1' }],
    });
    mockClarificationService.resolveRuntimeQuestionAnswer.mockResolvedValueOnce({
      success: true,
      alreadyResolved: true,
      shouldRoute: false,
    });
    const currentInteraction = interaction();

    await processPolicyQuestionAnswer(answer(), currentInteraction);

    expect(mockRouting.routeAfterClarification).not.toHaveBeenCalled();
    expect(currentInteraction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Already processed'),
      ephemeral: true,
    }));
  });
});
