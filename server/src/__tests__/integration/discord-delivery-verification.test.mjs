/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createDiscordDeliveryVerificationRepository } from '../../services/discordDeliveryVerificationRepository.mjs';
import { createDiscordDeliveryRepository } from '../../services/discordDeliveryRepository.mjs';
import { createDiscordDeliveryVerificationService } from '../../services/discordDeliveryVerificationService.mjs';
import { createDiscordDeliveryReviewRepository } from '../../services/discordDeliveryReviewRepository.mjs';

const db = createIntegrationDatabaseModuleMock();
const repository = createDiscordDeliveryVerificationRepository(db);
const deliveries = createDiscordDeliveryRepository(db);
const messageId = '333333333333333333';
let id;
beforeEach(async () => {
  await getPool().query('DELETE FROM discord_delivery_verification_guard');
  await getPool().query('DELETE FROM notification_config');
  await getPool().query('DELETE FROM classification_history');
  await getPool().query(`INSERT INTO notification_config (id, type, enabled, bot_token, channel_id)
    VALUES (1, 'discord', true, 'synthetic-token', '222222222222222222')`);
  const { rows: [history] } = await getPool().query(`INSERT INTO classification_history (title, media_type, status)
    VALUES ('Fixture', 'movie', 'awaiting_decision') RETURNING id::text`);
  id = history.id;
  await getPool().query(`INSERT INTO discord_notification_deliveries
    (classification_id, nonce, bot_user_id, channel_id, notification_kind, correlation_version, state)
    VALUES ($1, 'cf_abcdefghijklmnopqrstuv', '111111111111111111', '222222222222222222', 'pending', 1, 'uncertain')`, [id]);
});
const guard = async () => (await getPool().query('SELECT *, next_allowed_at::text AS deadline FROM discord_delivery_verification_guard')).rows[0];
const receipt = async () => (await getPool().query('SELECT * FROM discord_notification_deliveries WHERE classification_id = $1', [id])).rows[0];
const proof = row => ({ nonce: row.nonce, classificationId: String(row.classification_id), correlationVersion: 1,
  botUserId: row.bot_user_id, channelId: row.channel_id, messageId });

test('fresh/no receipt, legacy and rejected records do not create a guard or provider work', async () => {
  expect(await repository.admit('9223372036854775807')).toEqual({ code: 'receipt_missing' });
  await getPool().query('UPDATE discord_notification_deliveries SET correlation_version = NULL');
  expect(await repository.admit(id)).toEqual({ code: 'not_eligible' });
  await getPool().query("UPDATE discord_notification_deliveries SET correlation_version = 1, state = 'rejected'");
  expect(await repository.admit(id)).toEqual({ code: 'not_eligible' });
  expect(await guard()).toBeUndefined();
});
test.each(["enabled = false", "bot_token = NULL", "channel_id = '444444444444444444'"] )('configuration prerequisite %s', async change => {
  await getPool().query(`UPDATE notification_config SET ${change}`);
  expect(await repository.admit(id)).toEqual({ code: 'configuration_changed' });
  expect(await guard()).toBeUndefined();
});
test('review exposes eligibility without exposing receipt proof or credentials', async () => {
  const review = createDiscordDeliveryReviewRepository(db);
  expect((await review.list('9223372036854775807')).items[0].canVerify).toBe(true);
  await getPool().query('UPDATE discord_notification_deliveries SET correlation_version = NULL');
  expect((await review.list('9223372036854775807')).items[0].canVerify).toBe(false);
});
test('uses the uniquely typed saved configuration rather than assuming its numeric ID', async () => {
  await getPool().query('UPDATE notification_config SET id = 77');
  const admitted = await repository.admit(id);
  expect(admitted.code).toBe('admitted');
  expect(admitted.config.id).toBe(77);
  expect(await deliveries.complete({ ...proof(admitted.receipt), verificationConfig: admitted.config })).toBe(true);
});
test('competing processes admit one read and restart retains the cooldown', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => createDiscordDeliveryVerificationRepository(db).admit(id)));
  expect(results.filter(result => result.code === 'admitted')).toHaveLength(1);
  expect(results.filter(result => result.code === 'cooldown')).toHaveLength(7);
  expect((await repository.admit(id)).retryAfterSeconds).toBeGreaterThan(0);
  expect((await guard()).outcome).toBe('started');
  // Fixture time change proves expiry admission, not elapsed-time deployment evidence.
  await getPool().query("UPDATE discord_delivery_verification_guard SET next_allowed_at = now() - interval '1 second'");
  expect((await repository.admit(id)).code).toBe('admitted');
});
test('provider deferral survives restart, cannot shorten, and malformed delay pauses', async () => {
  const admitted = await repository.admit(id);
  await repository.finish(admitted.operationId, 'rate_limited', 3600);
  expect((await createDiscordDeliveryVerificationRepository(db).admit(id)).retryAfterSeconds).toBeGreaterThan(3500);
  const previous = (await guard()).deadline;
  await repository.finish(admitted.operationId, 'provider_unavailable', 60);
  expect((await guard()).deadline).toBe(previous);
  await repository.finish(admitted.operationId, 'rate_limited', null);
  expect((await guard()).deadline).toBe('infinity');
  expect(await repository.admit(id)).toEqual({ code: 'verification_paused', retryAfterSeconds: null });
});
test('stale operation cannot overwrite a newer guard outcome or cooldown', async () => {
  const first = await repository.admit(id);
  await getPool().query("UPDATE discord_delivery_verification_guard SET next_allowed_at = now() - interval '1 second'");
  const second = await repository.admit(id);
  await repository.finish(first.operationId, 'rate_limited', null);
  expect((await guard()).operation_id).toBe(second.operationId);
  expect((await guard()).outcome).toBe('started');
  expect((await guard()).deadline).not.toBe('infinity');
});
test.each(["enabled = false", "bot_token = 'rotated'", "channel_id = '444444444444444444'",
  "updated_at = updated_at + interval '1 microsecond'"] )('completion fences in-flight configuration drift: %s', async change => {
  const admitted = await repository.admit(id);
  await getPool().query(`UPDATE notification_config SET ${change}`);
  expect(await deliveries.complete({ ...proof(admitted.receipt), verificationConfig: admitted.config })).toBe(false);
  expect((await receipt()).state).toBe('uncertain');
});
test('confirmed proof shares idempotent completion and preserves a newer decision', async () => {
  const read = jest.fn(async input => ({ code: 'verified', proof: proof(input.receipt) }));
  const verify = createDiscordDeliveryVerificationService({ repository, deliveries, read });
  await getPool().query("UPDATE classification_history SET status = 'verified', clarification_status = 'resolved' WHERE id = $1", [id]);
  expect(await verify(id, messageId)).toEqual({ code: 'confirmed', messageId });
  expect((await receipt()).state).toBe('delivered');
  expect((await guard()).outcome).toBe('confirmed');
  expect(await verify(id, messageId)).toEqual({ code: 'confirmed', messageId });
  expect(read).toHaveBeenCalledTimes(1);
  const { rows: [history] } = await getPool().query('SELECT status, clarification_status, discord_message_id FROM classification_history WHERE id = $1', [id]);
  expect(history).toEqual({ status: 'verified', clarification_status: 'resolved', discord_message_id: messageId });
});
test('conflicting passive evidence wins without overwriting its message ID', async () => {
  const admitted = await repository.admit(id);
  await deliveries.complete({ ...proof(admitted.receipt), messageId: '444444444444444444' });
  expect(await deliveries.complete({ ...proof(admitted.receipt), verificationConfig: admitted.config })).toBe(false);
  expect((await receipt()).message_id).toBe('444444444444444444');
});
test('network work occurs after admission commits and a negative read leaves receipt unchanged', async () => {
  const before = await receipt();
  const read = jest.fn(async () => {
    const observer = await getPool().connect();
    try {
      await observer.query('BEGIN');
      await observer.query("SET LOCAL lock_timeout = '100ms'");
      await observer.query('SELECT * FROM discord_delivery_verification_guard FOR UPDATE NOWAIT');
    } finally { await observer.query('ROLLBACK'); observer.release(); }
    return { code: 'message_unavailable' };
  });
  const verify = createDiscordDeliveryVerificationService({ repository, deliveries, read });
  expect(await verify(id, messageId)).toEqual({ code: 'message_unavailable' });
  expect(await receipt()).toEqual(before);
  expect((await guard()).outcome).toBe('message_unavailable');
});
test('guard table cannot grow beyond one row or accept arbitrary outcomes', async () => {
  const admission = await repository.admit(id);
  await expect(repository.finish(admission.operationId, 'private-provider-response')).rejects.toMatchObject({ code: '23514' });
  await expect(getPool().query(`INSERT INTO discord_delivery_verification_guard
    SELECT false, operation_id, classification_id, next_allowed_at, outcome, updated_at FROM discord_delivery_verification_guard`))
    .rejects.toMatchObject({ code: '23514' });
  expect((await getPool().query('SELECT count(*)::integer AS count FROM discord_delivery_verification_guard')).rows[0].count).toBe(1);
});
