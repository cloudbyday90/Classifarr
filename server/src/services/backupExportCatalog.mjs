/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { metadataProviderConfigQuery } from './metadataProviderConfigStore.mjs';

// Static queries only. Keep the version 2.0 data keys and count names stable.
const sections = [
  ['users', 'SELECT id, username, role, is_active, must_change_password, created_at FROM users ORDER BY id', 'usersCount'],
  ['mediaServers', 'SELECT id, type, name, url, api_key, is_active, created_at FROM media_server ORDER BY id', 'mediaServersCount'],
  ['radarrConfigs', 'SELECT * FROM radarr_config ORDER BY id'],
  ['sonarrConfigs', 'SELECT * FROM sonarr_config ORDER BY id'],
  ['libraries', 'SELECT * FROM libraries ORDER BY id', 'librariesCount'],
  ['libraryLabels', 'SELECT * FROM library_labels ORDER BY id'],
  ['libraryPolicies', 'SELECT * FROM library_policies ORDER BY id', 'policiesCount'],
  ['policyIntents', 'SELECT * FROM policy_intents ORDER BY id', 'policyIntentsCount'],
  ['policyIntentRules', 'SELECT * FROM policy_intent_rules ORDER BY id', 'policyIntentRulesCount'],
  ['policyIntentRoutingTargets', 'SELECT * FROM policy_intent_routing_targets ORDER BY id', 'policyIntentRoutingTargetsCount'],
  ['policyIntentTemplateApplications', 'SELECT * FROM policy_intent_template_applications ORDER BY id', 'policyIntentTemplateApplicationsCount'],
  ['policyIntentMigrationEvents', 'SELECT * FROM policy_intent_migration_events ORDER BY id', 'policyIntentMigrationEventsCount'],
  ['policyIntentRollbackSnapshots', 'SELECT * FROM policy_intent_rollback_snapshots ORDER BY id', 'policyIntentRollbackSnapshotsCount'],
  ['policyIntentValidationStatus', 'SELECT * FROM policy_intent_validation_status ORDER BY id', 'policyIntentValidationStatusCount'],
  ['policyInitialIntentEstablishments', 'SELECT * FROM policy_initial_intent_establishments ORDER BY id', 'policyInitialIntentEstablishmentsCount'],
  ['policyObservedEvidenceProvenanceSnapshots', 'SELECT * FROM policy_observed_evidence_provenance_snapshots ORDER BY id', 'policyObservedEvidenceProvenanceSnapshotsCount'],
  ['policyNativeIntentReconciliationRuns', 'SELECT * FROM policy_native_intent_reconciliation_runs ORDER BY id', 'policyNativeIntentReconciliationRunsCount'],
  ['policyNativeIntentReconciliationOutcomes', 'SELECT * FROM policy_native_intent_reconciliation_outcomes ORDER BY id', 'policyNativeIntentReconciliationOutcomesCount'],
  ['policyNativeIntentReconciliationStates', 'SELECT * FROM policy_native_intent_reconciliation_states ORDER BY policy_id', 'policyNativeIntentReconciliationStatesCount'],
  ['policyNativeIntentReconciliationHolds', 'SELECT * FROM policy_native_intent_reconciliation_holds ORDER BY policy_id', 'policyNativeIntentReconciliationHoldsCount'],
  ['libraryCustomRules', 'SELECT * FROM library_custom_rules ORDER BY id', 'customRulesCount'],
  ['labelPresets', 'SELECT * FROM label_presets ORDER BY id'],
  ['scheduledTasks', 'SELECT * FROM scheduled_tasks ORDER BY id'],
  ['confidenceSettings', 'SELECT * FROM confidence_settings ORDER BY setting_key'],
  ['autoLearnedPreferences', 'SELECT * FROM auto_learned_preferences WHERE status = $1 ORDER BY id', 'autoLearnedCount', ['active']],
  ['settings', 'SELECT * FROM settings ORDER BY id'],
  ['pathMappings', 'SELECT * FROM path_mappings ORDER BY id'],
];

const singletonSections = [
  ['ollamaConfig', 'SELECT * FROM ollama_config LIMIT 1'],
  ['tmdbConfig', metadataProviderConfigQuery('tmdb')],
  ['omdbConfig', metadataProviderConfigQuery('omdb')],
  ['webhookConfig', 'SELECT * FROM webhook_config LIMIT 1'],
];

export async function readBackupConfiguration(client) {
  const data = {};
  const meta = {};
  // Sequential reads ensure failure stops collection before another query starts.
  for (const [key, sql, countKey, params] of sections) {
    const { rows } = await client.query(sql, params);
    data[key] = key === 'users'
      ? rows.map(user => ({ ...user, password_hash: '<excluded>' }))
      : rows;
    if (countKey) meta[countKey] = rows.length;
  }
  for (const [key, sql] of singletonSections) {
    const { rows } = await client.query(sql);
    data[key] = rows[0] || null;
  }
  return { data, meta };
}
