/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

export function providerInstanceTimestamp(value) {
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  const fractional = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,9}Z$/;
  return typeof value === 'string' && !/[\r\n]/.test(value) && (timestamp.test(value) || fractional.test(value)) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,19) === value.slice(0,19);
}

/** Configuration is a declaration, not live Docker or transport attestation. */
export function gatewayProviderInstance(value) {
  const keys = ['daemonIdHash','containerId','imageId','startedAt'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length ||
      keys.some(key => !Object.hasOwn(value,key) || typeof value[key] !== 'string' || /[\r\n]/.test(value[key])) ||
      !/^[a-f0-9]{64}$/.test(value.daemonIdHash) || !/^[a-f0-9]{64}$/.test(value.containerId) ||
      !/^sha256:[a-f0-9]{64}$/.test(value.imageId) || !providerInstanceTimestamp(value.startedAt) || value.startedAt.startsWith('0001-')) {
    throw gatewayError('gateway_config_invalid');
  }
  return Object.freeze(Object.fromEntries(keys.map(key => [key,value[key]])));
}
