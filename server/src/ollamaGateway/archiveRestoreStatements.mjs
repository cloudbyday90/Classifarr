/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ARCHIVE_TABLES } from './archiveTables.mjs';
import { catalogTables } from './catalogContract.mjs';
import { gatewayError } from './errors.mjs';

// Complete fixed statements only. Neither archived SQL nor caller identifiers are accepted.
const probes = Object.freeze({
  'ollama_gateway.admission': ['DELETE FROM ollama_gateway.admission WHERE false', 'UPDATE ollama_gateway.admission SET id=id WHERE false'],
  'ollama_gateway.request_binding': ['DELETE FROM ollama_gateway.request_binding WHERE false', 'UPDATE ollama_gateway.request_binding SET id=id WHERE false'],
  'ollama_gateway.completion_receipt': ['DELETE FROM ollama_gateway.completion_receipt WHERE false', 'UPDATE ollama_gateway.completion_receipt SET id=id WHERE false'],
  'ollama_gateway.recovery_receipt': ['DELETE FROM ollama_gateway.recovery_receipt WHERE false', 'UPDATE ollama_gateway.recovery_receipt SET id=id WHERE false'],
  'ollama_gateway.provider_stop_intent': ['DELETE FROM ollama_gateway.provider_stop_intent WHERE false', 'UPDATE ollama_gateway.provider_stop_intent SET id=id WHERE false'],
  'ollama_gateway.provider_stop_observation': ['DELETE FROM ollama_gateway.provider_stop_observation WHERE false', 'UPDATE ollama_gateway.provider_stop_observation SET id=id WHERE false'],
  'ollama_gateway.upstream_peer_observation': ['DELETE FROM ollama_gateway.upstream_peer_observation WHERE false', 'UPDATE ollama_gateway.upstream_peer_observation SET id=id WHERE false'],
  'gateway_archive.job': ['DELETE FROM gateway_archive.job WHERE false', 'UPDATE gateway_archive.job SET id=id WHERE false'],
  'gateway_archive.protection': ['DELETE FROM gateway_archive.protection WHERE false', 'UPDATE gateway_archive.protection SET id=id WHERE false'],
  'gateway_cleanup.operation': ['DELETE FROM gateway_cleanup.operation WHERE false', 'UPDATE gateway_cleanup.operation SET id=id WHERE false'],
  'gateway_catalog.job': ['DELETE FROM gateway_catalog.job WHERE false', 'UPDATE gateway_catalog.job SET id=id WHERE false'],
});
const disabled = Object.freeze([
  'ALTER TABLE gateway_archive.protection DISABLE TRIGGER archive_protection_guard',
  'ALTER TABLE gateway_archive.protection DISABLE TRIGGER archive_protection_fence',
  'ALTER TABLE gateway_archive.protection DISABLE TRIGGER protection_cleanup_exclusion',
  'ALTER TABLE gateway_archive.job DISABLE TRIGGER archive_job_protection_guard',
  'ALTER TABLE gateway_archive.job DISABLE TRIGGER archive_cleanup_exclusion',
]);
const enabled = Object.freeze([
  'ALTER TABLE gateway_archive.protection ENABLE TRIGGER archive_protection_guard',
  'ALTER TABLE gateway_archive.protection ENABLE TRIGGER archive_protection_fence',
  'ALTER TABLE gateway_archive.protection ENABLE TRIGGER protection_cleanup_exclusion',
  'ALTER TABLE gateway_archive.job ENABLE TRIGGER archive_job_protection_guard',
  'ALTER TABLE gateway_archive.job ENABLE TRIGGER archive_cleanup_exclusion',
]);
const forTable = table => {
  if (!Object.hasOwn(probes, table)) throw gatewayError('gateway_archive_restore_contract');
  return probes[table];
};

export function archiveDeletionProbes() {
  return Object.freeze(ARCHIVE_TABLES.filter(table => table !== 'admission').map(table => forTable('ollama_gateway.' + table)[0]));
}
export function catalogMutationDenialStatements(version) {
  return Object.freeze([...ARCHIVE_TABLES.map(table => 'ollama_gateway.' + table), ...catalogTables(version)].flatMap(forTable));
}
export function catalogGuardStatements(enable) {
  if (typeof enable !== 'boolean') throw gatewayError('gateway_archive_restore_contract');
  return enable ? enabled : disabled;
}
