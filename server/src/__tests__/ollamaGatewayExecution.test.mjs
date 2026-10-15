/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach } from '@jest/globals';

const upstream = jest.fn();
jest.unstable_mockModule('../ollamaGateway/transport.mjs', () => ({ gatewayUpstream: upstream }));
const { executeGatewayCompute } = await import('../ollamaGateway/execution.mjs');
let controller, ledger, input;
beforeEach(() => {
  upstream.mockReset(); controller = new AbortController();
  ledger = { claim: jest.fn().mockResolvedValue('request-1'),complete: jest.fn().mockResolvedValue(undefined) };
  input = { ledger,installation: 'fixture',config: {},path: '/api/generate',
    body: { model: 'synthetic:latest',prompt: 'fixture',stream: false },signal: controller.signal,onRecord: jest.fn() };
});

test('already cancelled work never claims or dispatches', async () => {
  controller.abort(); await expect(executeGatewayCompute(input)).rejects.toThrow();
  expect(ledger.claim).not.toHaveBeenCalled(); expect(upstream).not.toHaveBeenCalled();
});

test('cancellation during claim completes only that undispatched attempt', async () => {
  ledger.claim.mockImplementation(async () => { controller.abort(); return 'request-1'; });
  await expect(executeGatewayCompute(input)).rejects.toThrow();
  expect(ledger.complete).toHaveBeenCalledTimes(1); expect(ledger.complete).toHaveBeenCalledWith('request-1',false,{ state: 'not_dispatched',httpStatus: null });
  expect(upstream).not.toHaveBeenCalled();
});

test('a failed claim may have committed and is not cleaned up or retried', async () => {
  ledger.claim.mockRejectedValue(new Error('gateway_ledger_unavailable'));
  await expect(executeGatewayCompute(input)).rejects.toThrow('gateway_ledger_unavailable');
  expect(ledger.claim).toHaveBeenCalledTimes(1); expect(ledger.complete).not.toHaveBeenCalled(); expect(upstream).not.toHaveBeenCalled();
});

test.each([200,400,401,403,404,429,503])('late cancellation preserves known completion and cooldown policy for %s', async status => {
  upstream.mockImplementation(async () => { controller.abort(); return { status,rejected: status !== 200,data: { done: true } }; });
  await expect(executeGatewayCompute(input)).rejects.toThrow();
  expect(ledger.complete).toHaveBeenCalledTimes(1); expect(ledger.complete).toHaveBeenCalledWith('request-1',[429,503].includes(status),
    { state: status === 200 ? 'response_completed' : 'provider_rejected',httpStatus: status });
  expect(upstream).toHaveBeenCalledTimes(1); expect(ledger.claim).toHaveBeenCalledTimes(1);
});

test('completion is persisted before any result is returned', async () => {
  const result = { status: 200,data: { done: true } };
  upstream.mockResolvedValue(result);
  let finish; ledger.complete.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  let returned = false; const pending = executeGatewayCompute(input).then(value => { returned = true; return value; });
  await new Promise(resolve => { setImmediate(resolve); });
  expect(returned).toBe(false); finish(); expect(await pending).toBe(result);
});

test.each(['gateway_upstream_unknown','gateway_response_invalid','gateway_cancelled'])('%s never clears a dispatched claim', async code => {
  upstream.mockRejectedValue(new Error(code)); await expect(executeGatewayCompute(input)).rejects.toThrow(code);
  expect(ledger.complete).not.toHaveBeenCalled(); expect(upstream).toHaveBeenCalledTimes(1);
});

test.each(['before_dispatch','after_response'])('failed completion is not retried (%s)', async stage => {
  if (stage === 'before_dispatch') ledger.claim.mockImplementation(async () => { controller.abort(); return 'request-1'; });
  else upstream.mockResolvedValue({ status: 200 });
  ledger.complete.mockRejectedValue(new Error('gateway_ledger_unavailable'));
  await expect(executeGatewayCompute(input)).rejects.toThrow('gateway_ledger_unavailable');
  expect(ledger.complete).toHaveBeenCalledTimes(1); expect(upstream).toHaveBeenCalledTimes(stage === 'before_dispatch' ? 0 : 1);
});
