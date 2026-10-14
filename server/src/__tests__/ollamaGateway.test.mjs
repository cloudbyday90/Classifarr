/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { gatewayConfig, authenticateGateway, gatewayRoute, validateGatewayBody } from '../ollamaGateway/contract.mjs';
import { createGatewayAdmission } from '../ollamaGateway/admission.mjs';

const token = randomBytes(32).toString('base64url');
const raw = () => ({ upstream: 'http://127.0.0.1:11434', models: ['synthetic:latest'],
  credentials: [{ installation: 'local',workClass: 'background',token }] });
test('credentials are hashed, work class is credential-bound, config is frozen', () => {
  const config = gatewayConfig(raw());
  expect(Object.isFrozen(config)).toBe(true);
  expect(JSON.stringify(config)).not.toContain(token);
  expect(authenticateGateway(config,`Bearer ${token}`)).toMatchObject({ installation: 'local',workClass: 'background' });
  expect(authenticateGateway(config,`Bearer ${'x'.repeat(43)}`)).toBeNull();
  for (const value of [null,[],token,`bearer ${token}`,`Bearer ${token} `]) expect(authenticateGateway(config,value)).toBeNull();
});
test.each(['https://127.0.0.1','http://169.254.169.254','http://example.com','http://8.8.8.8',
  'http://user:secret@127.0.0.1','http://127.0.0.1/path','http://127.0.0.1/?secret=x','http://[::1]'])('rejects upstream %s', upstream => {
  expect(() => gatewayConfig({ ...raw(),upstream })).toThrow('gateway_config_invalid');
});
test.each([{ port: 0 },{ timeoutMs: 300001 },{ queueMs: 30001 },{ timeoutMs: 1000,queueMs: 1000 },
  { models: ['test:cloud'] },{ models: ['untagged'] },{ models: [] },{ credentials: [] },{ extra: true },
  { credentials: [{ installation: 'local',workClass: 'administrator',token }] },
  { credentials: [{ installation: 'local',workClass: 'foreground',token: 'short' }] }])('rejects invalid config %#', invalid => {
  expect(() => gatewayConfig({ ...raw(),...invalid })).toThrow('gateway_config_invalid');
});
test.each(['/api/pull','/api/delete','/api/chat','/api/generate?target=x','http://127.0.0.1/api/generate','/api//generate'])('rejects unsupported route %s', path => {
  expect(() => gatewayRoute('POST',path)).toThrow('gateway_route_rejected');
});
test('compute versus read-only routes are explicit', () => {
  expect(gatewayRoute('POST','/api/generate').compute).toBe(true);
  expect(gatewayRoute('POST','/api/embed').compute).toBe(true);
  expect(gatewayRoute('POST','/api/show').compute).toBe(false);
  expect(gatewayRoute('GET','/gateway/status').compute).toBe(false);
});
test.each([{ stream: 'true' },{ model: 'other:latest' },{ prompt: '' },{ images: [] },{ options: { num_ctx: 9999999 } },
  { options: { num_predict: -1 } },{ options: { num_gpu: 999 } },{ options: [] },{ keep_alive: -1 },
  { think: 'anything' },{ format: [] }])('rejects unsafe or unsupported generation %#', extra => {
  expect(() => validateGatewayBody('/api/generate',{ model: 'synthetic:latest',prompt: 'test',stream: false,...extra },gatewayConfig(raw())))
    .toThrow('gateway_body_invalid');
});
test('bounded generate/embed/show bodies are accepted without rewriting them', () => {
  const config = gatewayConfig(raw());
  for (const [path,extra] of [['generate',{ prompt: 'test',stream: false,format: { type: 'object' },think: false,
    options: { num_ctx: 8192,num_predict: 64,temperature: 0,seed: 42 },keep_alive: '5m' }],
  ['embed',{ input: ['test'],truncate: false }],['show',{ verbose: false }]]) {
    const body = { model: 'synthetic:latest',...extra };
    expect(validateGatewayBody(`/api/${path}`,body,config)).toBe(body);
  }
  expect(() => validateGatewayBody('/api/embed',{ model: 'synthetic:latest',input: [] },config)).toThrow();
  expect(() => validateGatewayBody('/api/show',{ model: 'synthetic:latest',verbose: true },config)).toThrow();
});
test('one active request, bounded FIFO foreground waiting and no background backlog', async () => {
  const gate = createGatewayAdmission({ queueMs: 2000 }), signal = new AbortController().signal;
  const release = await gate.acquire({ installation: 'active',workClass: 'background' },signal);
  await expect(gate.acquire({ installation: 'bg',workClass: 'background' },signal)).rejects.toThrow('gateway_busy');
  const waits = Array.from({ length: 8 },(_,i) => gate.acquire({ installation: `fg${i}`,workClass: 'foreground' },signal));
  expect(gate.pending).toBe(8);
  await expect(gate.acquire({ installation: 'fg0',workClass: 'foreground' },signal)).rejects.toThrow('gateway_busy');
  await expect(gate.acquire({ installation: 'overflow',workClass: 'foreground' },signal)).rejects.toThrow('gateway_busy');
  release();
  for (const wait of waits) (await wait)();
  expect(gate.pending).toBe(0); gate.stop();
});
test('cancelled, expired and stopped queues never obtain admission', async () => {
  const gate = createGatewayAdmission({ queueMs: 20 }), root = new AbortController();
  const release = await gate.acquire({ installation: 'a',workClass: 'background' },root.signal);
  const cancelled = new AbortController();
  const first = gate.acquire({ installation: 'b',workClass: 'foreground' },cancelled.signal);
  const firstCheck = expect(first).rejects.toThrow('gateway_cancelled'); cancelled.abort(); await firstCheck;
  await expect(gate.acquire({ installation: 'c',workClass: 'foreground' },root.signal)).rejects.toThrow('gateway_cancelled');
  const last = gate.acquire({ installation: 'd',workClass: 'foreground' },root.signal);
  const lastCheck = expect(last).rejects.toThrow('gateway_cancelled'); gate.stop(); await lastCheck; release();
  await expect(gate.acquire({ installation: 'e',workClass: 'foreground' },root.signal)).rejects.toThrow('gateway_cancelled');
});
