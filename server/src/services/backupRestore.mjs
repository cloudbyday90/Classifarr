import { createLogger } from '../utils/logger.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { classificationEvidenceRepository } from './classificationEvidenceRepository.mjs';
import { generateApiKey } from './apiKeyService.mjs';
import {
  resetNativeIntentReconciliationSchedulingState,
} from './nativeIntentReconciliationLifecyclePersistence.mjs';
import {
  restoreConfidenceSettings,
  restoreMediaServers,
  restoreRadarrConfigs,
  restoreSonarrConfigs,
  restoreLibraries,
  restoreLibraryPolicies,
  restoreLibraryCustomRules,
  restoreLabelPresets,
  restoreScheduledTasks,
  restoreAutoLearnedPreferences,
  restoreLearningPatterns,
  restoreClassificationEvidence,
  restoreNativePolicyIntentStorage,
  restorePathMappings,
  restoreOllamaConfig,
  restoreTmdbConfig,
  restoreOmdbConfig,
  restoreAiConfig,
  restoreWebhookConfig,
  restoreSettings,
  restoreLibraryLabels
} from './backupRestoreTables.mjs';

const logger = createLogger('BackupRestore');

export async function clearExistingConfig(client) {
  // Refresh outbox rows describe runtime work rather than portable policy
  // configuration. Replace restore starts from a clean operational queue.
  await client.query('DELETE FROM policy_profile_refresh_outbox');
  await client.query('DELETE FROM policy_native_profile_refresh_circuits');
  // Runtime identity admissions are not user configuration. Their append-only
  // guard permits deletion only while a replace restore explicitly opts in.
  await client.query(
    "SELECT set_config('classifarr.policy_identity_evidence_admission_maintenance', 'replace_restore', true)"
  );
  await client.query('DELETE FROM policy_identity_evidence_admissions');
  // Runtime idempotency receipts must not survive a replace restore. The
  // database guard permits this one transaction-local maintenance action only.
  await client.query(
    "SELECT set_config('classifarr.policy_authorized_outcome_receipt_maintenance', 'replace_restore', true)"
  );
  await client.query('DELETE FROM policy_authorized_outcome_source_event_receipts');
  await client.query(
    "SELECT set_config('classifarr.policy_migration_verification_run_maintenance', 'replace_restore', true)"
  );
  await client.query('DELETE FROM policy_native_intent_reconciliation_states');
  await client.query('DELETE FROM policy_native_intent_reconciliation_outcomes');
  await client.query('DELETE FROM policy_native_intent_reconciliation_runs');
  await client.query('DELETE FROM policy_native_intent_reconciliation_holds');
  await client.query('DELETE FROM policy_observed_evidence_provenance_snapshots');
  await client.query('DELETE FROM policy_initial_intent_establishments');
  await client.query('DELETE FROM policy_intent_validation_status');
  await client.query('DELETE FROM policy_library_rebuild_execution_gates');
  await client.query('DELETE FROM policy_migration_verification_runs');
  await client.query('DELETE FROM policy_intent_rollback_snapshots');
  await client.query('DELETE FROM policy_intent_migration_events');
  await client.query('DELETE FROM policy_intent_template_applications');
  await client.query('DELETE FROM policy_intent_routing_targets');
  await client.query('DELETE FROM policy_intent_rules');
  await client.query('DELETE FROM policy_intents');
  await client.query('DELETE FROM library_custom_rules');
  await client.query('DELETE FROM library_labels');
  await client.query('DELETE FROM library_policies');
  await client.query('DELETE FROM auto_learned_preferences');
  await classificationEvidenceService.purgeAllLegacyPatterns({ client, actor: 'backup_restore', reason: 'replace_mode' });
  await classificationEvidenceRepository.purgeAll({ client });
  await client.query('DELETE FROM scheduled_tasks');
  await client.query('DELETE FROM path_mappings');
  await client.query('DELETE FROM label_presets');
  await client.query('DELETE FROM libraries WHERE id > 0');
  await client.query('DELETE FROM radarr_config');
  await client.query('DELETE FROM sonarr_config');
  await client.query('DELETE FROM media_server');
  logger.info('Cleared existing configuration');
}

export async function restoreAllTables(client, backupData, mode) {
  if (mode === 'replace') {
    await clearExistingConfig(client);
  }

  await restoreConfidenceSettings(client, backupData.data.confidenceSettings);
  await restoreMediaServers(client, backupData.data.mediaServers);
  await restoreRadarrConfigs(client, backupData.data.radarrConfigs);
  await restoreSonarrConfigs(client, backupData.data.sonarrConfigs);

  const libraryIdMap = await restoreLibraries(client, backupData.data.libraries);

  const policyIdMap = await restoreLibraryPolicies(client, backupData.data.libraryPolicies, libraryIdMap);
  const nativePolicyIntentStats = await restoreNativePolicyIntentStorage(
    client,
    {
      policyIntents: backupData.data.policyIntents,
      policyIntentRules: backupData.data.policyIntentRules,
      policyIntentRoutingTargets: backupData.data.policyIntentRoutingTargets,
      policyIntentTemplateApplications: backupData.data.policyIntentTemplateApplications,
      policyIntentMigrationEvents: backupData.data.policyIntentMigrationEvents,
      policyIntentRollbackSnapshots: backupData.data.policyIntentRollbackSnapshots,
      policyIntentValidationStatus: backupData.data.policyIntentValidationStatus,
      policyInitialIntentEstablishments:
        backupData.data.policyInitialIntentEstablishments,
      policyObservedEvidenceProvenanceSnapshots:
        backupData.data.policyObservedEvidenceProvenanceSnapshots,
      policyNativeIntentReconciliationRuns:
        backupData.data.policyNativeIntentReconciliationRuns,
      policyNativeIntentReconciliationOutcomes:
        backupData.data.policyNativeIntentReconciliationOutcomes,
      policyNativeIntentReconciliationStates:
        backupData.data.policyNativeIntentReconciliationStates,
      policyNativeIntentReconciliationHolds:
        backupData.data.policyNativeIntentReconciliationHolds,
    },
    { policyIdMap, libraryIdMap }
  );
  const reconciliationSchedulingStatesDiscarded =
    await resetNativeIntentReconciliationSchedulingState({ client });
  await restoreLibraryCustomRules(client, backupData.data.libraryCustomRules, libraryIdMap);
  await restoreLabelPresets(client, backupData.data.labelPresets);
  await restoreScheduledTasks(client, backupData.data.scheduledTasks, libraryIdMap);
  await restoreAutoLearnedPreferences(client, backupData.data.autoLearnedPreferences, libraryIdMap);
  await restoreLearningPatterns(client, backupData.data.learningPatterns, libraryIdMap);
  await restoreClassificationEvidence(client, backupData.data.classificationEvidence, libraryIdMap);
  await restorePathMappings(client, backupData.data.pathMappings);
  await restoreOllamaConfig(client, backupData.data.ollamaConfig);
  await restoreTmdbConfig(client, backupData.data.tmdbConfig);
  await restoreOmdbConfig(client, backupData.data.omdbConfig);
  await restoreAiConfig(client, backupData.data.aiConfig);
  await restoreWebhookConfig(client, backupData.data.webhookConfig);
  await restoreSettings(client, backupData.data.settings);
  await restoreLibraryLabels(client, backupData.data.libraryLabels, libraryIdMap);

  const { key: newApiKey, keyHash: apiKeyHash, prefix: apiKeyPrefix } = generateApiKey();

  await client.query(
    `INSERT INTO api_keys (name, key_hash, key_prefix, permissions, is_active)
     VALUES ($1, $2, $3, $4, $5)`,
    ['Restored System API Key', apiKeyHash, apiKeyPrefix, 'admin', true]
  );

  return {
    newApiKey,
    stats: {
      librariesRestored: backupData.data.libraries?.length || 0,
      policiesRestored: backupData.data.libraryPolicies?.length || 0,
      policyIntentsRestored: nativePolicyIntentStats.intentsRestored,
      policyIntentRulesRestored: nativePolicyIntentStats.intentRulesRestored,
      policyIntentRoutingTargetsRestored: nativePolicyIntentStats.routingTargetsRestored,
      policyIntentTemplateApplicationsRestored: nativePolicyIntentStats.templateApplicationsRestored,
      policyIntentMigrationEventsRestored: nativePolicyIntentStats.migrationEventsRestored,
      policyIntentRollbackSnapshotsRestored: nativePolicyIntentStats.rollbackSnapshotsRestored,
      policyIntentValidationStatusRestored: nativePolicyIntentStats.validationStatusesRestored,
      policyInitialIntentEstablishmentsRestored:
        nativePolicyIntentStats.initialIntentEstablishmentsRestored,
      policyObservedEvidenceProvenanceSnapshotsRestored:
        nativePolicyIntentStats.observedEvidenceProvenanceSnapshotsRestored,
      policyNativeIntentReconciliationRunsRestored:
        nativePolicyIntentStats.reconciliationRunsRestored,
      policyNativeIntentReconciliationOutcomesRestored:
        nativePolicyIntentStats.reconciliationOutcomesRestored,
      policyNativeIntentReconciliationStatesRestored:
        nativePolicyIntentStats.reconciliationStatesRestored,
      policyNativeIntentReconciliationStatesDiscarded:
        nativePolicyIntentStats.reconciliationStatesDiscarded +
        reconciliationSchedulingStatesDiscarded,
      policyNativeIntentReconciliationHoldsRestored:
        nativePolicyIntentStats.reconciliationHoldsRestored,
      policyNativeIntentReconciliationHoldsRehydrated:
        nativePolicyIntentStats.reconciliationHoldsRehydrated,
      rulesRestored: backupData.data.libraryCustomRules?.length || 0,
      patternsRestored: backupData.data.learningPatterns?.length || 0,
      classificationEvidenceRestored: backupData.data.classificationEvidence?.length || 0
    }
  };
}
