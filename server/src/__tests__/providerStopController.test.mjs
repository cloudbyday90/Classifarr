/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { providerStopConfiguration,providerStopReview } from '../ollamaGateway/providerStopContract.mjs';
import { createDockerStopClient } from '../ollamaGateway/dockerStopClient.mjs';
import { readDockerStopBoundary,projectDockerStopBoundary } from '../ollamaGateway/dockerStopBoundary.mjs';
import { withDockerStopFixture } from './helpers/dockerStopFixture.mjs';

const id = '0199e800-1234-7000-8000-123456789abc';
const configuration = data => ({ database: { host: '127.0.0.1',database: 'synthetic',user: 'synthetic' },
  requestId: id,providerHash: 'd'.repeat(64),boundary: data.config,networkId: data.network.Id });
const review = () => ({ version: 1,expected: { bindingId: id,ownerId: id,attempts: '1',configurationHash: 'a'.repeat(64),networkHash: 'b'.repeat(64) },
  operatorRef: 'fixture',evidenceRef: 'fixture',observedAt: new Date().toISOString(),
  assertions: { dedicatedProvider: true,exclusiveDockerControl: true,allOtherConsumersStopped: true,stopApproved: true } });

test('explicit bounded Docker client sends a single pinned stop and sanitizes its projection',async () => withDockerStopFixture(async data => {
  const config = providerStopConfiguration(configuration(data)),signal = new AbortController().signal,read = createDockerStopClient(config,signal);
  const before = await readDockerStopBoundary(config,read,signal);
  expect(before.status).toBe('running'); expect(JSON.stringify(before)).not.toContain('PRIVATE');
  await read('stop'); expect((await readDockerStopBoundary(config,read,signal)).observation).toBe('stopped');
  await expect(read('stop')).rejects.toThrow('gateway_stop_operation_refused');
  await expect(read('start')).rejects.toThrow('gateway_stop_operation_refused');
  expect(data.requests.filter(r => r.method === 'POST')).toEqual([{ method: 'POST',path: `/v1.51/containers/${data.config.containerId}/stop?t=5` }]);
}));

test.each(['published','restart','root','root_group','implicit_group','named_user','oversized_user','label','extra_network','peer','internal_only','ipv6','privileged','mount','device','unbounded_cpu','autoremove'])('refuses unsafe %s profile',async kind => withDockerStopFixture(async data => {
  const c = data.container,n = data.network;
  if (kind === 'published') c.HostConfig.PortBindings = { '11434/tcp': [] };
  if (kind === 'restart') c.HostConfig.RestartPolicy.Name = 'always';
  if (kind === 'root') c.Config.User = '0';
  if (kind === 'root_group') c.Config.User = '1000:0';
  if (kind === 'implicit_group') c.Config.User = '1000';
  if (kind === 'named_user') c.Config.User = 'user:group';
  if (kind === 'oversized_user') c.Config.User = '1'.repeat(200000);
  if (kind === 'label') c.Config.Labels = {};
  if (kind === 'extra_network') c.NetworkSettings.Networks.other = { NetworkID: 'e'.repeat(64) };
  if (kind === 'peer') n.Containers['e'.repeat(64)] = {};
  if (kind === 'internal_only') n.Options = {};
  if (kind === 'ipv6') n.EnableIPv6 = true;
  if (kind === 'privileged') c.HostConfig.Privileged = true;
  if (kind === 'mount') c.Mounts.push({ Source: 'PRIVATE' });
  if (kind === 'device') c.HostConfig.Devices.push({ PathOnHost: 'PRIVATE' });
  if (kind === 'unbounded_cpu') c.HostConfig.NanoCpus = 0;
  if (kind === 'autoremove') c.HostConfig.AutoRemove = true;
  expect(() => projectDockerStopBoundary(configuration(data),data.info,c,n)).toThrow('gateway_stop_boundary_refused');
}));

test.each(['request','hash','network','extra','remote_socket'])('refuses invalid %s configuration',async kind => withDockerStopFixture(async data => {
  const c = configuration(data);
  if (kind === 'request') c.requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if (kind === 'hash') c.providerHash += '\n';
  if (kind === 'network') c.networkId = 'mutable-name';
  if (kind === 'extra') c.command = 'start';
  if (kind === 'remote_socket') c.boundary = { ...c.boundary,socketPath: 'tcp://remote' };
  expect(() => providerStopConfiguration(c)).toThrow();
}));

test.each(['missing','false','extra','timestamp','reference','attempts'])('requires a complete, strict review: %s',kind => {
  const value = review();
  if (kind === 'missing') delete value.assertions.stopApproved;
  if (kind === 'false') value.assertions.exclusiveDockerControl = false;
  if (kind === 'extra') value.command = 'start';
  if (kind === 'timestamp') value.observedAt = 'not-a-time';
  if (kind === 'reference') value.operatorRef += '\n';
  if (kind === 'attempts') value.expected.attempts = '9223372036854775808';
  expect(() => providerStopReview(value)).toThrow('gateway_stop_review_invalid');
});

test.each(['malformed','oversized','redirect','truncated','encoding','cancelled','unsupported','changed'])('Docker reads fail safely for %s',async kind => {
  const controller = new AbortController();
  await withDockerStopFixture(async data => {
    const read = createDockerStopClient(configuration(data),controller.signal);
    await expect(readDockerStopBoundary(configuration(data),read,controller.signal)).rejects.toThrow();
    expect(data.requests.every(r => r.method === 'GET')).toBe(true);
  },(req,res,data,n) => {
    if (kind === 'changed' && n === 6) data.container.RestartCount++;
    if (n !== 1 || kind === 'changed') return false;
    if (kind === 'cancelled') { controller.abort(); return true; }
    if (kind === 'redirect') { res.writeHead(302,{ Location: 'http://PRIVATE' }); res.end(); return true; }
    res.setHeader('Content-Type','application/json');
    if (kind === 'encoding') res.setHeader('Content-Encoding','gzip');
    if (kind === 'truncated') { res.writeHead(200,{ 'Content-Length': '999' }); res.end('{}'); return true; }
    res.end(kind === 'oversized' ? 'x'.repeat(262145) : kind === 'unsupported' ? '{"MinAPIVersion":"1.60","ApiVersion":"1.60"}' : 'invalid');
    return true;
  });
});
