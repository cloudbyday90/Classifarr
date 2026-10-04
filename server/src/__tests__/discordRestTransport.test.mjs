/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { getEventListeners } from 'node:events';
import { createDiscordRestTransport } from '../services/discordRestTransport.mjs';

afterEach(() => jest.useRealTimers());

describe('Discord response transport limits and lifecycle', () => {
  test.each([
    { timeoutMs: 0 }, { timeoutMs: 2147482648 }, { timeoutMs: NaN },
    { maxBytes: -1 }, { maxBytes: Infinity }, { maxConcurrent: 0 }, { maxConcurrent: 1.5 },
  ])('rejects invalid bounds %j', options => {
    expect(() => createDiscordRestTransport(options)).toThrow(TypeError);
  });

  test('idle transport is lazy, preserves SDK inputs and clears listeners/timers after success', async () => {
    jest.useFakeTimers();
    const request = jest.fn(async () => new Response('abcd', { status: 201, headers: { 'x-ratelimit-bucket': 'fixture' } }));
    const transport = createDiscordRestTransport({ request, maxBytes: 4 });
    const controller = new AbortController();
    expect(request).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    const response = await transport.makeRequest('https://discord.invalid', {
      method: 'POST', body: 'fixture', signal: controller.signal, headers: { authorization: 'synthetic' },
    });
    expect(request).toHaveBeenCalledWith('https://discord.invalid', expect.objectContaining({
      method: 'POST', body: 'fixture', headers: { authorization: 'synthetic' },
    }));
    expect(response.status).toBe(201);
    expect(response.headers.get('x-ratelimit-bucket')).toBe('fixture');
    expect(response.bodyUsed).toBe(false);
    expect(await response.text()).toBe('abcd');
    expect(response.bodyUsed).toBe(true);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
    transport.close();
  });

  test('caps active attempts without queuing or sending excess work; close is permanent', async () => {
    jest.useFakeTimers();
    const request = jest.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const transport = createDiscordRestTransport({ request, maxConcurrent: 1 });
    const pending = expect(transport.makeRequest('https://discord.invalid', {})).rejects.toMatchObject({ code: 'DISCORD_TRANSPORT_CLOSED' });
    await expect(transport.makeRequest('https://discord.invalid', {})).rejects.toMatchObject({ code: 'DISCORD_TRANSPORT_BUSY' });
    expect(request).toHaveBeenCalledTimes(1);
    transport.close();
    transport.close();
    await pending;
    await expect(transport.makeRequest('https://discord.invalid', {})).rejects.toMatchObject({ code: 'DISCORD_TRANSPORT_CLOSED' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('timeout aborts actual I/O and releases the slot', async () => {
    jest.useFakeTimers();
    let signal;
    const request = jest.fn((_url, init) => {
      signal = init.signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    const transport = createDiscordRestTransport({ request, timeoutMs: 50, maxConcurrent: 1 });
    const pending = expect(transport.makeRequest('https://discord.invalid', {})).rejects.toMatchObject({ code: 'DISCORD_REQUEST_TIMEOUT' });
    await jest.advanceTimersByTimeAsync(50);
    await pending;
    expect(signal.aborted).toBe(true);
    request.mockResolvedValueOnce(new Response('ok'));
    expect(await (await transport.makeRequest('https://discord.invalid', {})).text()).toBe('ok');
    expect(jest.getTimerCount()).toBe(0);
    transport.close();
  });

  test.each(['ECONNRESET', 'OTHER', undefined])('sanitizes pre-header failures, retaining only retry code %s', async code => {
    jest.useFakeTimers();
    const controller = new AbortController();
    const request = jest.fn(async () => { throw Object.assign(new Error('private URL and token'), { code }); });
    const transport = createDiscordRestTransport({ request });
    const result = await transport.makeRequest('https://discord.invalid', { signal: controller.signal }).catch(error => error);
    expect(result.code).toBe(code === 'ECONNRESET' ? 'ECONNRESET' : 'DISCORD_TRANSPORT_FAILED');
    expect(result.message).toBe('Discord transport request failed');
    expect(result.cause).toBeUndefined();
    expect(result.stack).not.toContain('private');
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
    transport.close();
  });

  test('a post-header ECONNRESET must not become SDK-retryable after moving body I/O into the adapter', async () => {
    const request = jest.fn(async () => ({
      headers: new Headers(), status: 200, statusText: 'OK',
      body: new ReadableStream({ start(controller) { controller.error(Object.assign(new Error('private'), { code: 'ECONNRESET' })); } }),
    }));
    const transport = createDiscordRestTransport({ request });
    await expect(transport.makeRequest('https://discord.invalid', {})).rejects.toMatchObject({ code: 'DISCORD_TRANSPORT_FAILED' });
    transport.close();
  });

  test('a pre-aborted request never calls the SDK adapter', async () => {
    const request = jest.fn();
    const transport = createDiscordRestTransport({ request });
    await expect(transport.makeRequest('https://discord.invalid', { signal: AbortSignal.abort('private') })).rejects.toMatchObject({
      code: 'DISCORD_REQUEST_CANCELLED', message: 'Discord request cancelled',
    });
    expect(request).not.toHaveBeenCalled();
    transport.close();
  });

  test('overflow cancels the reader and sanitizes failure', async () => {
    const cancel = jest.fn();
    const request = jest.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(5)); }, cancel,
    })));
    const transport = createDiscordRestTransport({ request, maxBytes: 4 });
    await expect(transport.makeRequest('https://discord.invalid', {})).rejects.toMatchObject({ code: 'DISCORD_RESPONSE_TOO_LARGE' });
    expect(cancel).toHaveBeenCalledTimes(1);
    transport.close();
  });
});
