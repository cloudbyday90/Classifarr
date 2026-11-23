/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, beforeAll, expect, jest, test } from '@jest/globals';
import { Options } from 'discord.js';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createDiscordDeliveryRepository } from '../../services/discordDeliveryRepository.mjs';
import { createDiscordDeliveryService } from '../../services/discordDeliveryService.mjs';
import { serializeDiscordDeliveryBody } from '../../services/discordDeliveryBody.mjs';
import { readDeliveryMarker } from '../../services/discordDeliveryMarker.mjs';
import { normalizePolicyRuntimeQuestion } from '../../services/policyRuntimeQuestionNormalizer.mjs';
import { buildPolicyRuntimeQuestionReductionFromRuntimeInput } from '../../services/policyRuntimeQuestionReduction.mjs';

let database;
let delivery;
const query = (...args) => database.query(...args);
const withTransaction = (...args) => database.withTransaction(...args);
const routeToArr = jest.fn().mockResolvedValue({ attempted: true, routed: true });
jest.unstable_mockModule('../../config/database.mjs', () => ({ query, withTransaction, default: { query, withTransaction } }));
jest.unstable_mockModule('../../services/classificationRoutingService.mjs', () => ({ routeToArr }));
jest.unstable_mockModule('../../services/discordDelivery.mjs', () => ({ discordDelivery: { send: input => delivery.send(input) } }));

const { sendPendingDecisionNotification } = await import('../../services/discordPendingNotification.mjs');
const { handleInteraction } = await import('../../services/discordInteractionHandler.mjs');

beforeAll(() => {
  database = createReadinessDatabase({ max: 4 });
  delivery = createDiscordDeliveryService(createDiscordDeliveryRepository(database),
    (input, _payload, body) => input.channel.send(JSON.parse(body)), { serialize: serializeDiscordDeliveryBody });
});
afterAll(async () => { await database.pool.end(); });

function nativeQuestion(destination) {
  const plan = buildPolicyRuntimeQuestionReductionFromRuntimeInput({
    libraryProfile: { identityCandidates: [{ label: 'Animation', count: 1, confidence: 0.6 }] },
    metadataSignals: [{ label: 'Family', confidence: 0.7 }],
  });
  return {
    version: 'policy.runtime_question_persistence.v1',
    question: plan.question.operatorQuestion,
    options: [
      { label: 'Resolve current item', outcomeId: 'resolve_current_item', library_id: destination.id },
      { label: 'Do not learn', outcomeId: 'do_not_learn' },
    ],
    runtimeQuestion: plan.question,
    runtimeQuestionReductionPlan: plan,
    meta: { runtime_question_persistence: { destinationLibraryId: destination.id, destinationLibraryName: destination.name } },
  };
}

function buttonInteraction(customId, message) {
  return {
    customId, message,
    isButton: () => true,
    user: { id: '444444444444444444', username: 'owned-operator' },
    deferUpdate: jest.fn(), editReply: jest.fn(), followUp: jest.fn(), reply: jest.fn(),
  };
}

test('delivered compact buttons resolve only the exact row and replay without another route', async () => {
  const ids = ['9007199254740992', '9007199254740993', '9223372036854775807'];
  const [firstId, targetId, maxId] = ids;
  const channelId = '222222222222222222';
  const { rows: [config] } = await query(`INSERT INTO notification_config
    (type, enabled, bot_token, channel_id, notify_on_pending_items)
    VALUES ('discord',true,'synthetic-token',$1,true) RETURNING *`, [channelId]);
  const { rows: [destination] } = await query(`INSERT INTO libraries(id,name,external_id,media_type,is_active)
    VALUES (2147483647,'Owned destination','compact-destination','movie',true) RETURNING id,name,media_type,is_active`);
  const messages = new Map();
  const send = jest.fn(async body => {
    const marker = readDeliveryMarker(body.embeds[0].footer.text);
    const message = { id: `33333333333333333${messages.size}`, ...body };
    messages.set(marker.classificationId, message);
    return message;
  });
  const client = { token: 'synthetic-token', user: { id: '111111111111111111' }, options: Options.createDefault(),
    channels: { fetch: async () => ({ client, send }) } };
  for (const [index, id] of ids.entries()) {
    const metadata = { title: `Owned compact ${index}`, tmdb_id: 894001 + index, media_type: 'movie' };
    const question = id === maxId ? nativeQuestion(destination) : normalizePolicyRuntimeQuestion({ metadata,
      libraries: [destination], policyResult: { ranked: [{ library_id: destination.id, score: 75 }] } });
    await query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,method,metadata,policy_question)
      VALUES($1,$2,$3,'movie','awaiting_decision','signal_calculation',$4::jsonb,$5::jsonb)`,
    [id, metadata.title, metadata.tmdb_id, JSON.stringify(metadata), JSON.stringify(question)]);
    const result = { classification_id: id, method: 'signal_calculation', policy_question: question };
    const delivered = await sendPendingDecisionNotification(metadata, result, { client, channelId, config, warnFn: jest.fn() });
    expect(delivered).toEqual({ sent: true, messageId: messages.get(id)?.id });
  }
  expect(send).toHaveBeenCalledTimes(3);
  const customIdFor = id => messages.get(id).components[0].components[0].custom_id;
  expect(customIdFor(maxId)).toMatch(/^ai_answer_9223372036854775807_c_2147483647_[A-Za-z0-9_-]{22}$/);
  expect(customIdFor(maxId)).toHaveLength(65);
  const snapshot = async () => (await query(`SELECT id,status,discord_message_id,metadata FROM classification_history
    WHERE id=ANY($1::bigint[]) ORDER BY id`, [ids])).rows;
  const learningReceipts = async () => (await query(`SELECT id,classification_id,source_event_id
    FROM policy_authorized_outcome_source_event_receipts WHERE classification_id=ANY($1::bigint[]) ORDER BY id`, [ids])).rows;
  const before = await snapshot();
  expect(before.map(row => row.discord_message_id)).toEqual(ids.map(id => messages.get(id).id));
  const wrongMessage = buttonInteraction(customIdFor(targetId), messages.get(firstId));
  await handleInteraction(wrongMessage);
  expect(wrongMessage.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('does not belong') }));
  const wrongFingerprint = buttonInteraction(customIdFor(firstId).replace(firstId, targetId), messages.get(targetId));
  await handleInteraction(wrongFingerprint);
  expect(wrongFingerprint.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('changed') }));
  expect(await snapshot()).toEqual(before);
  expect(await learningReceipts()).toEqual([]);
  expect(routeToArr).not.toHaveBeenCalled();

  for (const id of [targetId, maxId]) {
    const click = () => buttonInteraction(customIdFor(id), messages.get(id));
    const submitted = [click(), click()];
    await Promise.all(submitted.map(handleInteraction));
    expect(submitted.flatMap(interaction => interaction.editReply.mock.calls)).toHaveLength(1);
    expect(submitted.flatMap(interaction => interaction.followUp.mock.calls)).toEqual([
      [expect.objectContaining({ content: expect.stringContaining('Already processed'), ephemeral: true })],
    ]);
    const saved = await snapshot();
    const resolved = saved.find(row => row.id === id);
    expect(resolved).toMatchObject({ status: 'routed', metadata: { classification_details: { outcome_link: {
      runtime_question_answer: { classification_id: id, destination_library_id: destination.id,
        contract_fingerprint: customIdFor(id).slice(-22) },
      ...(id === maxId ? { type: 'native_pending_route', event_type_id: 'route_succeeded' } : {}),
    } } } });
    const receipts = await learningReceipts();
    if (id === targetId) expect(receipts).toEqual([expect.objectContaining({ classification_id: targetId,
      source_event_id: `runtime_exact_item_memory:${targetId}:${customIdFor(targetId).slice(-22)}` })]);
    await handleInteraction(click());
    expect(await snapshot()).toEqual(saved);
    expect(await learningReceipts()).toEqual(receipts);
  }
  expect((await snapshot())[0]).toEqual(before[0]);
  expect(routeToArr.mock.calls.map(([item]) => item.tmdb_id)).toEqual([894002, 894003]);
});
