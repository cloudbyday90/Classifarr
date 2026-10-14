/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash,randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function boundaryFixtureData() {
  const config = { socketPath: process.platform === 'win32' ? `\\\\.\\pipe\\cf-boundary-${randomUUID()}` : join(tmpdir(),`cf-${randomUUID()}.sock`),
    daemonIdHash: createHash('sha256').update('fixture-daemon').digest('hex'),
    containerId: 'a'.repeat(64),imageId: `sha256:${'b'.repeat(64)}`,startedAt: '2026-10-14T10:00:00.123456789Z' };
  const info = { ID: 'fixture-daemon',OSType: 'linux',Name: 'PRIVATE-HOSTNAME' };
  const container = { Id: config.containerId,Image: config.imageId,RestartCount: 0,
    Config: { Env: ['TOKEN=PRIVATE-SECRET'],Cmd: ['PRIVATE-COMMAND'] },
    State: { Status: 'exited',Running: false,Paused: false,Restarting: false,Dead: false,OOMKilled: false,
      Pid: 0,ExitCode: 0,StartedAt: config.startedAt,FinishedAt: '2026-10-14T10:00:01.123456789Z',
      Health: { Log: ['PRIVATE-HEALTH'] } },Mounts: [],
    HostConfig: { RestartPolicy: { Name: 'no' },Privileged: false,PidMode: '',IpcMode: 'private',CgroupnsMode: 'private',
      ReadonlyRootfs: true,CapDrop: ['ALL'],CapAdd: null,SecurityOpt: ['no-new-privileges'],NetworkMode: 'none',
      PublishAllPorts: false,PortBindings: {},Devices: [],DeviceRequests: null,DeviceCgroupRules: null,VolumesFrom: null },
    NetworkSettings: { Networks: {} } };
  return { config,info,container };
}

export async function withDockerBoundaryFixture(action, respond) {
  const data = boundaryFixtureData(),requests = [];
  const server = createServer((req,res) => {
    requests.push({ method: req.method,path: req.url });
    if (respond?.(req,res,data,requests.length) === true) return;
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(req.url === '/version' ? { MinAPIVersion: '1.40',ApiVersion: '1.56' }
      : req.url === '/v1.51/info' ? data.info : data.container));
  });
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(data.config.socketPath,resolve); });
  try { return await action({ ...data,requests }); }
  finally { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); }
}
