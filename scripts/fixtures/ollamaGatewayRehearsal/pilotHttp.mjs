/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

export async function request(path, { session, body, method = body === undefined ? 'GET' : 'POST' } = {}) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
  assert.ok(path.startsWith('/api/'));
  const response = await fetch(`http://127.0.0.1:21324${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', ...session },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length; assert.ok(bytes <= 65536, 'pilot_response_limit'); chunks.push(chunk);
  }
  return { status: response.status, body: JSON.parse(Buffer.concat(chunks).toString()),
    cookies: response.headers.getSetCookie(), cache: response.headers.get('cache-control') };
}

export function sessionFrom(response) {
  assert.equal(response.status, 200, 'pilot_login_failed');
  const cookies = response.cookies.map(value => value.split(';')[0]);
  const csrf = cookies.find(value => value.startsWith('classifarr_csrf_token='))?.split('=')[1];
  assert.ok(csrf && cookies.some(value => value.startsWith('access_token=')), 'pilot_session_missing');
  return { cookie: cookies.join('; '), 'x-csrf-token': csrf };
}
