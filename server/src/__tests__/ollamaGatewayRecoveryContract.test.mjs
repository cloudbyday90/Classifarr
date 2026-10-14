/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { gatewayRecoveryConfiguration, gatewayRecoveryReview } from '../ollamaGateway/recoveryContract.mjs';

const id = '0199d721-1111-7000-8000-000000000001';
const document = () => ({ version: 1,action: 'acknowledge-stop',operatorRef: 'operator-1',evidenceRef: 'ticket-1',
  observedAt: '2026-10-14T22:00:00.000Z',assertions: { ingressIsolated: true,allProviderRunnersStopped: true,
    automaticRestartDisabled: true,administratorVerified: true },
  expected: { ledgerId: id,ownerId: id,requestId: id,providerHash: 'a'.repeat(64),attempts: '1',maintenanceReceipt: null } });
test('accepts an exact time-based review without upgrading its evidence', () => {
  const value = document(); expect(gatewayRecoveryReview(value,'acknowledge-stop')).toBe(value);
});
test.each([
  value => { value.version = 2; }, value => { value.extra = 'secret'; },
  value => { value.operatorRef = 'operator@example.com'; }, value => { value.evidenceRef = 'https://secret'; },
  value => { value.assertions.allProviderRunnersStopped = false; }, value => { value.assertions.ingressIsolated = 'true'; },
  value => { delete value.assertions.automaticRestartDisabled; }, value => { value.observedAt = '2026-02-30T22:00:00.000Z'; },
  value => { value.observedAt = '2026-10-14'; }, value => { value.expected.attempts = 1; },
  value => { value.expected.attempts = '9223372036854775808'; }, value => { value.expected.attempts = '01'; },
  value => { value.expected.requestId = id.replace('-7000','-4000'); }, value => { value.expected.maintenanceReceipt = id; },
  value => { value.expected.ownerId = null; }, value => { value.expected.extra = true; },
])('rejects malformed or incomplete review %#', mutate => {
  const value = document(); mutate(value); expect(() => gatewayRecoveryReview(value,'acknowledge-stop')).toThrow('gateway_recovery_review_invalid');
});
test('resume requires its own assertions and held receipt', () => {
  const value = document(); value.action = 'resume';
  expect(() => gatewayRecoveryReview(value,'resume')).toThrow();
  value.expected.requestId = null; value.expected.maintenanceReceipt = id;
  value.assertions = { providerIsolationMaintained: true,controlledRestartReviewed: true,noRequestReplay: true,administratorVerified: true };
  expect(gatewayRecoveryReview(value,'resume')).toBe(value);
});
test('recovery configuration uses separate database settings and a provider binding', () => {
  const value = { database: { host: '127.0.0.1',database: 'fixture',user: 'recovery' },providerHash: 'b'.repeat(64) };
  expect(gatewayRecoveryConfiguration(value)).toEqual(value);
  expect(() => gatewayRecoveryConfiguration({ ...value,gateway: {} })).toThrow();
  expect(() => gatewayRecoveryConfiguration({ ...value,database: { ...value.database,host: '192.168.1.1' } })).toThrow();
});
