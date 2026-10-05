/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const migration = '20261005_180000_ingestion_compatibility_fence.sql'
const tables = new Set(['media_server_items', 'media_server_sync_status', 'media_source_capture_state',
  'library_ingestion_state', 'media_source_observations', 'media_server_collections'])
const triggers = new Set(['ingestion_compatibility_rows', 'ingestion_compatibility_truncate'])
const labels = Object.freeze({ missing: 'missing', not_always_enabled: 'not enabled for all writes', definition_mismatch: 'does not match the required definition' })
const unavailable = () => ({ title: 'Setup check unavailable', facts: [], steps: ['Refresh status. If the check stays unavailable, open System logs and report the library import error.'] })

export function libraryRecoveryDeployment(diagnostic) {
  if (!diagnostic || diagnostic.migration !== migration || !Array.isArray(diagnostic.checks) ||
    typeof diagnostic.protocolReady !== 'boolean' || typeof diagnostic.migrationRecorded !== 'boolean' ||
    diagnostic.checks.length > 12 || !diagnostic.checks.every(check => check && tables.has(check.table) &&
      triggers.has(check.trigger) && Object.hasOwn(labels, check.status))) {
    return unavailable()
  }
  const facts = [...new Set(diagnostic.checks.map(check => `${check.table} / ${check.trigger}: ${labels[check.status]}.`))]
  const steps = []
  if (!diagnostic.protocolReady) {
    facts.unshift('This database connection is not using the current import protocol.')
    steps.push('Update and restart this Classifarr instance using its normal startup command. If this check persists, report it with your image version; do not force an import.')
  }
  if (!diagnostic.migrationRecorded) {
    facts.push(`Required database update is not recorded: ${migration}.`)
    steps.push('Back up the database. For the bundled database, leave CLASSIFARR_SCHEMA_MAINTENANCE unset or set to startup, then restart Classifarr. For separately managed migrations, ask the database administrator to apply the named update.')
    steps.push('If startup fails, find the filename below in the container logs and resolve that error before retrying. The missing record alone does not tell us why the update was not applied.')
  } else if (diagnostic.checks.length) {
    facts.push(`The database records ${migration} as applied, but its safeguards do not match.`)
    if (diagnostic.checks.every(check => check.status === 'not_always_enabled')) {
      steps.push('Open the library and choose Check repair options. Classifarr will verify whether it can back up the database and repair these safeguards. Review and confirm before anything changes.')
    } else {
      steps.push('Back up the database and report the missing or changed safeguards listed below for a reviewed repair. Restarting alone will not recreate them.')
    }
    steps.push('Do not delete the migration record or rerun the original update; it is already recorded as applied.')
  }
  if (!steps.length) return unavailable()
  return { title: !diagnostic.migrationRecorded ? 'Database update not recorded' : !diagnostic.protocolReady ? 'Import connection needs an update' : 'Database safeguards need repair', facts, steps }
}
