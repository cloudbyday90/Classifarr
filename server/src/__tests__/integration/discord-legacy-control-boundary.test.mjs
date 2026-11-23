/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, beforeAll, beforeEach, expect, jest, test } from '@jest/globals';
import { ActionRow, ComponentType, EmbedBuilder, Options } from 'discord.js';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createDiscordDeliveryRepository } from '../../services/discordDeliveryRepository.mjs';
import { createDiscordDeliveryService } from '../../services/discordDeliveryService.mjs';
import { serializeDiscordDeliveryBody } from '../../services/discordDeliveryBody.mjs';
import { createTieredComponents } from '../../services/discordNotificationComponents.mjs';

let database;
let beforeWrite;
let source;
let destination;
let delivery;
const query = (...args) => database.query(...args);
const withTransaction = (...args) => {
  beforeWrite?.();
  return database.withTransaction(...args);
};
const routeToArr = jest.fn().mockResolvedValue({ attempted: true, routed: true });
jest.unstable_mockModule('../../config/database.mjs', () => ({ query, withTransaction, default: { query, withTransaction } }));
jest.unstable_mockModule('../../services/classificationRoutingService.mjs', () => ({ routeToArr }));
jest.unstable_mockModule('../../services/discordDelivery.mjs', () => ({ discordDelivery: { send: input => delivery.send(input) } }));
const { handleInteraction } = await import('../../services/discordInteractionHandler.mjs');
const { sendClassificationNotification } = await import('../../services/discordClassificationNotification.mjs');

const messageId = '111111111111111111';
const changedMessageId = '222222222222222222';
beforeAll(async () => {
  database = createReadinessDatabase({ max: 5 });
  delivery = createDiscordDeliveryService(createDiscordDeliveryRepository(database),
    (input, _payload, body) => input.channel.send(JSON.parse(body)), { serialize: serializeDiscordDeliveryBody });
  const { rows } = await query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES ('Legacy saved library','legacy-saved','movie',true),('Legacy destination','legacy-target','movie',true)
    RETURNING id,name,media_type`);
  [source, destination] = rows;
});
beforeEach(() => { routeToArr.mockClear(); beforeWrite = undefined; });
afterAll(async () => { await database.pool.end(); });

function interaction(kind, id, savedMessage = messageId, placeholder = 'Or choose a different library...') {
  const value = `${id}_${destination.id}`;
  const components = kind === 'button'
    ? [{ components: [{ customId: `ai_clarify_${id}_0`, label: 'Use saved library' }] }]
    : [new ActionRow({ type: ComponentType.ActionRow, components: [{ type: ComponentType.StringSelect,
      custom_id: 'library_select', placeholder, options: [{ label: destination.name, value }] }] })];
  return {
    isButton: () => kind === 'button', isStringSelectMenu: () => kind === 'selector',
    customId: kind === 'button' ? `ai_clarify_${id}_0` : 'library_select',
    values: [value],
    message: { id: savedMessage, components,
      embeds: [new EmbedBuilder().setTitle('Owned legacy control')] },
    user: { id: '333333333333333333', username: 'owned-operator' },
    deferUpdate: jest.fn(), editReply: jest.fn(), followUp: jest.fn(), reply: jest.fn(),
  };
}

async function insertHistory(id, savedMessage = messageId, status = 'awaiting_decision') {
  const title = `Owned legacy ${id}`;
  const metadata = { title, media_type: 'movie', tmdb_id: 894801 };
  await query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,library_id,library_name,discord_message_id,metadata)
    VALUES($1,$2,894801,'movie',$3,$4,$5,$6,$7::jsonb)`, [id, title, status, source.id, source.name, savedMessage, JSON.stringify(metadata)]);
}

async function insertDeliveredReceipt(id, previousStatus, kind = 'classification', clarificationStatus = null, savedMessage = messageId) {
  await query(`INSERT INTO discord_notification_deliveries
    (classification_id,nonce,bot_user_id,channel_id,notification_kind,state,message_id,previous_status,desired_clarification_status)
    VALUES($1,$2,'444444444444444444','555555555555555555',$3,'delivered',$4,$5,$6)`,
  [id, `cf_${String(id).padStart(22, '0')}`, kind, savedMessage, previousStatus, clarificationStatus]);
}

const history = async id => (await query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
const corrections = async id => (await query(`SELECT classification_id,corrected_library_id
  FROM classification_corrections WHERE classification_id=$1`, [id])).rows;

test('the delivered classification menu corrects but a manual confidence menu keeps its original meaning', async () => {
  const channelId = '555555555555555555';
  const { rows: [config] } = await query(`INSERT INTO notification_config
    (type,enabled,bot_token,channel_id,notify_on_classification,enable_corrections)
    VALUES ('discord',true,'synthetic-token',$1,true,true) RETURNING *`, [channelId]);
  const [correctionId, manualId] = [7131, 7132];
  const libraries = [source, destination];
  const messages = [];
  const send = async payload => {
    const message = { ...payload, id: `33333333333333333${messages.length}` };
    messages.push(message);
    return message;
  };
  const client = { token: 'synthetic-token', user: { id: '444444444444444444' }, options: Options.createDefault(),
    channels: { fetch: async () => ({ client, send }) } };
  const channel = { client, send };
  const context = { client, channelId, config, warnFn: jest.fn() };
  await insertHistory(correctionId, null, 'completed');
  await insertHistory(manualId, null, 'completed');

  expect(await sendClassificationNotification({ title: 'Completed selector', media_type: 'movie' }, {
    classification_id: correctionId, library_name: source.name, libraries, confidence: 90, method: 'policy',
  }, context)).toEqual({ sent: true, messageId: messages[0]?.id });
  const components = createTieredComponents(manualId, libraries, { tier: 'manual', action: 'verify_buttons' });
  expect(await delivery.send({ ...context, channel, classificationId: manualId, kind: 'confidence',
    clarificationStatus: 'verify_buttons', payload: { components, embeds: [new EmbedBuilder().setTitle('Manual selector')] },
  })).toEqual({ sent: true, messageId: messages[1]?.id });
  const click = (id, message) => ({ ...interaction('selector', id), message: {
    ...message, components: message.components.map(row => new ActionRow(row)),
  } });
  const manualBefore = await history(manualId);
  const manual = click(manualId, messages[1]);
  await handleInteraction(manual);
  expect(manual.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Open Classifarr') }));
  expect(await history(manualId)).toEqual(manualBefore);
  expect(await corrections(manualId)).toEqual([]);

  const completed = click(correctionId, messages[0]);
  await handleInteraction(completed);
  expect(completed.editReply).toHaveBeenCalledTimes(1);
  expect(await corrections(correctionId)).toEqual([{ classification_id: correctionId, corrected_library_id: destination.id }]);
  expect(routeToArr).toHaveBeenCalledTimes(1);
});

test.each([
  ['button', Number.MAX_SAFE_INTEGER, 'awaiting_decision', null, null],
  ['selector', Number.MAX_SAFE_INTEGER - 1, 'completed', 'classification', null],
  ['selector', Number.MAX_SAFE_INTEGER - 2, 'routed', 'confidence', 'verify_buttons'],
])('a bound %s on row %i preserves the exact row and routes only once', async (kind, id, status, deliveryKind, clarificationStatus) => {
    await insertHistory(id, messageId, status);
    if (deliveryKind) await insertDeliveredReceipt(id, status, deliveryKind, clarificationStatus);
    const placeholder = deliveryKind === 'confidence' ? 'Select the correct library...' : undefined;
    const accepted = interaction(kind, id, messageId, placeholder);
    await handleInteraction(accepted);
    expect(accepted.editReply).toHaveBeenCalledTimes(1);
    const saved = await history(id);
    const chosen = kind === 'button' ? source : destination;
    expect(saved).toMatchObject({ id, status: 'routed', library_id: chosen.id, discord_message_id: messageId });
    expect(await corrections(id)).toEqual(kind === 'button' ? [] : [{ classification_id: id, corrected_library_id: chosen.id }]);
    const replay = interaction(kind, id, messageId, placeholder);
    await handleInteraction(replay);
    expect(replay.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Already processed') }));
    expect(await history(id)).toEqual(saved);
    expect(routeToArr).toHaveBeenCalledTimes(1);
  },
);

test.each([
  [7121, 'awaiting_decision', 'awaiting_decision', 'classification', null, messageId],
  [7122, 'completed', 'awaiting_decision', 'classification', null, messageId],
  [7123, 'completed', null, null, null, messageId],
  [7124, 'completed', 'completed', 'confidence', 'awaiting_clarification', messageId],
  [7125, 'reclassified', 'completed', 'classification', null, messageId],
  [7126, 'completed', 'completed', 'classification', null, changedMessageId],
])('selector row %i refuses without exact completed notification provenance', async (id, status, previousStatus, kind, clarificationStatus, receiptMessageId) => {
    await insertHistory(id, messageId, status);
    if (previousStatus) await insertDeliveredReceipt(id, previousStatus, kind, clarificationStatus, receiptMessageId);
    const before = await history(id);
    const rejected = interaction('selector', id);
    await handleInteraction(rejected);
    expect(rejected.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Open Classifarr') }));
    expect(await history(id)).toEqual(before);
    expect(await corrections(id)).toEqual([]);
    expect(routeToArr).not.toHaveBeenCalled();
});

test.each([['button', 7101, null], ['selector', 7102, null],
  ['button', 7103, changedMessageId], ['selector', 7104, changedMessageId]])(
  'a %s on History ID %i refuses missing or foreign message evidence', async (kind, id, savedMessage) => {
    await insertHistory(id, savedMessage);
    const before = await history(id);
    const rejected = interaction(kind, id);
    await handleInteraction(rejected);
    expect(rejected.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Open Classifarr') }));
    expect(await history(id)).toEqual(before);
    expect(await corrections(id)).toEqual([]);
    expect(routeToArr).not.toHaveBeenCalled();
  },
);

test.each([
  ['button', 7111, 'discord_message_id=$2', changedMessageId, 'Open Classifarr'],
  ['selector', 7112, 'discord_message_id=$2', changedMessageId, 'Open Classifarr'],
  ['button', 7113, 'policy_question=$2::jsonb', '{"question":"New review"}', 'stale'],
  ['button', 7114, 'library_id=$2', () => destination.id, 'stale'],
])('a %s waiting to write row %i rechecks the locked state', async (kind, id, assignment, value, expected) => {
  await insertHistory(id);
  const blocked = await database.pool.connect();
  let handling;
  try {
    await blocked.query('BEGIN');
    await blocked.query(`UPDATE classification_history SET ${assignment} WHERE id=$1`, [id, typeof value === 'function' ? value() : value]);
    const enteringWrite = new Promise(resolve => { beforeWrite = resolve; });
    const rejected = interaction(kind, id);
    handling = handleInteraction(rejected);
    // A result before the writer enters the transaction also fails the assertion.
    await Promise.race([enteringWrite, handling.then(() => { throw new Error('expected locked write'); })]);
    await blocked.query('COMMIT');
    const changed = await history(id);
    await handling;
    expect(rejected.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining(expected) }));
    expect(changed.status).toBe('awaiting_decision');
    expect(await history(id)).toEqual(changed);
    expect(await corrections(id)).toEqual([]);
    expect(routeToArr).not.toHaveBeenCalled();
  } finally {
    beforeWrite = undefined;
    await blocked.query('ROLLBACK');
    blocked.release();
    await handling;
  }
});
