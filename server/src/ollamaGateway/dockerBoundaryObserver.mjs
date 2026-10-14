/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { dockerBoundaryConfiguration } from './dockerBoundaryContract.mjs';
import { createDockerBoundaryReader } from './dockerBoundaryReader.mjs';
import { projectDockerBoundary } from './dockerBoundaryProjection.mjs';

const blockers = ['dispatch_instance_binding_missing','exclusive_lifecycle_ownership_unproven','provider_scope_unproven'];
const result = (observation,extra = {}) => ({ evidenceKind: 'docker_observation',observation,
  recoveryAuthorized: false,blockers: [...blockers],...extra });

/** @param {unknown} input @param {{ signal?: AbortSignal }} options */
export async function observeDockerProviderBoundary(input,{ signal } = {}) {
  const config = dockerBoundaryConfiguration(input);
  const deadline = AbortSignal.timeout(10000);
  const bounded = signal ? AbortSignal.any([signal,deadline]) : deadline;
  const read = createDockerBoundaryReader(config,bounded);
  try {
    const version = await read('version');
    const minor = value => typeof value === 'string' && /^1\.\d{2,3}$/.test(value) ? Number(value.slice(2)) : NaN;
    if (!(minor(version.MinAPIVersion) <= 51 && minor(version.ApiVersion) >= 51)) return result('unavailable',{ code: 'docker_api_unsupported' });
    const first = projectDockerBoundary(await read('info'),await read('container'));
    const second = projectDockerBoundary(await read('info'),await read('container'));
    if (bounded.aborted) throw new Error();
    if (JSON.stringify(first) !== JSON.stringify(second) ||
        ['daemonIdHash','containerId','imageId','startedAt'].some(key => config[key] !== second[key])) {
      return result('changed',{ code: 'docker_boundary_changed' });
    }
    return result(second.observation,{ snapshot: second,observedAt: new Date().toISOString() });
  } catch {
    return result(signal?.aborted ? 'cancelled' : 'unavailable',{
      code: signal?.aborted ? 'docker_observation_cancelled' : 'docker_observation_unavailable',
    });
  }
}
