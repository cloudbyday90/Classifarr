/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createMockLogger } from '../helpers/mockFactory.mjs';
jest.unstable_mockModule('../../services/classificationRetryService.mjs', () => ({ classificationRetryService: {} }));
jest.unstable_mockModule('../../services/automaticClassificationRecoveryRepository.mjs', () => ({ AutomaticClassificationRecoveryRepository: class {} }));
jest.unstable_mockModule('../../services/classificationRecoveryReadiness.mjs', () => ({ ClassificationRecoveryReadiness: class {} }));
const { AutomaticClassificationRecoveryService } = await import('../../services/automaticClassificationRecoveryService.mjs');
let repository, readiness, retryService, logger, service;
beforeEach(() => {
  repository = { findDue: jest.fn().mockResolvedValue([{ id: 7 }, { id: 8 }]),
    claimProbe: jest.fn().mockResolvedValue('lease'), loadConfiguration: jest.fn().mockResolvedValue({ fingerprint: 'fingerprint' }),
    checkReadiness: jest.fn().mockResolvedValue({ eligible: true }), completeProbe: jest.fn() };
  readiness = { probe: jest.fn().mockResolvedValue({ fingerprint: 'fingerprint', checkedAt: 123 }) };
  retryService = { retrySingle: jest.fn().mockResolvedValue({ queued: true }) };
  logger = createMockLogger();
  service = new AutomaticClassificationRecoveryService({ repository, readiness, retryService, logger });
});
test('idle queues do not probe or claim cooldown', async () => {
  repository.findDue.mockResolvedValue([]);
  expect(await service.run()).toEqual({ state: 'idle', queued: 0 });
  expect(repository.claimProbe).not.toHaveBeenCalled();
});
test('competing/restarted workers respect persisted cooldown', async () => {
  repository.claimProbe.mockResolvedValue(null);
  expect(await service.run()).toEqual({ state: 'cooldown', queued: 0 });
  expect(readiness.probe).not.toHaveBeenCalled();
});
test.each([null, 'throw'])('unavailable providers consume the probe interval but not job budget: %s', async (value) => {
  if (value === 'throw') readiness.probe.mockRejectedValue(new Error('secret provider body'));
  else readiness.probe.mockResolvedValue(null);
  expect(await service.run()).toEqual({ state: 'unavailable', queued: 0 });
  expect(retryService.retrySingle).not.toHaveBeenCalled();
  expect(repository.completeProbe).toHaveBeenCalledWith('lease', 'unavailable');
  expect(JSON.stringify(logger)).not.toContain('secret provider body');
});
test('queues through transactional retry with internal source and transaction-bound proof check', async () => {
  expect(await service.run()).toEqual({ state: 'ready', queued: 2 });
  const options = retryService.retrySingle.mock.calls[0][0];
  expect(options).toMatchObject({ classificationId: 7, actor: 'scheduler', taskSource: 'provider_recovery', correlationId: 'lease' });
  const client = {};
  const classification = { id: 7 };
  await options.retryEligibilityCheck({ client, classification });
  expect(repository.checkReadiness).toHaveBeenCalledWith(client, { fingerprint: 'fingerprint', checkedAt: 123 }, 'lease', classification);
});
test.each(['recovery_configuration_changed', 'recovery_readiness_expired', 'recovery_lease_expired'])('stops a batch when proof becomes invalid: %s', async (reasonCode) => {
  retryService.retrySingle.mockResolvedValue({ queued: false, reasonCode });
  const result = await service.run();
  expect(result.queued).toBe(0);
  expect(result.state).toBe(reasonCode === 'recovery_configuration_changed' ? 'configuration_changed' : 'ready');
  expect(retryService.retrySingle).toHaveBeenCalledTimes(1);
});
test('individual skips do not prevent other eligible jobs recovering', async () => {
  retryService.retrySingle.mockResolvedValueOnce({ skipped: true, reasonCode: 'duplicate_pending_task' });
  expect(await service.run()).toEqual({ state: 'ready', queued: 1 });
});
test.each(['findDue', 'claimProbe', 'loadConfiguration', 'completeProbe'])('contains database failure at %s', async (method) => {
  repository[method].mockRejectedValue(new Error('private database data'));
  expect(await service.run()).toEqual({ state: 'failed', queued: method === 'completeProbe' ? 2 : 0 });
  expect(logger.warn).toHaveBeenCalledWith(expect.any(String), { reasonCode: 'recovery_processing_failed' }, expect.any(Object));
});
