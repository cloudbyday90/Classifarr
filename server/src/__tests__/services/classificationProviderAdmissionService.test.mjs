/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createMockLogger } from '../helpers/mockFactory.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => ({ query: jest.fn() }));
jest.unstable_mockModule('../../services/aiRouter.mjs', () => ({ aiRouterService: {} }));
const { ClassificationProviderAdmissionService } = await import('../../services/classificationProviderAdmissionService.mjs');
const { isProviderDeferredError } = await import('../../services/classificationProviderDeferralPolicy.mjs');
const config = { configuration_revision: '2' };
const provider = { type: 'custom', config: { model: 'test' } };
const ticket = { key: 'a'.repeat(64), epoch: 1 };
let repository, configuration, logger, service;
beforeEach(() => {
  repository = { admit: jest.fn().mockResolvedValue(ticket), open: jest.fn().mockResolvedValue(true), close: jest.fn().mockResolvedValue(true) };
  configuration = { loadConfiguration: jest.fn().mockResolvedValue({ config }) };
  logger = createMockLogger();
  service = new ClassificationProviderAdmissionService({ repository, configuration, logger });
});
test('unversioned legacy configuration keeps existing bounded behavior', async () => {
  expect(await service.admit({}, provider)).toBeNull();
  expect(repository.admit).not.toHaveBeenCalled();
});
test('admits a versioned provider with an opaque dependency identity', async () => {
  expect(await service.admit(config, provider)).toBe(ticket);
  expect(repository.admit).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
});
test('missing model identity preserves finite configuration-error handling', async () => {
  expect(await service.admit(config, { type: 'custom', config: {} })).toBeNull();
  expect(repository.admit).not.toHaveBeenCalled();
});

test.each(['changed', 'open', 'database'])('defers without provider work when %s', async state => {
  if (state === 'changed') configuration.loadConfiguration.mockResolvedValue({ config: { configuration_revision: 3 } });
  if (state === 'open') repository.admit.mockResolvedValue(null);
  if (state === 'database') configuration.loadConfiguration.mockRejectedValue(new Error('private server body'));
  try { await service.admit(config, provider); throw new Error('Expected deferral'); }
  catch (error) { expect(isProviderDeferredError(error)).toBe(true); }
});
test.each([null, { code: 'ERR_CANCELED' }, { code: 'EINCOMPLETE' }, { response: { status: 401 } }, { message: 'timeout' }])('does not open from item/permanent failures %#', async error => {
  expect(await service.failed(ticket, error)).toBe(false);
  expect(repository.open).not.toHaveBeenCalled();
});
test('only structured dependency failures open the shared circuit', async () => {
  expect(await service.failed(ticket, { code: 'ECONNREFUSED' })).toBe(true);
  expect(repository.open).toHaveBeenCalledWith(ticket, 'ai_connection_error');
  repository.open.mockResolvedValue(false);
  expect(await service.failed(ticket, { response: { status: 503 } })).toBe(true);
  expect(await service.failed(null, { code: 'ETIMEDOUT' })).toBe(false);
});
test('contains state-write failures without logging provider bodies', async () => {
  repository.open.mockRejectedValue(new Error('private'));
  expect(await service.failed(ticket, { code: 'ETIMEDOUT' })).toBe(false);
  repository.close.mockRejectedValue(new Error('private'));
  await expect(service.succeeded(ticket)).resolves.toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(expect.any(String), { reasonCode: 'provider_admission_state_unavailable' }, expect.any(Object));
});
test('records recovery transitions without logging every healthy generation', async () => {
  await service.succeeded(null);
  expect(repository.close).not.toHaveBeenCalled();
  await service.succeeded(ticket);
  expect(logger.info).toHaveBeenCalledTimes(1);
  repository.close.mockResolvedValue(false);
  await service.succeeded(ticket);
  expect(logger.info).toHaveBeenCalledTimes(1);
});
test('resolves the current provider from fresh configuration and fails closed on lookup errors', async () => {
  service.router = { getProvider: jest.fn().mockResolvedValue(provider) };
  expect(await service.getCurrentDependencyKey()).toMatch(/^[a-f0-9]{64}$/);
  expect(service.router.getProvider).toHaveBeenCalledWith('classification', { configuration: config });
  service.router.getProvider.mockResolvedValue(null);
  expect(await service.getCurrentDependencyKey()).toBe('');
  service.router.getProvider.mockRejectedValue(new Error('private'));
  expect(await service.getCurrentDependencyKey()).toBeNull();
});
