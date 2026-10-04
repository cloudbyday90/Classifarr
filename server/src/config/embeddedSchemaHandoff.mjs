/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readOperatingMode } from './operatingMode.mjs';
import { readSchemaMaintenanceMode } from './schemaMaintenanceMode.mjs';

/** Routing hint only: callers must independently verify the database ledger. */
export function hasEmbeddedSchemaHandoff(environment = process.env) {
  const value = environment.CLASSIFARR_EMBEDDED_SCHEMA_HANDOFF;
  if (value === undefined) return false;
  if (value !== 'supervised-v1' || readOperatingMode(environment) !== 'normal'
    || readSchemaMaintenanceMode(environment) !== 'startup') throw new Error('embedded_schema_handoff_invalid');
  return true;
}
