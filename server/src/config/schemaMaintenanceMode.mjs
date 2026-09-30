/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export function readSchemaMaintenanceMode(environment = process.env) {
  const mode = environment.CLASSIFARR_SCHEMA_MAINTENANCE ?? 'startup';
  if (mode !== 'startup' && mode !== 'external') {
    throw new Error('CLASSIFARR_SCHEMA_MAINTENANCE must be startup or external.');
  }
  return mode;
}
