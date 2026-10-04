/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const connection = { query: jest.fn() };
const db = { withTransaction: jest.fn(fn => fn(connection)) };
const bot = { isInitialized: false, client: null };
const delivery = { send: jest.fn() };
const outbox = { cleanup: jest.fn().mockResolvedValue(0), candidates: jest.fn().mockResolvedValue([]), discard: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => db);
jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', bot));
jest.unstable_mockModule('../services/discordDelivery.mjs', () => createNamedMockModule('discordDelivery', delivery));
jest.unstable_mockModule('../services/discordDeliveryOutbox.mjs', () => ({ createDiscordDeliveryOutbox: () => outbox }));
const { createRuntimeDiscordDispatcher } = await import('../services/discordDeliveryDispatchRuntime.mjs');
const { registerDiscordDeliveryDispatchSchedule } = await import('../services/discordDeliveryDispatchScheduler.mjs');

beforeEach(() => {
  db.withTransaction.mockReset().mockImplementation(fn => fn(connection));
  outbox.cleanup.mockReset().mockResolvedValue(0);
  outbox.candidates.mockReset().mockResolvedValue([]);
  outbox.discard.mockReset(); delivery.send.mockReset();
  bot.isInitialized = false; bot.client = null;
  connection.query.mockReset().mockResolvedValue({ rows: [] });
});
test('runtime does not initialize a fresh or disconnected bot', async () => {
  await createRuntimeDiscordDispatcher().run(); expect(db.withTransaction).not.toHaveBeenCalled();
  bot.isInitialized = true; bot.client = { isReady: () => false };
  await createRuntimeDiscordDispatcher().run(); expect(db.withTransaction).not.toHaveBeenCalled();
});
test('ready bot loads current configuration in a bounded transaction', async () => {
  bot.isInitialized = true; bot.client = { isReady: () => true };
  connection.query.mockResolvedValue({ rows: [{ id: 1, enabled: true }] });
  await createRuntimeDiscordDispatcher().run();
  expect(connection.query).toHaveBeenCalledWith("SET LOCAL statement_timeout = '5s'");
  expect(connection.query).toHaveBeenCalledWith("SET LOCAL lock_timeout = '2s'");
  expect(outbox.candidates).toHaveBeenCalledTimes(1);
});
test('missing configuration remains idle', async () => {
  bot.isInitialized = true; bot.client = { isReady: () => true };
  await createRuntimeDiscordDispatcher().run(); expect(outbox.candidates).not.toHaveBeenCalled();
});
test('registration stops old worker, adds one nonoverlapping minute task and sanitizes failures', async () => {
  const old = { stop: jest.fn() }; const worker = { run: jest.fn().mockResolvedValue({ status: 'complete' }) };
  const scheduler = { discordDeliveryDispatchWorker: old, schedule: jest.fn() };
  registerDiscordDeliveryDispatchSchedule(scheduler, { worker });
  expect(old.stop).toHaveBeenCalledTimes(1);
  expect(scheduler.discordDeliveryDispatchWorker).toBe(worker);
  expect(scheduler.schedule).toHaveBeenCalledWith('discord-deferred-delivery', '* * * * *', expect.any(Function), null, { noOverlap: true, quiet: true });
  const run = scheduler.schedule.mock.calls[0][2];
  expect(await run()).toEqual({ status: 'complete' });
  worker.run.mockResolvedValue({ status: 'failed' });
  await expect(run()).rejects.toThrow('discord_deferred_delivery_unavailable');
});
test('default registered worker can be stopped before first run', async () => {
  const scheduler = { schedule: jest.fn(), discordDeliveryDispatchWorker: undefined };
  registerDiscordDeliveryDispatchSchedule(scheduler);
  scheduler.discordDeliveryDispatchWorker.stop();
  expect(await scheduler.schedule.mock.calls[0][2]()).toEqual({ status: 'skipped' });
});
