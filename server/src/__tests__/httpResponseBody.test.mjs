/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { readBoundedResponseBody, parseHttpResponseBody } from '../utils/httpResponseBody.mjs';

function streamed(chunks, headers = {}, cancel = jest.fn()) {
  let index = 0;
  const pull = jest.fn(controller => {
    if (index === chunks.length) controller.close();
    else controller.enqueue(chunks[index++]);
  });
  const response = new Response(new ReadableStream({ pull, cancel }, { highWaterMark: 0 }), { headers });
  return { response, pull, cancel };
}

test.each([undefined, null, -1, 1.5, NaN, Infinity, '10', Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid explicit budget %# before locking a body', async budget => {
    const { response } = streamed([]);
    await expect(readBoundedResponseBody(response, budget)).rejects.toThrow('nonnegative safe integer');
    expect(response.body.locked).toBe(false);
  });

test.each([{}, { 'Content-Length': '1' }, { 'Content-Length': '999999999' }, { 'Content-Length': 'garbage' }])(
  'enforces actual bytes independently of declared length %#', async headers => {
    const { response, cancel, pull } = streamed([Buffer.from('1234'), Buffer.from('56'), Buffer.from('unused')], headers);
    await expect(readBoundedResponseBody(response, 5)).rejects.toMatchObject({
      name: 'HttpResponseTooLargeError', code: 'HTTP_RESPONSE_TOO_LARGE', maxBytes: 5,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(response.body.locked).toBe(false);
  });

test('accepts an exact boundary without cancelling and exposes no unused buffer bytes', async () => {
  const { response, cancel } = streamed([Buffer.from('12'), Buffer.from('345')], { 'Content-Length': '999999999' });
  const result = await readBoundedResponseBody(response, 5);
  expect(result).toEqual(Buffer.from('12345'));
  expect(cancel).not.toHaveBeenCalled();
  expect(response.body.locked).toBe(false);
});

test('handles an empty body and a zero budget without accepting nonempty content', async () => {
  expect(await readBoundedResponseBody(new Response(null, { status: 204 }), 0)).toEqual(Buffer.alloc(0));
  expect(await readBoundedResponseBody(new Response(''), 0)).toEqual(Buffer.alloc(0));
  await expect(readBoundedResponseBody(new Response('x'), 0)).rejects.toMatchObject({ code: 'HTTP_RESPONSE_TOO_LARGE' });
});

test('does not retain an oversized first chunk, headers or URL in the failure', async () => {
  const { response, pull } = streamed([Buffer.from('private-fixture-key'), Buffer.from('unused')], { 'X-Key': 'private-fixture-key' });
  let failure;
  try { await readBoundedResponseBody(response, 2); } catch (error) { failure = error; }
  expect(failure.code).toBe('HTTP_RESPONSE_TOO_LARGE');
  expect(JSON.stringify(failure)).not.toContain('private-fixture-key');
  expect(failure.message).not.toContain('private-fixture-key');
  expect(pull).toHaveBeenCalledTimes(1);
});

test('cleanup rejection preserves the primary size error and releases the lock', async () => {
  const cancel = jest.fn().mockRejectedValue(new Error('private cleanup detail'));
  const { response } = streamed([Buffer.from('too big')], {}, cancel);
  await expect(readBoundedResponseBody(response, 1)).rejects.toMatchObject({ code: 'HTTP_RESPONSE_TOO_LARGE' });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(response.body.locked).toBe(false);
});

test('propagates stream failures and unlocks without treating partial JSON as malformed JSON', async () => {
  let controller;
  const response = new Response(new ReadableStream({ start(value) { controller = value; } }), {
    headers: { 'Content-Type': 'application/json' },
  });
  const pending = parseHttpResponseBody(response, 100);
  const error = new Error('transport interrupted');
  controller.enqueue(Buffer.from('{'));
  controller.error(error);
  await expect(pending).rejects.toBe(error);
  expect(response.body.locked).toBe(false);
});

test('assembles many tiny chunks without losing bytes', async () => {
  const { response } = streamed(Array.from({ length: 40000 }, () => Uint8Array.of(97)));
  const result = await readBoundedResponseBody(response, 40000);
  expect(result).toEqual(Buffer.alloc(40000, 97));
});

test('counts UTF-8 bytes before decoding split multibyte JSON and strips the UTF-8 BOM', async () => {
  const body = Buffer.from('\uFEFF{"title":"雪🎬"}');
  const make = () => streamed(Array.from(body, byte => Uint8Array.of(byte)), { 'Content-Type': 'application/json' }).response;
  expect(await parseHttpResponseBody(make(), body.length)).toEqual({ title: '雪🎬' });
  await expect(parseHttpResponseBody(make(), body.length - 1)).rejects.toMatchObject({ code: 'HTTP_RESPONSE_TOO_LARGE' });
});

test.each([undefined, 100])('retains malformed-JSON and plain-text behavior with budget %s', async budget => {
  expect(await parseHttpResponseBody(new Response('{broken', { headers: { 'Content-Type': 'application/json' } }), budget)).toBeNull();
  expect(await parseHttpResponseBody(new Response('plain text'), budget)).toBe('plain text');
  expect(await parseHttpResponseBody(new Response(''), budget)).toBe('');
});

test('unbudgeted JSON transport failures are not swallowed as syntax errors', async () => {
  const error = new DOMException('deadline', 'TimeoutError');
  const response = { headers: new Headers({ 'Content-Type': 'application/json' }), text: jest.fn().mockRejectedValue(error) };
  await expect(parseHttpResponseBody(response)).rejects.toBe(error);
});
