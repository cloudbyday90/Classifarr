/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createDiscordDeliveryRepository } from '../../services/discordDeliveryRepository.mjs';
import { createDiscordDeliveryService } from '../../services/discordDeliveryService.mjs';
import { createDiscordDeliveryWriter } from '../../services/discordDeliveryWriter.mjs';
import { serializeDiscordDeliveryBody } from '../../services/discordDeliveryBody.mjs';
import { createDiscordDeliveryOutbox, retainDiscordDelivery } from '../../services/discordDeliveryOutbox.mjs';
import { createDiscordDeliveryDispatcher } from '../../services/discordDeliveryDispatcher.mjs';
import { createDiscordProviderCooldown } from '../../services/discordProviderCooldown.mjs';
import { createDiscordDeliveryReviewRepository } from '../../services/discordDeliveryReviewRepository.mjs';

const db = createIntegrationDatabaseModuleMock();
const bot = '111111111111111111'; const channelId = '222222222222222222'; const messageId = '333333333333333333';
let input; let server; let url; let requests; let respond; let report;
const repository = () => createDiscordDeliveryRepository(db);
const outbox = () => createDiscordDeliveryOutbox(db);
const receipt = async () => (await getPool().query('SELECT * FROM discord_notification_deliveries WHERE classification_id = $1', [input.classificationId])).rows[0];
const buffer = async () => (await getPool().query('SELECT * FROM discord_delivery_outbox')).rows;
const expireCooldown = () => getPool().query("UPDATE discord_provider_cooldown SET next_allowed_at = clock_timestamp() - interval '1 second'");
const service = (repo = repository()) => createDiscordDeliveryService(repo, createDiscordDeliveryWriter({
  cooldown: createDiscordProviderCooldown(db), request: (_url, init) => fetch(url, init), timeoutMs: 1000,
}), { serialize: serializeDiscordDeliveryBody });
const worker = (extra = {}) => createDiscordDeliveryDispatcher({ outbox: outbox(), delivery: service(), report,
  getContext: async () => ({ client: input.client, config: (await getPool().query('SELECT * FROM notification_config WHERE id = $1', [input.config.id])).rows[0] }), ...extra });

beforeEach(async () => {
  await getPool().query('DELETE FROM discord_provider_cooldown');
  await getPool().query('DELETE FROM notification_config');
  await getPool().query('DELETE FROM classification_history');
  const { rows: [config] } = await getPool().query(`INSERT INTO notification_config
    (type, enabled, bot_token, channel_id) VALUES ('discord', true, 'synthetic-token', $1) RETURNING *`, [channelId]);
  const { rows: [history] } = await getPool().query(`INSERT INTO classification_history
    (title, media_type, status) VALUES ('Fixture', 'movie', 'awaiting_decision') RETURNING id`);
  const client = { user: { id: bot }, token: 'synthetic-token', options: { allowedMentions: { parse: [] }, jsonTransformer: value => value } };
  input = { classificationId: history.id, kind: 'pending', config, channelId, client, channel: { client },
    payload: { content: 'Original intent' } };
  requests = []; report = jest.fn();
  respond = (_req, res) => { res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '60' }); res.end('{"retry_after":60}'); };
  server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body)); respond(req, res);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); });
function success() {
  respond = (_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: messageId, channel_id: channelId, author: { id: bot, bot: true } })); };
}
async function deferred() {
  expect(await service().send(input)).toMatchObject({ reason: 'delivery_deferred' });
  expect(await buffer()).toHaveLength(1);
  await expireCooldown();
}

test('durable body survives recreated services; only one competing worker sends the original intent', async () => {
  await deferred(); success(); input.payload.content = 'Changed caller payload';
  const results = await Promise.all([worker().run(), worker().run()]);
  expect(results.reduce((n, result) => n + result.delivered, 0)).toBe(1);
  expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]);
  expect(await receipt()).toMatchObject({ state: 'delivered', message_id: messageId, attempt_count: 2 });
  expect(await buffer()).toHaveLength(0);
});

test('shared persisted cooldown prevents a worker POST without consuming attempt budget', async () => {
  await service().send(input);
  expect(await worker().run()).toMatchObject({ attempted: 0 });
  expect(requests).toHaveLength(1); expect((await receipt()).attempt_count).toBe(1);
});

test('read-only review exposes queued versus expired status, never retained message bodies', async () => {
  await deferred(); const review = createDiscordDeliveryReviewRepository(db);
  const queued = await review.list('9223372036854775807');
  expect(queued.items[0].retryQueued).toBe(true);
  expect(JSON.stringify(queued)).not.toContain('Original intent');
  await getPool().query("UPDATE discord_delivery_outbox SET expires_at = clock_timestamp() - interval '1 second'");
  expect((await review.list('9223372036854775807')).items[0].retryQueued).toBe(false);
  expect(requests).toHaveLength(1);
});

test('provider request holds no SQL transaction or parent row lock', async () => {
  await deferred(); const reached = Promise.withResolvers(); const release = Promise.withResolvers();
  respond = async (_req, res) => { reached.resolve(); await release.promise; res.writeHead(403); res.end('{}'); };
  const pending = worker().run(); await reached.promise;
  try {
    await db.withTransaction(client => client.query('SELECT id FROM classification_history WHERE id = $1 FOR UPDATE NOWAIT', [input.classificationId]));
  } finally { release.resolve(); await pending; }
});

test('three confirmed 429s exhaust the budget; cleanup preserves the receipt', async () => {
  await deferred(); await worker().run(); await expireCooldown(); await worker().run(); await expireCooldown();
  expect(await worker().run()).toMatchObject({ attempted: 0, discarded: 1 });
  expect(requests).toHaveLength(3); expect((await receipt()).attempt_count).toBe(3);
  expect(await buffer()).toHaveLength(0);
});

test.each(['revision', 'token', 'channel', 'decision', 'clarification'])('%s change cancels retry without remote effect', async change => {
  await deferred(); success();
  if (change === 'revision') await getPool().query("UPDATE notification_config SET updated_at = updated_at + interval '1 second'");
  if (change === 'token') await getPool().query("UPDATE notification_config SET bot_token = 'rotated'");
  if (change === 'channel') await getPool().query('UPDATE notification_config SET channel_id = $1', [messageId]);
  if (change === 'decision') await getPool().query("UPDATE classification_history SET status = 'verified'");
  if (change === 'clarification') await getPool().query("UPDATE classification_history SET clarification_status = 'resolved'");
  expect(await worker().run()).toMatchObject({ discarded: 1, delivered: 0 });
  expect(requests).toHaveLength(1); expect(await buffer()).toHaveLength(0);
});

test('disabled bot waits without HTTP and still prunes expired payloads', async () => {
  await deferred(); await getPool().query('UPDATE notification_config SET enabled = false');
  expect(await worker().run()).toMatchObject({ attempted: 0 });
  await getPool().query("UPDATE discord_delivery_outbox SET expires_at = clock_timestamp() - interval '1 second'");
  expect(await worker().run()).toMatchObject({ attempted: 0, discarded: 1 });
  expect(requests).toHaveLength(1); expect(await receipt()).toBeDefined();
});

test.each(['sending', 'uncertain', 'rejected', 'delivered'])('%s is never replayed on restart', async state => {
  await deferred();
  await getPool().query('UPDATE discord_notification_deliveries SET state = $1, message_id = $2', [state, state === 'delivered' ? messageId : null]);
  expect(await worker().run()).toMatchObject({ attempted: 0 }); expect(requests).toHaveLength(1);
});

test('legacy deferred receipt with no retained body cannot be invented', async () => {
  await deferred(); await getPool().query('DELETE FROM discord_delivery_outbox');
  expect(await worker().run()).toMatchObject({ attempted: 0 }); expect(requests).toHaveLength(1);
});

test('HTTP socket loss remains uncertain and cannot be retried again', async () => {
  await deferred(); respond = req => req.socket.destroy();
  await worker().run(); await worker().run();
  expect(requests).toHaveLength(2); expect((await receipt()).state).toBe('uncertain');
  expect(await buffer()).toHaveLength(0);
});

test('shutdown aborts a hanging response without authorizing replay', async () => {
  await deferred(); const reached = Promise.withResolvers();
  respond = () => reached.resolve();
  const current = worker(); const pending = current.run(); await reached.promise; current.stop();
  expect(await pending).toMatchObject({ status: 'cancelled' });
  expect((await receipt()).state).toBe('uncertain'); expect(await buffer()).toHaveLength(0);
  expect(await worker().run()).toMatchObject({ attempted: 0 }); expect(requests).toHaveLength(2);
});

test('permanent provider refusal drops the buffer without replay', async () => {
  await deferred(); respond = (_req, res) => { res.writeHead(403); res.end('{}'); };
  await worker().run(); await worker().run();
  expect((await receipt()).state).toBe('rejected'); expect(await buffer()).toHaveLength(0);
  expect(requests).toHaveLength(2);
});

test('a competing worker cannot discard the active sender buffer before another 429', async () => {
  await deferred(); const reached = Promise.withResolvers(); const release = Promise.withResolvers();
  respond = async (_req, res) => {
    reached.resolve(); await release.promise;
    res.writeHead(429, { 'retry-after': '60' }); res.end('{"retry_after":60}');
  };
  const selected = (await outbox().candidates())[0];
  const pending = worker().run(); await reached.promise;
  await worker({ outbox: { ...outbox(), candidates: async () => [selected] } }).run();
  expect(await buffer()).toHaveLength(1);
  release.resolve(); await pending;
  expect((await receipt()).state).toBe('deferred'); expect(await buffer()).toHaveLength(1);
});

test('lost admission acknowledgement never authorizes replay after restart', async () => {
  const original = repository();
  const lost = { ...original, claim: async args => { await original.claim(args); throw new Error('lost commit acknowledgement'); } };
  await service(lost).send(input);
  expect((await receipt()).state).toBe('sending'); expect(await buffer()).toHaveLength(1);
  expect(await worker().run()).toMatchObject({ attempted: 0 }); expect(requests).toHaveLength(0);
});

test('hard buffer capacity is 1000 and cleanup removes at most 100 per pass', async () => {
  await deferred(); const template = (await buffer())[0]; await outbox().discard(template.nonce);
  await getPool().query(`WITH h AS (
    INSERT INTO classification_history (title, media_type, status)
    SELECT 'capacity fixture', 'movie', 'awaiting_decision' FROM generate_series(1, 1000) RETURNING id
  ), d AS (
    INSERT INTO discord_notification_deliveries (classification_id, nonce, bot_user_id, channel_id, notification_kind, state)
    SELECT id, 'cf_' || lpad(id::text, 22, '0'), $1, $2, 'pending', 'deferred' FROM h RETURNING nonce
  ) INSERT INTO discord_delivery_outbox (nonce, config_id, body, expires_at)
    SELECT nonce, $3, '{}', clock_timestamp() - interval '1 second' FROM d`, [bot, channelId, input.config.id]);
  expect(await db.withTransaction(client => retainDiscordDelivery(client, {
    nonce: template.nonce, classificationId: input.classificationId, configId: input.config.id, body: template.body,
  }))).toBe(false);
  expect(await outbox().cleanup()).toBe(100); expect(await buffer()).toHaveLength(900);
});

test('positive evidence wins a race with dispatch and deletes retained content', async () => {
  await deferred(); const row = await receipt();
  await repository().complete({ nonce: row.nonce, botUserId: bot, channelId, messageId });
  expect(await worker().run()).toMatchObject({ attempted: 0 }); expect(requests).toHaveLength(1);
  expect(await buffer()).toHaveLength(0);
});

test('admission rollback cannot authorize HTTP or leave orphaned payload', async () => {
  const broken = createDiscordDeliveryRepository({ withTransaction: fn => db.withTransaction(async client => {
    await fn(client); await client.query('SELECT 1 / 0');
  }) });
  expect(await service(broken).send(input)).toMatchObject({ reason: 'delivery_unconfirmed' });
  expect(requests).toHaveLength(0); expect(await buffer()).toHaveLength(0); expect(await receipt()).toBeUndefined();
});

test('retained data excludes credentials; corrupt marker is discarded before admission', async () => {
  await deferred(); const row = (await buffer())[0];
  expect(row.body).not.toContain(input.client.token);
  await getPool().query("UPDATE discord_delivery_outbox SET body = '{}' ");
  expect(await worker().run()).toMatchObject({ discarded: 1 }); expect(requests).toHaveLength(1);
});

test('capacity lock contention falls back to a single send, never an unbounded queue', async () => {
  await db.withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('classifarr-discord-outbox-capacity'), 1)");
    expect(await service().send(input)).toMatchObject({ reason: 'delivery_deferred' });
  });
  expect(await buffer()).toHaveLength(0); expect(requests).toHaveLength(1);
});

test('oversized retention body cannot be inserted even for a valid receipt', async () => {
  await deferred(); const row = (await buffer())[0]; await outbox().discard(row.nonce);
  expect(await db.withTransaction(client => retainDiscordDelivery(client, {
    nonce: row.nonce, classificationId: input.classificationId, configId: input.config.id, body: row.body + ' '.repeat(65536),
  }))).toBe(false);
  expect(await buffer()).toHaveLength(0);
});
