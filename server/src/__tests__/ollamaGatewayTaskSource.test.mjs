/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayTaskSourceHeaders,readGatewayTaskSource,validateGatewayTaskSource,GATEWAY_TASK_SOURCE_HEADER as header } from '../ollamaGateway/taskSource.mjs';
import { prepareGatewayWork } from '../ollamaGateway/workIdentity.mjs';
import { gatewayConfig } from '../ollamaGateway/contract.mjs';

const source = { version: 1,kind: 'queue_task',taskId: '42',taskType: 'classification',attempt: 2 };
const encode = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const request = value => ({ rawHeaders: [header,value],headers: { [header]: value } });

test('bounded canonical source roundtrips without modifying the caller',() => {
  const value = gatewayTaskSourceHeaders(source,true)[header]; expect(value.length).toBeLessThanOrEqual(256);
  expect(readGatewayTaskSource(request(value),true)).toEqual(source);
  expect(Object.isFrozen(validateGatewayTaskSource(source))).toBe(true);
  expect(gatewayTaskSourceHeaders(null,true)).toEqual({});
  expect(readGatewayTaskSource({ rawHeaders: [],headers: {} },false)).toBeNull();
});

test.each([null,[],{}, { ...source,extra: 'PRIVATE' },{ ...source,version: 2 },{ ...source,kind: 'other' },
  { ...source,taskId: 42 },{ ...source,taskId: '01' },{ ...source,taskId: '0' },{ ...source,taskId: '42\n' },
  { ...source,taskId: '9223372036854775808' },{ ...source,taskType: 'PRIVATE' },{ ...source,attempt: -1 },
  { ...source,attempt: 0.5 },{ ...source,attempt: '1' },{ ...source,attempt: 2147483648 }])('invalid source %# is rejected with fixed public error',value => {
  expect(() => readGatewayTaskSource(request(encode(value)),true)).toThrow('gateway_task_source_invalid');
});

test.each(['a'.repeat(257),'==','not-json','eyJ4Ijoif_wifQ',encode(JSON.stringify(source)+' '),
  encode('{"version":1,"kind":"queue_task","taskId":"999","taskId":"42","taskType":"classification","attempt":2}')])('malformed/noncanonical carrier %# is rejected',value => {
  expect(() => readGatewayTaskSource(request(value),true)).toThrow('gateway_task_source_invalid');
});

test('duplicate headers and inspection propagation are rejected',() => {
  const value = encode(source),req = request(value); req.rawHeaders.push(header.toUpperCase(),value);
  expect(() => readGatewayTaskSource(req,true)).toThrow('gateway_task_source_invalid');
  expect(() => readGatewayTaskSource(request(value),false)).toThrow('gateway_task_source_invalid');
  expect(() => gatewayTaskSourceHeaders(source,false)).toThrow('gateway_task_source_invalid');
});

test('different task references do not change content fingerprints or mutate the stored source',() => {
  const config = gatewayConfig({ upstream: 'http://127.0.0.1:11434',models: ['test:latest'],workIdentityKey: Buffer.alloc(32,7).toString('base64url'),
    credentials: [{ installation: 'local',workClass: 'background',token: 'a'.repeat(43) }] });
  const body = { model: 'test:latest',prompt: 'PRIVATE',stream: false },input = { ...source };
  const first = prepareGatewayWork(config,'local','/api/generate',body,input);
  input.taskId = '43'; const second = prepareGatewayWork(config,'local','/api/generate',body,input);
  expect(first.identity.fingerprint).toBe(second.identity.fingerprint);
  expect(first.identity.source.taskId).toBe('42'); expect(second.identity.source.taskId).toBe('43');
  expect(first.body).toEqual(body); expect(first.body.source).toBeUndefined();
});
