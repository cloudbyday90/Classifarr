/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readOperatingMode } from '../config/operatingMode.mjs';
import { readSchemaMaintenanceMode } from '../config/schemaMaintenanceMode.mjs';

/** Admission only: no I/O, account changes, or invented runtime authority. */
export function assertEmbeddedStartupPolicy(environment) {
  readOperatingMode(environment);
  if (readSchemaMaintenanceMode(environment) !== 'startup') {
    throw new Error('embedded_external_schema_unsupported');
  }
  // This marker describes an inherited descriptor, not a user-configurable service.
  // The production supervisor does not attach the isolated broker yet.
  if (environment.CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL !== undefined || environment.CLASSIFARR_IMAGE_INDEX_CHANNEL !== undefined) {
    throw new Error('embedded_maintenance_channel_unsupported');
  }
}

const FAILURES = Object.freeze({
  'CLASSIFARR_RUNTIME_MODE must be normal or restore': 'CLASSIFARR_RUNTIME_MODE must be normal or restore; omit it for normal startup.',
  'CLASSIFARR_SCHEMA_MAINTENANCE must be startup or external.': 'CLASSIFARR_SCHEMA_MAINTENANCE must be startup for this embedded image; omit it for the default.',
  embedded_external_schema_unsupported: 'External schema maintenance is not supported by this embedded entrypoint. Keep startup mode until OS/authentication isolation is deployed.',
  embedded_maintenance_channel_unsupported: 'Remove CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL and CLASSIFARR_IMAGE_INDEX_CHANNEL from saved settings. These are internal inherited capabilities, not deployment settings.',
  embedded_nonroot_account_unavailable: 'The forced container UID has no named OS account. PostgreSQL cannot use this identity. Review the saved container user with the documented PUID/PGID setup; permissions were not expanded.',
});

export function embeddedStartupFailureMessage(error) {
  const message = Object.hasOwn(FAILURES, error?.message) ? FAILURES[error.message]
    : 'Check non-root PUID/PGID, UMASK, account collisions and container permissions; do not broaden privileges automatically.';
  return `Embedded startup refused before data ownership changes. ${message}\n`;
}
