/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { dockerBoundaryTimestamp } from './dockerBoundaryContract.mjs';
import { gatewayError } from './contract.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const flags = ['Running','Paused','Restarting','Dead','OOMKilled'];
const object = value => value && typeof value === 'object' && !Array.isArray(value);

export function projectDockerBoundary(info,container) {
  const state = container.State,host = container.HostConfig;
  if (typeof info.ID !== 'string' || !info.ID.length || info.ID.length > 256 || info.OSType !== 'linux' ||
      typeof container.Id !== 'string' || !/^[a-f0-9]{64}$/.test(container.Id) ||
      typeof container.Image !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(container.Image) ||
      !object(state) || !object(host) || !Array.isArray(container.Mounts) ||
      !Number.isSafeInteger(container.RestartCount) || container.RestartCount < 0 ||
      flags.some(key => typeof state[key] !== 'boolean') ||
      !Number.isSafeInteger(state.Pid) || state.Pid < 0 || !Number.isSafeInteger(state.ExitCode) ||
      !['created','running','paused','restarting','removing','exited','dead'].includes(state.Status) ||
      !dockerBoundaryTimestamp(state.StartedAt) || !dockerBoundaryTimestamp(state.FinishedAt)) {
    throw gatewayError('gateway_boundary_unavailable');
  }
  const concerns = [];
  if (host.RestartPolicy?.Name !== 'no') concerns.push('restart_policy_not_disabled');
  if (host.Privileged !== false) concerns.push('privileged_or_unknown');
  if (host.PidMode !== '' || host.IpcMode !== 'private' || host.CgroupnsMode !== 'private') concerns.push('namespace_isolation_unconfirmed');
  if (host.ReadonlyRootfs !== true) concerns.push('writable_root');
  if (!Array.isArray(host.CapDrop) || !host.CapDrop.some(value => value.toUpperCase() === 'ALL') || host.CapAdd?.length) concerns.push('capabilities_not_restricted');
  if (!Array.isArray(host.SecurityOpt) || !host.SecurityOpt.some(value => ['no-new-privileges','no-new-privileges:true'].includes(value))) concerns.push('privilege_escalation_not_disabled');
  if (host.NetworkMode !== 'none') concerns.push('ingress_ownership_unproven');
  if (host.PublishAllPorts !== false || (host.PortBindings && Object.keys(host.PortBindings).length)) concerns.push('published_ingress');
  if (container.Mounts.length || host.VolumesFrom?.length) concerns.push('mounted_filesystem_requires_review');
  if (host.Devices?.length || host.DeviceRequests?.length || host.DeviceCgroupRules?.length) concerns.push('device_access_requires_review');
  const observation = state.Status === 'exited' && state.Pid === 0 && !state.Running && !state.Paused &&
    !state.Restarting && !state.Dead && !state.FinishedAt.startsWith('0001-') &&
    Date.parse(state.FinishedAt) >= Date.parse(state.StartedAt) ? 'stopped' : 'not_stopped';
  return { daemonIdHash: digest(info.ID),containerId: container.Id,imageId: container.Image,
    startedAt: state.StartedAt,finishedAt: state.FinishedAt,restartCount: container.RestartCount,
    pid: state.Pid,status: state.Status,running: state.Running,paused: state.Paused,
    restarting: state.Restarting,dead: state.Dead,oomKilled: state.OOMKilled,exitCode: state.ExitCode,
    observation,concerns,
    // Compare full relevant configuration without exposing paths, addresses, labels or credentials.
    configurationHash: digest(JSON.stringify([host,container.Mounts,container.NetworkSettings?.Networks])) };
}
