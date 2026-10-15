/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { projectDockerBoundary } from './dockerBoundaryProjection.mjs';
import { gatewayError } from './errors.mjs';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nonRootIdentity = value => typeof value === 'string' && value.length <= 19 && !/[^0-9:]/.test(value) &&
  value.split(':').length === 2 && value.split(':').every(part => /^[1-9][0-9]{0,8}$/.test(part));

/** Narrow offline profile, never proof that all provider ingress/controllers are contained. */
export function projectDockerStopBoundary(config,info,container,network) {
  const snapshot = projectDockerBoundary(info,container),host = container.HostConfig;
  const links = container.NetworkSettings?.Networks, peers = network.Containers;
  if (['daemonIdHash','containerId','imageId','startedAt'].some(key => snapshot[key] !== config.boundary[key]) ||
      snapshot.concerns.some(code => code !== 'ingress_ownership_unproven') ||
      !nonRootIdentity(container.Config?.User) ||
      container.Config?.Labels?.['io.classifarr.gateway.lifecycle'] !== 'offline-v1' ||
      host.AutoRemove !== false || host.Runtime !== 'runc' || host.UTSMode !== '' || host.Links?.length ||
      !Number.isSafeInteger(host.Memory) || host.Memory < 1 || host.Memory > 8589934592 ||
      !Number.isSafeInteger(host.NanoCpus) || host.NanoCpus < 1 || host.NanoCpus > 8000000000 ||
      !Number.isSafeInteger(host.PidsLimit) || host.PidsLimit < 1 || host.PidsLimit > 4096 ||
      !object(links) || Object.keys(links).length !== 1 || Object.values(links)[0]?.NetworkID !== config.networkId ||
      network.Id !== config.networkId || network.Driver !== 'bridge' || network.Scope !== 'local' ||
      network.Internal !== true || network.EnableIPv6 !== false || network.Attachable !== false || network.Ingress !== false ||
      network.Options?.['com.docker.network.bridge.gateway_mode_ipv4'] !== 'isolated' ||
      !object(peers) || Object.keys(peers).some(id => id !== config.boundary.containerId) ||
      snapshot.running && !Object.hasOwn(peers,config.boundary.containerId)) {
    throw gatewayError('gateway_stop_boundary_refused');
  }
  return { ...snapshot,configurationHash: hash([host,container.Config,container.Mounts,config.networkId]),
    networkHash: hash([network.Id,network.Driver,network.Scope,network.Internal,network.EnableIPv6,
      network.Attachable,network.Ingress,network.Options,network.IPAM,network.Labels]) };
}

export async function readDockerStopBoundary(config,read,signal) {
  const version = await read('version');
  const minor = value => typeof value === 'string' && /^1\.\d{2,3}$/.test(value) ? Number(value.slice(2)) : NaN;
  if (!(minor(version.MinAPIVersion) <= 51 && minor(version.ApiVersion) >= 51)) throw gatewayError('gateway_stop_api_unsupported');
  const sample = async () => projectDockerStopBoundary(config,await read('info'),await read('container'),await read('network'));
  const first = await sample(),second = await sample(); signal.throwIfAborted();
  if (JSON.stringify(first) !== JSON.stringify(second)) throw gatewayError('gateway_stop_boundary_changed');
  return second;
}
