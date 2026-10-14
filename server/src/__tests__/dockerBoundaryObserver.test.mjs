/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { observeDockerProviderBoundary } from '../ollamaGateway/dockerBoundaryObserver.mjs';
import { dockerBoundaryConfiguration } from '../ollamaGateway/dockerBoundaryContract.mjs';
import { projectDockerBoundary } from '../ollamaGateway/dockerBoundaryProjection.mjs';
import { boundaryFixtureData,withDockerBoundaryFixture } from './helpers/dockerBoundaryFixture.mjs';

test('observes pinned stopped container using five GETs without recovery authority or sensitive output', async () => {
  await withDockerBoundaryFixture(async ({ config,requests }) => {
    const result = await observeDockerProviderBoundary(config);
    expect(result).toMatchObject({ observation: 'stopped',recoveryAuthorized: false,snapshot: { concerns: [] } });
    expect(result.blockers).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain('PRIVATE-');
    expect(requests).toEqual(['/version','/v1.51/info',`/v1.51/containers/${config.containerId}/json`,
      '/v1.51/info',`/v1.51/containers/${config.containerId}/json`].map(path => ({ method: 'GET',path })));
  });
});

test.each(['containerId','daemonIdHash','imageId','startedAt'])('refuses mismatched pin %s', async key => {
  await withDockerBoundaryFixture(async ({ config }) => {
    const values = { containerId: 'c'.repeat(64),daemonIdHash: 'd'.repeat(64),imageId: `sha256:${'e'.repeat(64)}`,startedAt: '2026-10-14T11:00:00Z' };
    expect(await observeDockerProviderBoundary({ ...config,[key]: values[key] })).toMatchObject({ observation: 'changed',recoveryAuthorized: false });
  });
});

test.each(['restart','daemon','policy','mount','network'])('detects %s changing between samples', async change => {
  await withDockerBoundaryFixture(async ({ config }) => {
    expect(await observeDockerProviderBoundary(config)).toMatchObject({ observation: 'changed',recoveryAuthorized: false });
  },(_req,_res,data,count) => {
    if (count === 4) {
      if (change === 'restart') data.container.State.StartedAt = '2026-10-14T11:00:00Z';
      if (change === 'daemon') data.info.ID = 'replacement-daemon';
      if (change === 'policy') data.container.HostConfig.RestartPolicy.Name = 'always';
      if (change === 'mount') data.container.Mounts.push({ Source: 'PRIVATE-PATH' });
      if (change === 'network') data.container.NetworkSettings.Networks = { private: { IPAddress: 'PRIVATE-IP' } };
    }
  });
});

test.each(['running','paused','restarting','dead','removing','created'])('never calls %s stopped', state => {
  const { info,container } = boundaryFixtureData(); container.State.Status = state;
  expect(projectDockerBoundary(info,container).observation).toBe('not_stopped');
});

test.each(['Running','Paused','Restarting','Dead','Pid','FinishedAt'])('requires stopped evidence for %s', key => {
  const { info,container } = boundaryFixtureData();
  container.State[key] = key === 'Pid' ? 123 : key === 'FinishedAt' ? '0001-01-01T00:00:00Z' : true;
  expect(projectDockerBoundary(info,container).observation).toBe('not_stopped');
});

test('projects fixed concerns without exposing dangerous configuration', () => {
  const { info,container } = boundaryFixtureData();
  Object.assign(container.HostConfig,{ RestartPolicy: { Name: 'always' },Privileged: true,PidMode: 'host',ReadonlyRootfs: false,
    CapDrop: [],SecurityOpt: [],NetworkMode: 'host',PublishAllPorts: true,Devices: [{ PathOnHost: 'PRIVATE-DEVICE' }] });
  container.Mounts.push({ Source: 'PRIVATE-PATH' });
  const result = projectDockerBoundary(info,container);
  expect(result.concerns).toHaveLength(10);
  expect(JSON.stringify(result)).not.toContain('PRIVATE-');
});

test.each([null,{}, { socketPath: 'tcp://127.0.0.1:2375' },{ socketPath: '\\\\remote\\pipe\\docker' },
  { socketPath: '/tmp/../docker.sock' },{ socketPath: '/tmp//docker.sock' },{ socketPath: '/tmp/docker.sock\n' },
  { containerId: 'mutable-name' },{ containerId: ['a'.repeat(64)] },{ daemonIdHash: null },
  { startedAt: 'yesterday' },{ startedAt: '0001-01-01T00:00:00Z' },{ extra: true },
])('strictly rejects invalid config %#', invalid => {
  const { config } = boundaryFixtureData();
  expect(() => dockerBoundaryConfiguration(invalid === null || !Object.keys(invalid).length ? invalid : { ...config,...invalid }))
    .toThrow('gateway_boundary_config_invalid');
});

test.each(['404','redirect','html','invalid-json','invalid-utf8','oversize','truncated','headers','compressed','array','unsupported','incomplete'])('fails closed for %s response', async fault => {
  await withDockerBoundaryFixture(async ({ config }) => {
    const result = await observeDockerProviderBoundary(config);
    expect(result).toMatchObject({ observation: 'unavailable',recoveryAuthorized: false });
    expect(JSON.stringify(result)).not.toContain('PRIVATE-');
  },(_req,res) => {
    res.setHeader('Content-Type','application/json');
    if (fault === '404') res.statusCode = 404;
    if (fault === 'redirect') { res.statusCode = 302; res.setHeader('Location','http://127.0.0.1:11434'); }
    if (fault === 'html') res.setHeader('Content-Type','text/html');
    if (fault === 'headers') res.setHeader('X-Large','a'.repeat(9000));
    if (fault === 'compressed') res.setHeader('Content-Encoding','gzip');
    if (fault === 'truncated') { res.setHeader('Content-Length','100'); res.end('{}'); return true; }
    res.end(fault === 'oversize' ? 'a'.repeat(262145) : fault === 'invalid-utf8' ? Buffer.from([0xff]) :
      fault === 'array' ? '[]' : fault === 'unsupported' ? '{"MinAPIVersion":"1.52","ApiVersion":"1.56"}' :
      fault === 'incomplete' ? '{}' : 'PRIVATE-SECRET');
    return true;
  });
});

test('cancellation interrupts real socket and sends no further reads', async () => {
  await withDockerBoundaryFixture(async ({ config,requests }) => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(),30);
    try {
      expect(await observeDockerProviderBoundary(config,{ signal: controller.signal })).toMatchObject({ observation: 'cancelled',recoveryAuthorized: false });
      expect(requests.length).toBeLessThanOrEqual(1);
    } finally { clearTimeout(timer); }
  },() => true);
});

test('times out a silent real socket without retry', async () => {
  await withDockerBoundaryFixture(async ({ config,requests }) => {
    expect(await observeDockerProviderBoundary(config)).toMatchObject({ observation: 'unavailable',recoveryAuthorized: false });
    expect(requests).toHaveLength(1);
  },() => true);
},10000);

test('pre-cancelled read never reaches daemon', async () => {
  await withDockerBoundaryFixture(async ({ config,requests }) => {
    expect(await observeDockerProviderBoundary(config,{ signal: AbortSignal.abort() })).toMatchObject({ observation: 'cancelled' });
    expect(requests).toHaveLength(0);
  });
});

test.each(['missing-state','missing-host','missing-mounts','missing-id','wrong-os','invalid-pid','invalid-date'])('refuses incomplete container evidence %s', async fault => {
  await withDockerBoundaryFixture(async ({ config,info,container }) => {
    if (fault === 'missing-state') delete container.State;
    if (fault === 'missing-host') delete container.HostConfig;
    if (fault === 'missing-mounts') delete container.Mounts;
    if (fault === 'missing-id') delete info.ID;
    if (fault === 'wrong-os') info.OSType = 'windows';
    if (fault === 'invalid-pid') container.State.Pid = -1;
    if (fault === 'invalid-date') container.State.FinishedAt = '2026-02-30T00:00:00Z';
    expect(await observeDockerProviderBoundary(config)).toMatchObject({ observation: 'unavailable',recoveryAuthorized: false });
  });
});

test('missing daemon is unavailable, never stopped', async () => {
  const { config } = boundaryFixtureData();
  expect(await observeDockerProviderBoundary(config)).toMatchObject({ observation: 'unavailable',recoveryAuthorized: false });
});

test.each(['socketPath','daemonIdHash','containerId','imageId','startedAt'])('refuses trailing line breaks in %s', key => {
  const { config } = boundaryFixtureData();
  for (const ending of ['\n','\r','\r\n']) {
    expect(() => dockerBoundaryConfiguration({ ...config,[key]: config[key] + ending })).toThrow('gateway_boundary_config_invalid');
  }
});
