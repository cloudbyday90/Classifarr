/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayTlsFixture } from './helpers/gatewayTlsFixture.mjs';
import { gatewayConfig, gatewayProviderIdentity } from '../ollamaGateway/contract.mjs';
import { gatewayPeerIdentity, gatewayUpstreamTlsOptions } from '../ollamaGateway/upstreamIdentity.mjs';
import { createGatewayCredentials } from '../ollamaGateway/credentials.mjs';
import { assertGatewayEndpoint } from '../services/ollamaGatewayProviderIdentity.mjs';
import { createGatewayClient } from '../ollamaGateway/client.mjs';

let tls;
beforeAll(async () => { tls = await gatewayTlsFixture(); });
afterAll(async () => { await tls?.close(); });
const raw = () => ({ upstream: 'https://127.0.0.1:11434',models: ['synthetic:latest'],
  credentials: [{ installation: 'fixture',workClass: 'background',token: 'a'.repeat(43) }],
  upstreamTls: { ca: tls.cert,publicKeySha256: gatewayPeerIdentity(tls.cert).publicKeySha256 } });

test('HTTPS identity is distinct from HTTP; CA and key pin are explicit and frozen',() => {
  const config = gatewayConfig(raw()); expect(Object.isFrozen(config.upstreamTls)).toBe(true);
  expect(config.upstreamTls).toMatchObject({ rejectUnauthorized: true,minVersion: 'TLSv1.2' });
  expect(config.providerHash).not.toBe(gatewayProviderIdentity('http://127.0.0.1:11434').providerHash);
});
test.each([undefined,null,{},[],{ ca: 'not a certificate',publicKeySha256: 'a'.repeat(64) },
  { ca: 'placeholder' },{ publicKeySha256: 'a'.repeat(64) }])('refuses incomplete TLS config %#',upstreamTls => {
  expect(() => gatewayConfig({ ...raw(),upstreamTls })).toThrow();
});
test.each(['short','A'.repeat(64),'a'.repeat(64)+'\n',null,42])('refuses invalid pin %#',pin => {
  expect(() => gatewayConfig({ ...raw(),upstreamTls: { ...raw().upstreamTls,publicKeySha256: pin } })).toThrow();
});
test.each([{ rejectUnauthorized: false },{ servername: 'other' },{ key: 'private' },{ session: 'cached' },{ proxy: 'other' }])('refuses TLS authority overrides %#',extra => {
  expect(() => gatewayConfig({ ...raw(),upstreamTls: { ...raw().upstreamTls,...extra } })).toThrow();
});
test.each(['https://example.com','https://8.8.8.8','https://169.254.169.254','https://user:secret@127.0.0.1',
  'https://127.0.0.1/path','https://127.0.0.1/?x=1','https://[::1]','http://127.0.0.1:11434'])('refuses unsupported TLS destination %s',upstream => {
  expect(() => gatewayConfig({ ...raw(),upstream })).toThrow();
});
test.each(['pin','ca','scheme'])('credential reload cannot replace %s',change => {
  const initial = gatewayConfig(raw()),credentials = createGatewayCredentials(initial),next = raw();
  if (change === 'pin') next.upstreamTls.publicKeySha256 = '0'.repeat(64);
  if (change === 'ca') next.upstreamTls.ca += '\n';
  if (change === 'scheme') { next.upstream = 'http://127.0.0.1:11434'; delete next.upstreamTls; }
  expect(() => credentials.replace(gatewayConfig(next))).toThrow('gateway_reload_incompatible');
  credentials.stop();
});
test('ordinary token rotation is compatible with unchanged upstream TLS policy',() => {
  const credentials = createGatewayCredentials(gatewayConfig(raw())),next = raw(); next.credentials[0].token = 'b'.repeat(43);
  expect(() => credentials.replace(gatewayConfig(next))).not.toThrow(); credentials.stop();
});
test('IP SAN checks are retained even with the correct key',() => {
  const options = gatewayUpstreamTlsOptions(gatewayConfig(raw()));
  const peer = { raw: Buffer.from(tls.cert),subjectaltname: 'IP Address:127.0.0.1' };
  expect(options.checkServerIdentity('127.0.0.1',peer)).toBeUndefined();
  expect(options.checkServerIdentity('127.0.0.2',peer)).toMatchObject({ code: 'gateway_upstream_identity_failed' });
  expect(options.checkServerIdentity('127.0.0.1',{})).toMatchObject({ code: 'gateway_upstream_identity_failed' });
});
test('endpoint override confirms the HTTPS origin without accepting a different port',() => {
  expect(() => assertGatewayEndpoint(raw().upstream,'127.0.0.1',11434)).not.toThrow();
  expect(() => assertGatewayEndpoint(raw().upstream,'127.0.0.1',11435)).toThrow('gateway_provider_mismatch');
});
test.each([undefined,null,123,'short','a'.repeat(43)+'\n'])('gateway clients still reject invalid bearer credentials %#',token => {
  expect(() => createGatewayClient({ url: 'http://127.0.0.1:11435',upstream: raw().upstream,
    models: raw().models,token },{ expectedUpstream: raw().upstream })).toThrow('gateway_client_config_invalid');
});
