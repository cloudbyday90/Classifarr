/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './contract.mjs';
import { gatewayDatabaseConfiguration } from './databaseConfiguration.mjs';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
const match = (pattern,value) => typeof value === 'string' && pattern.test(value);

export function gatewayRecoveryConfiguration(value) {
  if (!exact(value,['database','providerHash']) || !match(hash,value.providerHash)) throw gatewayError('gateway_config_invalid');
  return { database: gatewayDatabaseConfiguration(value.database),providerHash: value.providerHash };
}

export function gatewayRecoveryReview(value, action) {
  const stop = action === 'acknowledge-stop';
  const assertions = stop ? ['ingressIsolated','allProviderRunnersStopped','automaticRestartDisabled','administratorVerified'] :
    ['providerIsolationMaintained','controlledRestartReviewed','noRequestReplay','administratorVerified'];
  if (!['acknowledge-stop','resume'].includes(action) ||
      !exact(value,['version','action','expected','operatorRef','evidenceRef','observedAt','assertions']) ||
      value.version !== 1 || value.action !== action ||
      !match(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/,value.operatorRef) ||
      !match(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/,value.evidenceRef) ||
      !match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,value.observedAt) ||
      !Number.isFinite(Date.parse(value.observedAt)) || new Date(value.observedAt).toISOString() !== value.observedAt ||
      !exact(value.assertions,assertions) || !assertions.every(key => value.assertions[key] === true)) {
    throw gatewayError('gateway_recovery_review_invalid');
  }
  const expected = value.expected;
  if (!exact(expected,['ledgerId','providerHash','ownerId','requestId','attempts','maintenanceReceipt']) ||
      !match(uuid,expected.ledgerId) || !match(hash,expected.providerHash) || !match(uuid,expected.ownerId) ||
      !match(/^[1-9][0-9]{0,18}$/,expected.attempts) || BigInt(expected.attempts) > 9223372036854775807n ||
      (stop ? !match(uuid,expected.requestId) || expected.maintenanceReceipt !== null :
        expected.requestId !== null || !match(uuid,expected.maintenanceReceipt))) throw gatewayError('gateway_recovery_review_invalid');
  return value;
}

export function gatewayRecoverySnapshot(row) {
  return { ledgerId: row.id,providerHash: row.provider_hash,ownerId: row.owner_id,
    requestId: row.active_request,attempts: row.attempts,maintenanceReceipt: row.maintenance_receipt };
}
