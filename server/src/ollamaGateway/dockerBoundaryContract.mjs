/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { posix } from 'node:path';
import { gatewayError } from './contract.mjs';

const hex = /^[a-f0-9]{64}$/;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const fractionalTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,9}Z$/;

export function dockerBoundaryTimestamp(value) {
  return typeof value === 'string' && (timestamp.test(value) || fractionalTimestamp.test(value)) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0,19) === value.slice(0,19);
}

export function dockerBoundaryConfiguration(input) {
  const fields = ['socketPath','daemonIdHash','containerId','imageId','startedAt'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== fields.length || fields.some(key => !Object.hasOwn(input,key)) ||
      typeof input.daemonIdHash !== 'string' || !hex.test(input.daemonIdHash) ||
      typeof input.containerId !== 'string' || !hex.test(input.containerId) ||
      typeof input.imageId !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(input.imageId) ||
      !dockerBoundaryTimestamp(input.startedAt) || input.startedAt.startsWith('0001-')) {
    throw gatewayError('gateway_boundary_config_invalid');
  }
  const path = input.socketPath;
  const localPipe = typeof path === 'string' && /^\\\\\.\\pipe\\[a-zA-Z0-9_-]{1,100}$/.test(path);
  const unixSocket = typeof path === 'string' && path.length <= 100 && /^\/[a-zA-Z0-9_./-]+$/.test(path) &&
    posix.normalize(path) === path && !path.endsWith('/') && !path.startsWith('//');
  if (!(process.platform === 'win32' ? localPipe : unixSocket)) throw gatewayError('gateway_boundary_config_invalid');
  return Object.freeze(Object.fromEntries(fields.map(key => [key,input[key]])));
}
