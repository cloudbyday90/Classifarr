/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';

const destroy = jest.fn();
const undiciFetch = jest.fn();
const Agent = jest.fn(function (options) { this.options = options; this.destroy = destroy; });
jest.unstable_mockModule('undici', () => ({ Agent, fetch: undiciFetch }));
const { withBufferedHttpTransport } = await import('../utils/httpClientTransport.mjs');

beforeEach(() => {
  destroy.mockReset().mockResolvedValue(undefined);
  undiciFetch.mockReset();
  Agent.mockReset().mockImplementation(function (options) { this.options = options; this.destroy = destroy; });
});

test.each([true, undefined, null, 0, 'false'])('keeps native TLS verification unless explicitly disabled: %s', async value => {
  const consume = jest.fn().mockResolvedValue('body');
  await expect(withBufferedHttpTransport(value, consume)).resolves.toBe('body');
  expect(consume).toHaveBeenCalledWith(globalThis.fetch);
  expect(Agent).not.toHaveBeenCalled();
});

test('pairs package fetch with its Agent and disposes only after the response is consumed', async () => {
  await expect(withBufferedHttpTransport(false, async (fetchRequest, dispatcher) => {
    expect(fetchRequest).toBe(undiciFetch);
    expect(dispatcher.options).toEqual({ connect: { rejectUnauthorized: false } });
    expect(destroy).not.toHaveBeenCalled();
    return 'consumed body';
  })).resolves.toBe('consumed body');
  expect(Agent).toHaveBeenCalledTimes(1);
  expect(destroy).toHaveBeenCalledTimes(1);
});

test('disposes the custom Agent when reading the response fails', async () => {
  const error = new Error('body failed');
  await expect(withBufferedHttpTransport(false, async () => { throw error; })).rejects.toBe(error);
  expect(destroy).toHaveBeenCalledTimes(1);
});
