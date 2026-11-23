/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, beforeAll, beforeEach, expect, jest, test } from '@jest/globals';
import { ActionRow, ComponentType, EmbedBuilder, Options } from 'discord.js';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createDiscordDeliveryRepository } from '../../services/discordDeliveryRepository.mjs';
import { createDiscordDeliveryService } from '../../services/discordDeliveryService.mjs';
import { serializeDiscordDeliveryBody } from '../../services/discordDeliveryBody.mjs';
import { createCorrectionComponents, createTieredComponents } from '../../services/discordNotificationComponents.mjs';

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
const { classificationOutcomeService } = await import('../../services/classificationOutcomeService.mjs');

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
beforeEach(() => {
  routeToArr.mockReset().mockResolvedValue({ attempted: true, routed: true });
  beforeWrite = undefined;
});
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

function completedClick(id, action, kind, options = {}) {
  const libraries = [source, destination];
  const rendered = kind === 'classification' ? createCorrectionComponents(id, libraries)
    : createTieredComponents(id, libraries, { tier: 'verify' });
  const customId = action === 'reclassify' ? `${action}_${id}_${destination.id}` : `${action}_${id}`;
  const click = interaction('button', id, options.messageId ?? messageId);
  const rows = rendered.map(row => row.toJSON());
  for (const row of rows) {
    const component = row.components.find(entry => entry.custom_id === customId);
    if (component && options.disabled) component.disabled = true;
  }
  click.customId = customId;
  click.message.components = options.unoffered ? [] : rows.map(row => new ActionRow(row));
  return click;
}

test.each([
  [Number.MAX_SAFE_INTEGER - 3, 'correct', 'classification'], [7142, 'verify_yes', 'confidence'],
])('affirmative control %s commits verification and outcome once before routing', async (id, action, kind) => {
  await insertHistory(id, messageId, 'completed');
  await insertDeliveredReceipt(id, 'completed', kind);
  routeToArr.mockImplementationOnce(async () => {
    expect(await history(id)).toMatchObject({ status: 'verified', clarification_status: 'confirmed',
      metadata: { classification_details: { outcome_link: { type: 'verified', final_library_id: source.id } } } });
    return { attempted: true, routed: true };
  });
  const clicks = [completedClick(id, action, kind), completedClick(id, action, kind)];
  await Promise.all(clicks.map(handleInteraction));
  expect(clicks.flatMap(click => click.editReply.mock.calls)).toHaveLength(1);
  expect(clicks.flatMap(click => click.followUp.mock.calls)).toEqual(expect.arrayContaining([
    [expect.objectContaining({ content: expect.stringContaining('Already processed') })],
  ]));
  expect(await history(id)).toMatchObject({ status: 'routed', library_id: source.id });
  expect(routeToArr).toHaveBeenCalledTimes(1);
});

test('verification outcome failure rolls back the History transition and skips routing', async () => {
  const id = 7143;
  await insertHistory(id, messageId, 'completed');
  await insertDeliveredReceipt(id, 'completed', 'confidence');
  const before = await history(id);
  const injectedFailure = jest.spyOn(classificationOutcomeService, 'recordOutcome')
    .mockImplementationOnce((_id, _outcome, { client }) => client.query('SELECT 1/0'));
  try {
    const click = completedClick(id, 'verify_yes', 'confidence');
    await handleInteraction(click);
    expect(injectedFailure).toHaveBeenCalledTimes(1);
    expect(click.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Failed to process verification') }));
    expect(click.editReply).not.toHaveBeenCalled();
    expect(await history(id)).toEqual(before);
    expect(routeToArr).not.toHaveBeenCalled();
  } finally { injectedFailure.mockRestore(); }
});

test.each([
  [7144, 'verify_yes', 'confidence', 'awaiting_decision', 'completed', 'confidence', {}],
  [7145, 'correct', 'classification', 'completed', 'awaiting_decision', 'classification', {}],
  [7146, 'verify_yes', 'confidence', 'corrected', 'completed', 'confidence', {}],
  [7147, 'verify_no', 'confidence', 'completed', 'completed', 'classification', {}],
  [7148, 'reclassify', 'classification', 'completed', null, null, {}],
  [7149, 'reclassify', 'classification', 'completed', 'completed', 'classification', { disabled: true }],
  [7150, 'correct', 'classification', 'completed', 'completed', 'classification', { unoffered: true }],
  [7151, 'verify_no', 'confidence', 'completed', 'completed', 'confidence', { messageId: changedMessageId }],
])('completed button on row %i refuses stale or missing evidence', async (id, action, kind, status, previousStatus, receiptKind, options) => {
  await insertHistory(id, messageId, status);
  if (previousStatus) await insertDeliveredReceipt(id, previousStatus, receiptKind);
  const before = await history(id);
  const click = completedClick(id, action, kind, options);
  await handleInteraction(click);
  const reply = options.disabled || options.unoffered ? click.reply : click.followUp;
  expect(reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Open Classifarr') }));
  expect(click.editReply).not.toHaveBeenCalled();
  expect(await history(id)).toEqual(before);
  expect(await corrections(id)).toEqual([]);
  expect(routeToArr).not.toHaveBeenCalled();
});

test.each([[7152, 'reclassify', 'classification'], [7153, 'verify_no', 'confidence']])(
  'button on row %i rechecks its message while waiting on the History lock', async (id, action, kind) => {
    await insertHistory(id, messageId, 'completed');
    await insertDeliveredReceipt(id, 'completed', kind);
    const blocker = await database.pool.connect();
    let handling;
    try {
      await blocker.query('BEGIN');
      await blocker.query('UPDATE classification_history SET discord_message_id=$2 WHERE id=$1', [id, changedMessageId]);
      const entered = new Promise(resolve => { beforeWrite = resolve; });
      const click = completedClick(id, action, kind);
      handling = handleInteraction(click);
      await Promise.race([entered, handling.then(() => { throw new Error('expected lock acquisition'); })]);
      await blocker.query('COMMIT');
      await handling;
      expect(click.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('saved Discord notification') }));
      expect(click.editReply).not.toHaveBeenCalled();
      expect(await history(id)).toMatchObject({ status: 'completed', library_id: source.id, discord_message_id: changedMessageId });
      expect(await corrections(id)).toEqual([]);
      expect(routeToArr).not.toHaveBeenCalled();
    } finally {
      beforeWrite = undefined;
      await blocker.query('ROLLBACK');
      blocker.release();
      await handling;
    }
  },
);

test.each([[7154, 'reclassify', 'classification'], [7155, 'verify_no', 'confidence']])(
  'completed row %i can still be corrected through its offered control', async (id, action, kind) => {
    await insertHistory(id, messageId, 'completed');
    await insertDeliveredReceipt(id, 'completed', kind);
    let click = completedClick(id, action, kind);
    if (action === 'verify_no') {
      await handleInteraction(click);
      const [{ components }] = click.editReply.mock.calls[0];
      expect(await history(id)).toMatchObject({ status: 'completed', library_id: source.id });
      expect(routeToArr).not.toHaveBeenCalled();
      click = interaction('selector', id);
      click.message.components = components.map(row => new ActionRow(row.toJSON()));
    }
    await handleInteraction(click);
    expect(click.editReply).toHaveBeenCalledTimes(1);
    expect(await corrections(id)).toEqual([{ classification_id: id, corrected_library_id: destination.id }]);
    expect(await history(id)).toMatchObject({ status: 'routed', library_id: destination.id });
    expect(routeToArr).toHaveBeenCalledTimes(1);
    expect(routeToArr).toHaveBeenCalledWith(expect.objectContaining({ title: `Owned legacy ${id}` }),
      expect.objectContaining({ id: destination.id }));
  },
);

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
