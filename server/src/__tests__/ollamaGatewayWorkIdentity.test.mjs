/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayConfig } from '../ollamaGateway/contract.mjs';
import { gatewayWorkKey,prepareGatewayWork,gatewayWorkHeaders } from '../ollamaGateway/workIdentity.mjs';
import { createGatewayCredentials } from '../ollamaGateway/credentials.mjs';

const key = Buffer.alloc(32,7).toString('base64url');
const raw = () => ({ upstream: 'http://127.0.0.1:11434',models: ['synthetic:latest'],workIdentityKey: key,
  credentials: [{ installation: 'test',workClass: 'background',token: 'a'.repeat(43) }] });
const body = () => ({ model: 'synthetic:latest',prompt: 'PRIVATE prompt',stream: false });
const prepare = (config = gatewayConfig(raw()),installation = 'local',path = '/api/generate',input = body()) =>
  prepareGatewayWork(config,installation,path,input);

test('stable keyed fingerprints survive configuration reloads without storing a key or prompt in identity',() => {
  const first = prepare(),second = prepare(); expect(first.identity).toEqual(second.identity);
  expect(first.identity.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(first.identity)).not.toMatch(/PRIVATE|prompt/);
  expect(JSON.stringify(gatewayConfig(raw()))).not.toContain(key);
});
test.each(['installation','provider','operation','model','prompt','options','key'])('fingerprint separates %s scope',change => {
  let config = gatewayConfig(raw()),installation = 'local',path = '/api/generate'; const input = body();
  if (change === 'installation') installation = 'unraid';
  if (change === 'provider') config = gatewayConfig({ ...raw(),upstream: 'http://127.0.0.2:11434' });
  if (change === 'operation') path = '/api/embed';
  if (change === 'model') input.model = 'other:latest';
  if (change === 'prompt') input.prompt += ' changed';
  if (change === 'options') input.options = { seed: 1 };
  if (change === 'key') config = gatewayConfig({ ...raw(),workIdentityKey: Buffer.alloc(32,8).toString('base64url') });
  expect(prepare(config,installation,path,input).identity.fingerprint).not.toBe(prepare().identity.fingerprint);
});
test('the body is snapshotted before asynchronous admission',() => {
  const input = body(),work = prepare(undefined,undefined,undefined,input); input.prompt = 'changed';
  expect(work.body.prompt).toBe('PRIVATE prompt'); expect(work.identity).toEqual(prepare().identity);
});
test('no configured fingerprint key means explicit nulls, not an unkeyed content hash',() => {
  expect(prepare(gatewayConfig({ ...raw(),workIdentityKey: undefined })).identity).toMatchObject({ fingerprint: null,keyId: null });
});
test.each([null,123,'short','a'.repeat(43),'a'.repeat(44),Buffer.alloc(32,7).toString('base64')])('invalid/noncanonical fingerprint key %# is refused',value => {
  expect(() => gatewayWorkKey(value)).toThrow('gateway_config_invalid');
});
test('key changes are refused on credential-only reload',() => {
  const credentials = createGatewayCredentials(gatewayConfig(raw()));
  expect(() => credentials.replace(gatewayConfig({ ...raw(),workIdentityKey: Buffer.alloc(32,8).toString('base64url') }))).toThrow('gateway_reload_incompatible');
  expect(() => credentials.replace(gatewayConfig(raw()))).not.toThrow(); credentials.stop();
});
test('work headers are fixed correlation metadata without fingerprint or auth credentials',() => {
  const requestId = '0199e700-0000-7000-8000-000000000001';
  expect(gatewayWorkHeaders({ requestId,installation: 'local',fingerprint: 'private',application: 'spoof' })).toEqual({
    'X-Classifarr-Application': 'classifarr','X-Classifarr-Request-Id': requestId,'X-Classifarr-Installation': 'local' });
  expect(gatewayWorkHeaders(undefined)).toEqual({});
});
test.each([null,{ requestId: 'foreign',installation: 'local' },{ requestId: '0199e700-0000-7000-0000-000000000001',installation: 'local' },
  { requestId: '0199e700-0000-7000-8000-000000000001',installation: 'local\r\nspoof' }])('unsafe work headers %# cannot be dispatched',identity => {
  expect(() => gatewayWorkHeaders(identity)).toThrow('gateway_work_identity_invalid');
});
