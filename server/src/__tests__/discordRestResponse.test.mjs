/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { Readable } from 'node:stream';
import { bufferDiscordResponse } from '../services/discordRestResponse.mjs';

test('converts Node bodies with byte-based backpressure and preserves JSON/status/headers', async () => {
  const response = await bufferDiscordResponse({
    body: Readable.from([Buffer.from('{"ok":true}')]), headers: new Headers({ 'content-length': '11' }),
    status: 200, statusText: 'OK',
  }, 11);
  expect(response.statusText).toBe('OK');
  expect(response.ok).toBe(true);
  expect(response.headers.get('content-length')).toBe('11');
  expect(await response.json()).toEqual({ ok: true });
});

test.each([204, 205, 304])('preserves null-body status %s', async status => {
  const response = await bufferDiscordResponse(new Response(null, { status }), 10);
  expect(response.status).toBe(status);
  expect(response.body).toBeNull();
  expect((await response.arrayBuffer()).byteLength).toBe(0);
});

test('declared overflow cancels without starting an unbounded body read', async () => {
  const cancel = jest.fn();
  const body = new ReadableStream({ cancel });
  await expect(bufferDiscordResponse(new Response(body, { headers: { 'content-length': '99999' } }), 10))
    .rejects.toMatchObject({ code: 'HTTP_RESPONSE_TOO_LARGE' });
  expect(cancel).toHaveBeenCalledTimes(1);
});

test('invalid JSON errors contain no provider body or nested cause', async () => {
  const response = await bufferDiscordResponse(new Response('private-provider-content'), 30);
  const error = await response.json().catch(result => result);
  expect(error.code).toBe('DISCORD_RESPONSE_INVALID');
  expect(error.message).toBe('Discord returned invalid JSON');
  expect(error.stack).not.toContain('private-provider-content');
  expect(error.cause).toBeUndefined();
});
