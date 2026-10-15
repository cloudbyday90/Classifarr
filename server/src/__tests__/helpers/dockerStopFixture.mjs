/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { withDockerBoundaryFixture } from './dockerBoundaryFixture.mjs';

export async function withDockerStopFixture(action,respond) {
  let ready = false,network;
  const setup = data => {
    if (ready) return; ready = true;
    const id = 'c'.repeat(64);
    network = { Id: id,Driver: 'bridge',Scope: 'local',Internal: true,EnableIPv6: false,Attachable: false,Ingress: false,
      Options: { 'com.docker.network.bridge.gateway_mode_ipv4': 'isolated' },IPAM: {},Labels: {},Containers: { [data.config.containerId]: {} } };
    Object.assign(data.container.HostConfig,{ NetworkMode: 'fixture-net',AutoRemove: false,Runtime: 'runc',UTSMode: '',Memory: 268435456,NanoCpus: 1000000000,PidsLimit: 64 });
    Object.assign(data.container.Config,{ User: '1000:1000',Labels: { 'io.classifarr.gateway.lifecycle': 'offline-v1' } });
    data.container.NetworkSettings.Networks = { fixture: { NetworkID: id,IPAddress: '10.42.0.2' } };
    Object.assign(data.container.State,{ Status: 'running',Running: true,Pid: 42,FinishedAt: '0001-01-01T00:00:00Z' });
  };
  await withDockerBoundaryFixture(async data => {
    setup(data);
    const stopped = () => {
      Object.assign(data.container.State,{ Status: 'exited',Running: false,Pid: 0,FinishedAt: new Date().toISOString() });
      network.Containers = {};
    };
    await action({ ...data,network,stopped });
  },(req,res,data,n) => {
    setup(data);
    if (respond?.(req,res,{ ...data,network },n) === true) return true;
    if (req.method === 'POST') {
      Object.assign(data.container.State,{ Status: 'exited',Running: false,Pid: 0,FinishedAt: new Date().toISOString() });
      network.Containers = {}; res.writeHead(204); res.end(); return true;
    }
    if (req.url.startsWith('/v1.51/networks/')) { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(network)); return true; }
    return false;
  });
}
