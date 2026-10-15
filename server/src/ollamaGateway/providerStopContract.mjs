/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { dockerBoundaryConfiguration } from './dockerBoundaryContract.mjs';
import { gatewayDatabaseConfiguration } from './databaseConfiguration.mjs';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hex = /^[a-f0-9]{64}$/;
const match = (pattern,value) => typeof value === 'string' && !/[\r\n]/.test(value) && pattern.test(value);
const exact = (value,keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));

export function providerStopConfiguration(value) {
  if (!exact(value,['database','providerHash','requestId','boundary','networkId']) ||
      !match(hex,value.providerHash) || !match(hex,value.networkId) || !match(uuid,value.requestId)) {
    throw gatewayError('gateway_stop_config_invalid');
  }
  return Object.freeze({ database: gatewayDatabaseConfiguration(value.database),providerHash: value.providerHash,
    requestId: value.requestId,boundary: dockerBoundaryConfiguration(value.boundary),networkId: value.networkId });
}

export function providerStopReview(value) {
  const keys = ['bindingId','ownerId','attempts','configurationHash','networkHash'];
  const assertions = ['dedicatedProvider','exclusiveDockerControl','allOtherConsumersStopped','stopApproved'];
  if (!exact(value,['version','expected','operatorRef','evidenceRef','observedAt','assertions']) || value.version !== 1 ||
      !exact(value.expected,keys) || !match(uuid,value.expected.bindingId) || !match(uuid,value.expected.ownerId) ||
      !match(/^[1-9][0-9]{0,18}$/,value.expected.attempts) || BigInt(value.expected.attempts) > 9223372036854775807n ||
      !match(hex,value.expected.configurationHash) || !match(hex,value.expected.networkHash) ||
      !match(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/,value.operatorRef) ||
      !match(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/,value.evidenceRef) ||
      !match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,value.observedAt) ||
      !Number.isFinite(Date.parse(value.observedAt)) || new Date(value.observedAt).toISOString() !== value.observedAt ||
      !exact(value.assertions,assertions) || assertions.some(key => value.assertions[key] !== true)) {
    throw gatewayError('gateway_stop_review_invalid');
  }
  return value;
}
