/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

const directory = '/app/data/routing-rehearsal';
const files = new Set(['fixture', 'control', 'requests']);
export function assertFixtureEnvironment(env = process.env) {
  assert.equal(env.CLASSIFARR_ROUTING_REHEARSAL, 'disposable-v1');
  for (const [key, value] of Object.entries({ POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432',
    POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr' })) assert.equal(env[key], value);
}
export function readFixtureFile(name) {
  assertFixtureEnvironment(); assert(files.has(name));
  return JSON.parse(readFileSync(`${directory}/${name}.json`, 'utf8'));
}
export function writeFixtureFile(name, value) {
  assertFixtureEnvironment(); assert(files.has(name));
  writeFileSync(`${directory}/${name}.tmp`, JSON.stringify(value), { mode: 0o600 });
  renameSync(`${directory}/${name}.tmp`, `${directory}/${name}.json`);
}
export async function request(path, { session, body, method = body === undefined ? 'GET' : 'POST' } = {}) {
  assert(path.startsWith('/api/'));
  const response = await fetch(`http://127.0.0.1:21324${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { 'content-type': 'application/json', ...session },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text(); assert(text.length < 64 * 1024, 'response_too_large');
  return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : null,
    cookies: response.headers.getSetCookie(),
    cache: response.headers.get('cache-control') };
}
export function sessionFrom(response) {
  assert.equal(response.status, 200, 'login_failed');
  const cookies = response.cookies.map(value => value.split(';')[0]);
  const csrf = cookies.find(value => value.startsWith('classifarr_csrf_token='))?.split('=')[1];
  assert(csrf && cookies.some(value => value.startsWith('access_token=')), 'session_missing');
  return { cookie: cookies.join('; '), 'x-csrf-token': csrf };
}
export const backgroundPath = id => `/api/queue/manual-routing/${id}/background`;
export const checkPath = id => `/api/queue/manual-routing/${id}/check`;
