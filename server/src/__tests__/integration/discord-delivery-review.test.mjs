/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createDiscordDeliveryReviewRepository } from '../../services/discordDeliveryReviewRepository.mjs';

const db = createIntegrationDatabaseModuleMock();
const repository = createDiscordDeliveryReviewRepository(db);
const maximum = '9223372036854775807';
beforeEach(async () => {
  await getPool().query('DELETE FROM classification_history');
});

test('fresh setup and legacy history without receipts return no fabricated records', async () => {
  await getPool().query(`INSERT INTO classification_history (title, media_type, discord_message_id, status)
    VALUES ('Legacy', 'movie', '111111111111111111', 'awaiting_decision')`);
  expect(await repository.list(maximum)).toEqual({ items: [], nextBefore: null });
});

test('pages all states without duplicates, truncates titles and never mutates receipts or history', async () => {
  await getPool().query(`WITH history AS (
    INSERT INTO classification_history (title, media_type, status)
    SELECT repeat('Long title ', 40), 'movie', 'awaiting_decision' FROM generate_series(1, 53) RETURNING id
  ) INSERT INTO discord_notification_deliveries
    (classification_id, nonce, bot_user_id, channel_id, notification_kind, state, message_id)
    SELECT id, 'cf_' || lpad(id::text, 22, '0'), '111111111111111111', '222222222222222222', 'pending',
      CASE id % 4 WHEN 0 THEN 'delivered' WHEN 1 THEN 'sending' WHEN 2 THEN 'uncertain' ELSE 'rejected' END,
      CASE WHEN id % 4 = 0 THEN '333333333333333333' ELSE NULL END FROM history`);
  const original = await getPool().query('SELECT * FROM discord_notification_deliveries ORDER BY classification_id');
  const history = await getPool().query('SELECT * FROM classification_history ORDER BY id');
  const first = await repository.list(maximum);
  const second = await repository.list(first.nextBefore);
  const third = await repository.list(second.nextBefore);
  expect([first.items.length, second.items.length, third.items.length]).toEqual([25, 25, 3]);
  expect(third.nextBefore).toBeNull();
  const items = [...first.items, ...second.items, ...third.items];
  expect(new Set(items.map(item => item.classificationId)).size).toBe(53);
  expect(new Set(items.map(item => item.state)).size).toBe(4);
  expect(items.every(item => item.title.length === 240)).toBe(true);
  expect(items.map(item => Number(item.classificationId))).toEqual(history.rows.map(row => Number(row.id)).reverse());
  expect(Object.keys(items[0]).sort()).toEqual(['channelId', 'classificationId', 'createdAt', 'kind', 'messageId', 'state', 'title', 'updatedAt']);
  expect((await getPool().query('SELECT * FROM discord_notification_deliveries ORDER BY classification_id')).rows).toEqual(original.rows);
  expect((await getPool().query('SELECT * FROM classification_history ORDER BY id')).rows).toEqual(history.rows);
});

test('transaction is read-only, bounded and releases settings afterward', async () => {
  const checked = { withTransaction: fn => db.withTransaction(client => fn({
    query: async (sql, params) => {
      if (sql.includes('SELECT d.')) {
        const { rows: [settings] } = await client.query(`SELECT current_setting('transaction_read_only') AS ro,
          current_setting('statement_timeout') AS timeout, current_setting('lock_timeout') AS lock`);
        expect(settings).toEqual({ ro: 'on', timeout: '3s', lock: '1s' });
      }
      return client.query(sql, params);
    },
  })) };
  await createDiscordDeliveryReviewRepository(checked).list(maximum);
  await getPool().query("INSERT INTO classification_history (title, media_type, status) VALUES ('Still writable', 'movie', 'awaiting_decision')");
});

test('a conflicting table lock times out and rolls back without poisoning the next read', async () => {
  const blocker = await getPool().connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query('LOCK TABLE discord_notification_deliveries IN ACCESS EXCLUSIVE MODE');
    await expect(repository.list(maximum)).rejects.toMatchObject({ code: '55P03' });
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }
  expect(await repository.list(maximum)).toEqual({ items: [], nextBefore: null });
});
