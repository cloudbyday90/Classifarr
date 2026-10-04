/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { bindDiscordSdkRequestBudget } from '../services/discordSdkRequestBudget.mjs';

test('capacity bounds outstanding queued requests and releases on settlement', async () => {
  const pending = Promise.withResolvers(); const request = jest.fn(() => pending.promise); const rest = { request };
  bindDiscordSdkRequestBudget(rest, new AbortController().signal, { maxConcurrent: 1 });
  const first = rest.request({}); await expect(rest.request({})).rejects.toMatchObject({ code: 'DISCORD_REST_BUSY' });
  pending.resolve('proof'); expect(await first).toBe('proof'); expect(await rest.request({})).toBe('proof');
});
test.each(['caller', 'lifetime', 'deadline'])('%s cancels the actual SDK request', async cause => {
  const caller = new AbortController(); const lifetime = new AbortController(); let seen;
  const rest = { request: ({ signal }) => new Promise((resolve, reject) => {
    seen = signal; signal.addEventListener('abort', () => reject(new Error('private abort reason')), { once: true });
  }) };
  bindDiscordSdkRequestBudget(rest, lifetime.signal, { timeoutMs: 20 });
  const result = rest.request({ signal: caller.signal });
  if (cause === 'caller') caller.abort(); if (cause === 'lifetime') lifetime.abort();
  await expect(result).rejects.toMatchObject({ code: cause === 'deadline' ? 'DISCORD_REST_DEADLINE' : 'DISCORD_REST_CANCELLED' });
  expect(seen.aborted).toBe(true);
});
test('pre-aborted callers and invalid limits do not enter SDK', async () => {
  const request = jest.fn(); const rest = { request };
  expect(() => bindDiscordSdkRequestBudget(rest, AbortSignal.abort(), { timeoutMs: 2 ** 31 })).toThrow(TypeError);
  bindDiscordSdkRequestBudget(rest, AbortSignal.abort());
  await expect(rest.request({})).rejects.toMatchObject({ code: 'DISCORD_REST_CANCELLED' });
  expect(request).not.toHaveBeenCalled();
});
test('success is not discarded when cancellation arrives during result settlement', async () => {
  const caller = new AbortController(); const rest = { request: async () => { caller.abort(); return 'proof'; } };
  bindDiscordSdkRequestBudget(rest, new AbortController().signal);
  expect(await rest.request({ signal: caller.signal })).toBe('proof');
});
