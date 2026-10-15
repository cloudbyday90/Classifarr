/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { posix } from 'node:path';
import { gatewayError } from './contract.mjs';
import { providerInstanceTimestamp } from './providerInstance.mjs';

const hex = /^[a-f0-9]{64}$/;
export { providerInstanceTimestamp as dockerBoundaryTimestamp };

export function dockerBoundaryConfiguration(input) {
  const fields = ['socketPath','daemonIdHash','containerId','imageId','startedAt'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== fields.length || fields.some(key => !Object.hasOwn(input,key)) ||
      fields.some(key => typeof input[key] !== 'string' || input[key].includes('\n') || input[key].includes('\r')) ||
      typeof input.daemonIdHash !== 'string' || !hex.test(input.daemonIdHash) ||
      typeof input.containerId !== 'string' || !hex.test(input.containerId) ||
      typeof input.imageId !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(input.imageId) ||
      !providerInstanceTimestamp(input.startedAt) || input.startedAt.startsWith('0001-')) {
    throw gatewayError('gateway_boundary_config_invalid');
  }
  const path = input.socketPath;
  const localPipe = typeof path === 'string' && /^\\\\\.\\pipe\\[a-zA-Z0-9_-]{1,100}$/.test(path);
  const unixSocket = typeof path === 'string' && path.length <= 100 && /^\/[a-zA-Z0-9_./-]+$/.test(path) &&
    posix.normalize(path) === path && !path.endsWith('/') && !path.startsWith('//');
  if (!(process.platform === 'win32' ? localPipe : unixSocket)) throw gatewayError('gateway_boundary_config_invalid');
  return Object.freeze(Object.fromEntries(fields.map(key => [key,input[key]])));
}
