/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayConfig,validateGatewayBody } from '../ollamaGateway/contract.mjs';
import { gatewayProviderInstance } from '../ollamaGateway/providerInstance.mjs';
import { createGatewayCredentials } from '../ollamaGateway/credentials.mjs';
import { randomBytes } from 'node:crypto';

const pins = () => ({ daemonIdHash: 'a'.repeat(64),containerId: 'b'.repeat(64),imageId: `sha256:${'c'.repeat(64)}`,startedAt: '2026-10-15T09:00:00.123456789Z' });
const raw = () => ({ upstream: 'http://127.0.0.1:11434',models: ['synthetic:latest'],
  credentials: [{ installation: 'fixture',workClass: 'background',token: randomBytes(32).toString('base64url') }] });

test('optional declaration is copied, frozen and preserves exact start precision', () => {
  const source = pins(), config = gatewayConfig({ ...raw(),providerInstance: source });
  expect(config.providerInstance).toEqual(source); expect(Object.isFrozen(config.providerInstance)).toBe(true);
  source.containerId = 'd'.repeat(64); expect(config.providerInstance.containerId).toBe('b'.repeat(64));
  expect(gatewayConfig(raw()).providerInstance).toBeNull();
});

test.each([null,{},[],{ extra: true },{ socketPath: '/run/docker.sock' },{ containerId: 'mutable-name' },
  { daemonIdHash: ['a'.repeat(64)] },{ imageId: 'ollama:latest' },{ startedAt: '2026-02-30T00:00:00Z' },
  { startedAt: '0001-01-01T00:00:00Z' },{ startedAt: '2026-10-15T00:00:00Z\n' }])('rejects incomplete/unsafe declaration %#', value => {
  const input = !value || Array.isArray(value) || !Object.keys(value).length ? value : { ...pins(),...value };
  expect(() => gatewayProviderInstance(input)).toThrow('gateway_config_invalid');
});

test.each(['daemonIdHash','containerId','imageId','startedAt'])('credential reload cannot change %s', key => {
  const initial = raw(), original = pins(), authority = createGatewayCredentials(gatewayConfig({ ...initial,providerInstance: original }));
  const changed = pins(); changed[key] = key === 'startedAt' ? '2026-10-15T09:01:00Z' : key === 'imageId' ? `sha256:${'e'.repeat(64)}` : 'e'.repeat(64);
  expect(() => authority.replace(gatewayConfig({ ...initial,providerInstance: changed }))).toThrow('gateway_reload_incompatible');
  expect(() => authority.replace(gatewayConfig(initial))).toThrow('gateway_reload_incompatible');
  expect(() => authority.replace(gatewayConfig({ ...initial,providerInstance: original,credentials: raw().credentials }))).not.toThrow();
});

test('request body cannot supply a provider declaration', () => {
  expect(() => validateGatewayBody('/api/generate',{ model: 'synthetic:latest',prompt: 'fixture',stream: false,providerInstance: pins() },gatewayConfig(raw())))
    .toThrow('gateway_body_invalid');
});
