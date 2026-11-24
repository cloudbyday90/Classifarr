import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { ComponentType, EmbedBuilder } from 'discord.js';
import { formatDeliveryMarker } from '../services/discordDeliveryMarker.mjs';

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

const messageId = '111111111111111111';
const fingerprint = 'abcd_efghijklmnopqrstu';

function interaction(id = 91) {
  const customId = `ai_answer_${id}_c_7_${fingerprint}`;
  return {
    customId,
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    message: {
      id: messageId,
      components: [{ components: [{ type: ComponentType.Button, customId }] }],
      embeds: [new EmbedBuilder().setTitle('Pending classification').setFooter({ text: formatDeliveryMarker('91', 'cf_abcdefghijklmnopqrstuv') })],
    },
    user: { id: 'discord-user-1', username: 'operator' },
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

  test.each([91, '9007199254740993'])('rejects the wrong notification message for History ID %s', async id => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id, discord_message_id: '222222222222222222' }],
    });
    const currentInteraction = interaction(id);

    await processPolicyQuestionAnswer(currentInteraction);

    expect(currentInteraction.deferUpdate).toHaveBeenCalledTimes(1);
    expect(currentInteraction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('does not belong'),
      ephemeral: true,
    }));
    expect(mockClarificationService.resolveRuntimeQuestionAnswer).not.toHaveBeenCalled();
  });

  test.each(['missing', 'different'])('refuses a %s offered button before lookup', async shape => {
    const current = interaction();
    current.message.components = shape === 'missing' ? [] : [{ components: [{ type: ComponentType.Button, customId: 'different' }] }];
    await processPolicyQuestionAnswer(current);
    expect(current.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('unavailable') }));
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  test('refuses a disabled button before lookup', async () => {
    const current = interaction();
    current.message.components[0].components[0].disabled = true;
    await processPolicyQuestionAnswer(current);
    expect(current.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('unavailable') }));
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  test('submits only the contract-bound action to the shared policy resolver', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 91, discord_message_id: messageId }],
    });
    mockClarificationService.resolveRuntimeQuestionAnswer.mockResolvedValueOnce({
      success: true,
      libraryId: 7,
      libraryName: 'Family Movies',
      shouldRoute: false,
    });
    const currentInteraction = interaction();

    await processPolicyQuestionAnswer(currentInteraction);

    expect(mockClarificationService.resolveRuntimeQuestionAnswer).toHaveBeenCalledWith(
      91,
      {
        contract_version: 'policy.runtime_question_answer.v1',
        contract_fingerprint: fingerprint,
        action_id: 'confirm_destination',
        destination_library_id: 7,
      },
      'operator',
      { authenticated: true, discordMessageId: messageId },
    );
    expect(mockRouting.routeAfterClarification).not.toHaveBeenCalled();
    expect(currentInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      components: [],
    }));
    expect(currentInteraction.editReply.mock.calls[0][0].embeds[0].data.footer.text)
      .toContain(`\n${formatDeliveryMarker('91', 'cf_abcdefghijklmnopqrstuv')}`);
  });

  test('does not repeat routing for an idempotent answer replay', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 91, discord_message_id: messageId }],
    });
    mockClarificationService.resolveRuntimeQuestionAnswer.mockResolvedValueOnce({
      success: true,
      alreadyResolved: true,
      shouldRoute: false,
    });
    const currentInteraction = interaction();

    await processPolicyQuestionAnswer(currentInteraction);

    expect(mockRouting.routeAfterClarification).not.toHaveBeenCalled();
    expect(currentInteraction.followUp).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Already processed'),
      ephemeral: true,
    }));
  });
});
