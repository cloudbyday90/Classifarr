import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { classificationEvidenceRepository } from './classificationEvidenceRepository.mjs';

const RADARR_ALLOWED_COLUMNS = ['name', 'url', 'api_key', 'is_active', 'quality_profile_id', 'root_folder_path', 'monitored', 'search_on_add'];
const SONARR_ALLOWED_COLUMNS = ['name', 'url', 'api_key', 'is_active', 'quality_profile_id', 'root_folder_path', 'monitored', 'search_on_add', 'season_folder'];
const LIBRARY_ALLOWED_COLUMNS = ['name', 'media_type', 'media_server_id', 'external_id', 'is_active'];

export async function restoreConfidenceSettings(client, settings) {
  if (!settings) return;
  for (const setting of settings) {
    await client.query(
      `INSERT INTO confidence_settings (setting_key, setting_value, description, default_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (setting_key) DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         description = EXCLUDED.description,
         default_value = EXCLUDED.default_value`,
      [setting.setting_key, setting.setting_value, setting.description, setting.default_value]
    );
  }
}

export async function restoreMediaServers(client, servers) {
  if (!servers) return;
  for (const server of servers) {
    await client.query(
      `INSERT INTO media_server (type, name, url, api_key, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [server.type, server.name, server.url, server.api_key, server.is_active]
    );
  }
}

export async function restoreRadarrConfigs(client, configs) {
  if (!configs) return;
  for (const config of configs) {
    const { id: _id, created_at: _created_at, updated_at: _updated_at, last_sync: _last_sync, ...data } = config;
    const keys = Object.keys(data).filter(key => RADARR_ALLOWED_COLUMNS.includes(key));
    const values = keys.map(key => data[key]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    if (keys.length > 0) {
      await client.query(
        `INSERT INTO radarr_config (${keys.join(', ')}) VALUES (${placeholders})
         ON CONFLICT DO NOTHING`,
        values
      );
    }
  }
}

export async function restoreSonarrConfigs(client, configs) {
  if (!configs) return;
  for (const config of configs) {
    const { id: _id, created_at: _created_at, updated_at: _updated_at, last_sync: _last_sync, ...data } = config;
    const keys = Object.keys(data).filter(key => SONARR_ALLOWED_COLUMNS.includes(key));
    const values = keys.map(key => data[key]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    if (keys.length > 0) {
      await client.query(
        `INSERT INTO sonarr_config (${keys.join(', ')}) VALUES (${placeholders})
         ON CONFLICT DO NOTHING`,
        values
      );
    }
  }
}

export async function restoreLibraries(client, libraries) {
  const libraryIdMap = new Map();
  if (!libraries) return libraryIdMap;

  for (const library of libraries) {
    const { id: oldId, created_at: _created_at, updated_at: _updated_at, last_sync: _last_sync, ...data } = library;
    const keys = Object.keys(data).filter(key => LIBRARY_ALLOWED_COLUMNS.includes(key));
    const values = keys.map(key => data[key]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    if (keys.length > 0) {
      const updateClauses = keys.filter(k => k !== 'name' && k !== 'media_type').map(k => `${k} = EXCLUDED.${k}`).join(', ');
      const result = await client.query(
        `INSERT INTO libraries (${keys.join(', ')}) VALUES (${placeholders})
         ON CONFLICT (name, media_type) DO UPDATE SET ${updateClauses}
         RETURNING id`,
        values
      );
      libraryIdMap.set(oldId, result.rows[0].id);
    }
  }

  return libraryIdMap;
}

const POLICY_ALLOWED_COLUMNS = [
  'name', 'description', 'enabled', 'priority', 'sort_order',
  'auto_classify_threshold', 'prompt_threshold', 'require_ai_validation',
  'trust_patterns', 'trust_rag', 'trust_history', 'preset_weight',
  'pattern_weight', 'rag_weight', 'history_weight', 'combination_mode',
  'exclusive', 'created_by', 'profile_weight',
];
const POLICY_JSONB_COLUMNS = new Set(['notify_channels', 'source_library_ids']);

export async function restoreLibraryPolicies(client, policies, libraryIdMap) {
  const policyIdMap = new Map();
  if (!policies) return policyIdMap;

  for (const policy of policies) {
    const newLibraryId = libraryIdMap.get(policy.library_id);
    if (!newLibraryId) continue;

    const { id: oldId, library_id: _library_id, created_at: _created_at, updated_at: _updated_at, ...data } = policy;
    const keys = Object.keys(data).filter(key => POLICY_ALLOWED_COLUMNS.includes(key) || POLICY_JSONB_COLUMNS.has(key));
    const values = keys.map(key => {
      const val = data[key];
      if (POLICY_JSONB_COLUMNS.has(key) && val != null && typeof val !== 'string') return JSON.stringify(val);
      return val;
    });
    const placeholders = keys.map((_, i) => `$${i + 2}`).join(', ');

    if (keys.length > 0) {
      const updateClauses = keys.filter(k => k !== 'name').map(k => `${k} = EXCLUDED.${k}`).join(', ');
      const result = await client.query(
        `INSERT INTO library_policies (library_id, ${keys.join(', ')}) VALUES ($1, ${placeholders})
         ON CONFLICT (library_id) DO UPDATE SET ${updateClauses}
         RETURNING id`,
        [newLibraryId, ...values]
      );
      if (oldId !== undefined && oldId !== null && result.rows[0]?.id !== undefined) {
        policyIdMap.set(oldId, result.rows[0].id);
      }
    }
  }

  return policyIdMap;
}

const POLICY_INTENT_ALLOWED_COLUMNS = [
  'schema_version', 'intent_version', 'active', 'source', 'inference_state',
  'review_behavior', 'validation_status', 'created_at', 'updated_at',
  'accepted_at',
];
const POLICY_INTENT_JSONB_COLUMNS = new Set(['review_behavior']);

const POLICY_INTENT_RULE_ALLOWED_COLUMNS = [
  'intent_role', 'collection', 'signal_type', 'operator', 'values',
  'constraint_mode', 'semantics', 'source', 'inference_state', 'sort_order',
  'created_at',
];
const POLICY_INTENT_RULE_JSONB_COLUMNS = new Set(['values']);

const POLICY_INTENT_ROUTING_TARGET_ALLOWED_COLUMNS = [
  'arr_type', 'arr_config_id', 'arr_root_folder_id', 'arr_root_folder_path',
  'quality_profile_id', 'target_status', 'created_at', 'updated_at',
];

const POLICY_INTENT_TEMPLATE_APPLICATION_ALLOWED_COLUMNS = [
  'preset_id', 'preset_key', 'preset_name', 'weight', 'signal_count',
  'link_state', 'applied_at',
];

const POLICY_INTENT_MIGRATION_EVENT_ALLOWED_COLUMNS = [
  'event_type', 'actor_type', 'actor_id', 'source_version', 'target_version',
  'reason_code', 'summary', 'metadata', 'created_at',
];
const POLICY_INTENT_MIGRATION_EVENT_JSONB_COLUMNS = new Set(['metadata']);

const POLICY_INTENT_ROLLBACK_SNAPSHOT_ALLOWED_COLUMNS = [
  'snapshot_version', 'snapshot_payload', 'payload_redacted', 'restore_path',
  'expires_at', 'created_at', 'restored_at',
];
const POLICY_INTENT_ROLLBACK_SNAPSHOT_JSONB_COLUMNS = new Set(['snapshot_payload']);

const POLICY_INTENT_VALIDATION_STATUS_ALLOWED_COLUMNS = [
  'schema_version', 'status', 'validator_version', 'error_count',
  'warning_count', 'errors', 'warnings', 'validated_at',
];
const POLICY_INTENT_VALIDATION_STATUS_JSONB_COLUMNS = new Set(['errors', 'warnings']);

const POLICY_INITIAL_INTENT_ESTABLISHMENT_ALLOWED_COLUMNS = [
  'idempotency_key', 'request_fingerprint', 'authority_source_id', 'accepted_by',
  'state', 'established_at', 'created_at', 'updated_at',
];

const POLICY_NATIVE_INTENT_RECONCILIATION_RUN_ALLOWED_COLUMNS = [
  'reconciler_version', 'run_state', 'source_status_id', 'reason_id',
  'started_at', 'finished_at', 'candidate_count', 'converted_count',
  'already_native_count', 'deferred_count', 'blocked_count', 'failed_count',
  'created_at',
];

const POLICY_NATIVE_INTENT_RECONCILIATION_OUTCOME_ALLOWED_COLUMNS = [
  'candidate_fingerprint', 'candidate_status_id', 'outcome_state', 'reason_id',
  'retry_not_before', 'evaluated_at', 'created_at',
];

const POLICY_NATIVE_INTENT_RECONCILIATION_HOLD_ALLOWED_COLUMNS = [
  'hold_state', 'reason_id', 'held_at', 'released_at', 'release_reason_id', 'updated_at',
];

function normalizeJsonbValue(value) {
  if (value == null || typeof value === 'string') return value;
  return JSON.stringify(value);
}

function buildAllowedColumnValues(row, allowedColumns, jsonbColumns = new Set()) {
  const keys = Object.keys(row).filter(key => allowedColumns.includes(key));
  const values = keys.map(key => (
    jsonbColumns.has(key) ? normalizeJsonbValue(row[key]) : row[key]
  ));

  return { keys, values };
}

async function insertNativeChildRows({
  client,
  tableName,
  rows = [],
  intentIdMap,
  allowedColumns,
  jsonbColumns = new Set(),
}) {
  let restoredCount = 0;

  for (const row of rows || []) {
    const newIntentId = intentIdMap.get(row.intent_id);
    if (!newIntentId) continue;

    const { keys, values } = buildAllowedColumnValues(row, allowedColumns, jsonbColumns);
    if (keys.length === 0) continue;

    const placeholders = keys.map((_, index) => `$${index + 2}`).join(', ');
    await client.query(
      `INSERT INTO ${tableName} (intent_id, ${keys.join(', ')})
       VALUES ($1, ${placeholders})
       ON CONFLICT DO NOTHING`,
      [newIntentId, ...values]
    );
    restoredCount += 1;
  }

  return restoredCount;
}

async function restorePolicyIntents(client, policyIntents, { policyIdMap, libraryIdMap }) {
  const intentIdMap = new Map();
  const pendingReplacements = [];

  for (const intent of policyIntents || []) {
    const newPolicyId = policyIdMap.get(intent.policy_id);
    const newLibraryId = libraryIdMap.get(intent.library_id);
    if (!newPolicyId || !newLibraryId) continue;

    const {
      id: oldIntentId,
      policy_id: _policy_id,
      library_id: _library_id,
      replaced_by_intent_id: replacedByIntentId,
      created_by: _created_by,
      accepted_by: _accepted_by,
      ...data
    } = intent;
    const { keys, values } = buildAllowedColumnValues(
      data,
      POLICY_INTENT_ALLOWED_COLUMNS,
      POLICY_INTENT_JSONB_COLUMNS
    );
    if (keys.length === 0) continue;

    const placeholders = keys.map((_, index) => `$${index + 3}`).join(', ');
    const result = await client.query(
      `INSERT INTO policy_intents (policy_id, library_id, ${keys.join(', ')})
       VALUES ($1, $2, ${placeholders})
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [newPolicyId, newLibraryId, ...values]
    );

    let newIntentId = result.rows[0]?.id ?? null;
    if (!newIntentId) {
      const existing = await client.query(
        `SELECT id
         FROM policy_intents
         WHERE policy_id = $1
           AND intent_version = $2
           AND active IS NOT DISTINCT FROM $3
         ORDER BY id
         LIMIT 1`,
        [newPolicyId, intent.intent_version ?? 1, intent.active ?? true]
      );
      newIntentId = existing.rows[0]?.id ?? null;
    }

    if (!newIntentId) {
      throw new Error(
        `Native policy intent restore conflict for policy ${newPolicyId}; active intent authority cannot be resolved without losing a backup row.`
      );
    }

    if (oldIntentId !== undefined && oldIntentId !== null) {
      intentIdMap.set(oldIntentId, newIntentId);
      if (replacedByIntentId !== undefined && replacedByIntentId !== null) {
        pendingReplacements.push({ newIntentId, replacedByIntentId });
      }
    }
  }

  for (const replacement of pendingReplacements) {
    const newReplacementId = intentIdMap.get(replacement.replacedByIntentId);
    if (!newReplacementId) continue;

    await client.query(
      'UPDATE policy_intents SET replaced_by_intent_id = $1 WHERE id = $2',
      [newReplacementId, replacement.newIntentId]
    );
  }

  return intentIdMap;
}

export async function restoreNativePolicyIntentStorage(client, nativeStorage = {}, mappings = {}) {
  const policyIdMap = mappings.policyIdMap || new Map();
  const libraryIdMap = mappings.libraryIdMap || new Map();
  const intentIdMap = await restorePolicyIntents(client, nativeStorage.policyIntents, {
    policyIdMap,
    libraryIdMap,
  });
  const stats = {
    intentsRestored: intentIdMap.size,
    intentRulesRestored: 0,
    routingTargetsRestored: 0,
    templateApplicationsRestored: 0,
    migrationEventsRestored: 0,
    rollbackSnapshotsRestored: 0,
    validationStatusesRestored: 0,
    initialIntentEstablishmentsRestored: 0,
    reconciliationRunsRestored: 0,
    reconciliationOutcomesRestored: 0,
    reconciliationStatesRestored: 0,
    reconciliationStatesDiscarded: Array.isArray(nativeStorage.policyNativeIntentReconciliationStates)
      ? nativeStorage.policyNativeIntentReconciliationStates.length
      : 0,
    reconciliationHoldsRestored: 0,
    reconciliationHoldsRehydrated: 0,
  };

  stats.intentRulesRestored = await insertNativeChildRows({
    client,
    tableName: 'policy_intent_rules',
    rows: nativeStorage.policyIntentRules,
    intentIdMap,
    allowedColumns: POLICY_INTENT_RULE_ALLOWED_COLUMNS,
    jsonbColumns: POLICY_INTENT_RULE_JSONB_COLUMNS,
  });

  for (const row of nativeStorage.policyIntentRoutingTargets || []) {
    const newIntentId = intentIdMap.get(row.intent_id);
    const newLibraryId = libraryIdMap.get(row.library_id);
    if (!newIntentId || !newLibraryId) continue;

    const { keys, values } = buildAllowedColumnValues(
      row,
      POLICY_INTENT_ROUTING_TARGET_ALLOWED_COLUMNS
    );
    if (keys.length === 0) continue;

    const placeholders = keys.map((_, index) => `$${index + 3}`).join(', ');
    await client.query(
      `INSERT INTO policy_intent_routing_targets (intent_id, library_id, ${keys.join(', ')})
       VALUES ($1, $2, ${placeholders})
       ON CONFLICT DO NOTHING`,
      [newIntentId, newLibraryId, ...values]
    );
    stats.routingTargetsRestored += 1;
  }

  stats.templateApplicationsRestored = await insertNativeChildRows({
    client,
    tableName: 'policy_intent_template_applications',
    rows: nativeStorage.policyIntentTemplateApplications,
    intentIdMap,
    allowedColumns: POLICY_INTENT_TEMPLATE_APPLICATION_ALLOWED_COLUMNS,
  });

  const migrationEventIdMap = new Map();
  const rollbackEventsByPolicyId = new Map();
  for (const event of nativeStorage.policyIntentMigrationEvents || []) {
    const newPolicyId = policyIdMap.get(event.policy_id);
    if (!newPolicyId) continue;

    const newIntentId = event.intent_id == null ? null : (intentIdMap.get(event.intent_id) ?? null);
    const { keys, values } = buildAllowedColumnValues(
      event,
      POLICY_INTENT_MIGRATION_EVENT_ALLOWED_COLUMNS,
      POLICY_INTENT_MIGRATION_EVENT_JSONB_COLUMNS
    );
    if (keys.length === 0) continue;

    const placeholders = keys.map((_, index) => `$${index + 3}`).join(', ');
    const result = await client.query(
      `INSERT INTO policy_intent_migration_events (intent_id, policy_id, ${keys.join(', ')})
       VALUES ($1, $2, ${placeholders})
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [newIntentId, newPolicyId, ...values]
    );
    const restoredEventId = result.rows[0]?.id ?? null;
    if (restoredEventId && event.id != null) {
      migrationEventIdMap.set(event.id, restoredEventId);
    }
    if (event.event_type === 'rollback_applied' && restoredEventId) {
      rollbackEventsByPolicyId.set(newPolicyId, restoredEventId);
    }
    stats.migrationEventsRestored += 1;
  }

  const restoredHoldPolicyIds = new Set();
  for (const hold of nativeStorage.policyNativeIntentReconciliationHolds || []) {
    const restoredPolicyId = policyIdMap.get(hold.policy_id);
    const sourceEventId = migrationEventIdMap.get(hold.source_event_id);
    const releasedEventId = hold.released_event_id == null
      ? null
      : migrationEventIdMap.get(hold.released_event_id);
    if (!restoredPolicyId || !sourceEventId) continue;
    if (hold.hold_state === 'released' && !releasedEventId) continue;

    const { keys, values } = buildAllowedColumnValues(
      hold,
      POLICY_NATIVE_INTENT_RECONCILIATION_HOLD_ALLOWED_COLUMNS,
    );
    const columnNames = ['policy_id', 'source_event_id', ...keys];
    const parameters = [restoredPolicyId, sourceEventId, ...values];
    if (releasedEventId) {
      columnNames.push('released_event_id');
      parameters.push(releasedEventId);
    }
    const placeholders = parameters.map((_, index) => `$${index + 1}`).join(', ');
    await client.query(
      `INSERT INTO policy_native_intent_reconciliation_holds (${columnNames.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (policy_id) DO NOTHING`,
      parameters,
    );
    restoredHoldPolicyIds.add(restoredPolicyId);
    stats.reconciliationHoldsRestored += 1;
  }

  // Older backups predate the holds table. A rollback event still represents a
  // deliberate operator decision, so rehydrate its active hold fail-closed.
  for (const [restoredPolicyId, sourceEventId] of rollbackEventsByPolicyId) {
    if (restoredHoldPolicyIds.has(restoredPolicyId)) continue;
    await client.query(
      `INSERT INTO policy_native_intent_reconciliation_holds (
         policy_id, source_event_id, hold_state, reason_id, held_at, updated_at
       )
       VALUES ($1, $2, 'active', 'rollback_applied', NOW(), NOW())
       ON CONFLICT (policy_id) DO NOTHING`,
      [restoredPolicyId, sourceEventId],
    );
    stats.reconciliationHoldsRehydrated += 1;
  }

  const rollbackSnapshotIdMap = new Map();
  for (const snapshot of nativeStorage.policyIntentRollbackSnapshots || []) {
    const newIntentId = intentIdMap.get(snapshot.intent_id);
    const newPolicyId = policyIdMap.get(snapshot.policy_id);
    if (!newIntentId || !newPolicyId) continue;

    const { keys, values } = buildAllowedColumnValues(
      snapshot,
      POLICY_INTENT_ROLLBACK_SNAPSHOT_ALLOWED_COLUMNS,
      POLICY_INTENT_ROLLBACK_SNAPSHOT_JSONB_COLUMNS
    );
    if (keys.length === 0) continue;

    const placeholders = keys.map((_, index) => `$${index + 3}`).join(', ');
    const result = await client.query(
      `INSERT INTO policy_intent_rollback_snapshots (intent_id, policy_id, ${keys.join(', ')})
       VALUES ($1, $2, ${placeholders})
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [newIntentId, newPolicyId, ...values]
    );
    const restoredSnapshotId = result.rows[0]?.id ?? null;
    if (restoredSnapshotId && snapshot.id != null) {
      rollbackSnapshotIdMap.set(snapshot.id, restoredSnapshotId);
    }
    stats.rollbackSnapshotsRestored += 1;
  }

  stats.validationStatusesRestored = await insertNativeChildRows({
    client,
    tableName: 'policy_intent_validation_status',
    rows: nativeStorage.policyIntentValidationStatus,
    intentIdMap,
    allowedColumns: POLICY_INTENT_VALIDATION_STATUS_ALLOWED_COLUMNS,
    jsonbColumns: POLICY_INTENT_VALIDATION_STATUS_JSONB_COLUMNS,
  });

  for (const establishment of nativeStorage.policyInitialIntentEstablishments || []) {
    const newPolicyId = policyIdMap.get(establishment.policy_id);
    const newLibraryId = libraryIdMap.get(establishment.library_id);
    const newIntentId = intentIdMap.get(establishment.intent_id);
    const newMigrationEventId = migrationEventIdMap.get(establishment.migration_event_id);
    const newRollbackSnapshotId = rollbackSnapshotIdMap.get(establishment.rollback_snapshot_id);
    if (!newPolicyId || !newLibraryId || !newIntentId || !newMigrationEventId || !newRollbackSnapshotId) {
      continue;
    }

    const { keys, values } = buildAllowedColumnValues(
      establishment,
      POLICY_INITIAL_INTENT_ESTABLISHMENT_ALLOWED_COLUMNS,
    );
    if (keys.length === 0) continue;

    const placeholders = keys.map((_, index) => `$${index + 6}`).join(', ');
    await client.query(
      `INSERT INTO policy_initial_intent_establishments (
         policy_id,
         library_id,
         intent_id,
         migration_event_id,
         rollback_snapshot_id,
         ${keys.join(', ')}
       )
       VALUES ($1, $2, $3, $4, $5, ${placeholders})
       ON CONFLICT DO NOTHING`,
      [
        newPolicyId,
        newLibraryId,
        newIntentId,
        newMigrationEventId,
        newRollbackSnapshotId,
        ...values,
      ]
    );
    stats.initialIntentEstablishmentsRestored += 1;
  }

  const reconciliationRunIdMap = new Map();
  for (const run of nativeStorage.policyNativeIntentReconciliationRuns || []) {
    if (typeof run.run_key !== 'string' || !run.run_key.trim()) continue;

    const { keys, values } = buildAllowedColumnValues(
      run,
      POLICY_NATIVE_INTENT_RECONCILIATION_RUN_ALLOWED_COLUMNS,
    );
    if (keys.length === 0) continue;

    const placeholders = keys.map((_, index) => `$${index + 2}`).join(', ');
    const result = await client.query(
      `INSERT INTO policy_native_intent_reconciliation_runs (run_key, ${keys.join(', ')})
       VALUES ($1, ${placeholders})
       ON CONFLICT (run_key) DO NOTHING
       RETURNING id`,
      [run.run_key, ...values],
    );
    let restoredRunId = result.rows[0]?.id ?? null;
    if (!restoredRunId) {
      const existing = await client.query(
        `SELECT id
         FROM policy_native_intent_reconciliation_runs
         WHERE run_key = $1
         LIMIT 1`,
        [run.run_key],
      );
      restoredRunId = existing.rows[0]?.id ?? null;
    }

    if (restoredRunId && run.id !== undefined && run.id !== null) {
      reconciliationRunIdMap.set(run.id, restoredRunId);
      stats.reconciliationRunsRestored += 1;
    }
  }

  for (const outcome of nativeStorage.policyNativeIntentReconciliationOutcomes || []) {
    const restoredRunId = reconciliationRunIdMap.get(outcome.run_id);
    const restoredPolicyId = policyIdMap.get(outcome.policy_id);
    if (!restoredRunId || !restoredPolicyId) continue;

    const { keys, values } = buildAllowedColumnValues(
      outcome,
      POLICY_NATIVE_INTENT_RECONCILIATION_OUTCOME_ALLOWED_COLUMNS,
    );
    if (keys.length === 0) continue;

    const placeholders = keys.map((_, index) => `$${index + 3}`).join(', ');
    await client.query(
      `INSERT INTO policy_native_intent_reconciliation_outcomes (run_id, policy_id, ${keys.join(', ')})
       VALUES ($1, $2, ${placeholders})
       ON CONFLICT (run_id, policy_id) DO NOTHING`,
      [restoredRunId, restoredPolicyId, ...values],
    );
    stats.reconciliationOutcomesRestored += 1;
  }

  return stats;
}

export async function restoreLibraryCustomRules(client, rules, libraryIdMap) {
  if (!rules) return;
  for (const rule of rules) {
    const newLibraryId = libraryIdMap.get(rule.library_id);
    if (!newLibraryId) continue;

    await client.query(
      `INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [newLibraryId, rule.name, rule.description, typeof rule.rule_json === 'string' ? rule.rule_json : JSON.stringify(rule.rule_json), rule.is_active]
    );
  }
}

export async function restoreLabelPresets(client, presets) {
  if (!presets) return;
  for (const preset of presets) {
    const { id: _id, created_at: _created_at, ...data } = preset;
    await client.query(
      `INSERT INTO label_presets (category, name, display_name, description, media_type, tmdb_match_field, tmdb_match_values)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [data.category, data.name, data.display_name, data.description, data.media_type, data.tmdb_match_field, data.tmdb_match_values]
    );
  }
}

export async function restoreScheduledTasks(client, tasks, libraryIdMap) {
  if (!tasks) return;
  for (const task of tasks) {
    const newLibraryId = task.library_id ? libraryIdMap.get(task.library_id) : null;
    await client.query(
      `INSERT INTO scheduled_tasks (name, task_type, library_id, interval_minutes, enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [task.name, task.task_type, newLibraryId, task.interval_minutes, task.enabled]
    );
  }
}

export async function restoreAutoLearnedPreferences(client, preferences, libraryIdMap) {
  if (!preferences) return;
  for (const pref of preferences) {
    const newLibraryId = libraryIdMap.get(pref.library_id);
    if (!newLibraryId) continue;

    await client.query(
      `INSERT INTO auto_learned_preferences
       (library_id, policy_id, preference_type, preference_value, confidence_count, source, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (library_id, preference_type, preference_value) DO UPDATE SET
         policy_id = EXCLUDED.policy_id,
         confidence_count = EXCLUDED.confidence_count,
         source = EXCLUDED.source,
         status = EXCLUDED.status`,
      [newLibraryId, pref.policy_id, pref.preference_type, pref.preference_value,
       pref.confidence_count, pref.source, pref.status]
    );
  }
}

export async function restoreLearningPatterns(client, patterns, libraryIdMap) {
  if (!patterns) return;
  for (const pattern of patterns) {
    const newLibraryId = libraryIdMap.get(pattern.library_id);
    if (!newLibraryId) continue;
    await classificationEvidenceService.restoreLegacyPattern({
      pattern,
      libraryId: newLibraryId,
      client
    });
  }
}

export async function restoreClassificationEvidence(client, evidence, libraryIdMap) {
  if (!evidence) return;
  for (const row of evidence) {
    const newLibraryId = row.library_id != null
      ? (libraryIdMap.get(row.library_id) ?? null)
      : null;
    await classificationEvidenceRepository.upsertEvidence(
      {
        scope: row.scope,
        tmdbId: row.tmdb_id ?? null,
        mediaType: row.media_type ?? null,
        libraryId: newLibraryId,
        evidenceKey: row.evidence_key ?? null,
        evidenceData: row.evidence_data ?? null,
        confidence: row.confidence ?? null,
        usageCount: row.usage_count ?? 0,
        successRate: row.success_rate ?? null,
        provenance: row.provenance,
        status: row.status ?? 'active',
        createdBy: row.created_by ?? null,
        sourceClassificationId: row.source_classification_id ?? null,
        sourceSystem: row.source_system ?? null
      },
      { client, conflictMode: 'do_nothing' }
    );
  }
}

export async function restorePathMappings(client, mappings) {
  if (!mappings) return;
  for (const mapping of mappings) {
    const { id: _id, created_at: _created_at, ...data } = mapping;
    const arrPath = data.arr_path || data.source_path;
    const localPath = data.local_path || data.target_path;
    await client.query(
      `INSERT INTO path_mappings (arr_path, local_path, is_active)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [arrPath, localPath, data.is_active]
    );
  }
}

export async function restoreOllamaConfig(client, config) {
  if (!config) return;
  await client.query(
    `INSERT INTO ollama_config (host, port, model)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       host = EXCLUDED.host,
       port = EXCLUDED.port,
       model = EXCLUDED.model`,
    [config.host, config.port, config.model]
  );
}

export async function restoreTmdbConfig(client, config) {
  if (!config) return;
  await client.query(
    `INSERT INTO tmdb_config (api_key)
     VALUES ($1)
     ON CONFLICT (id) DO UPDATE SET
       api_key = EXCLUDED.api_key`,
    [config.api_key]
  );
}

export async function restoreOmdbConfig(client, config) {
  if (!config) return;
  await client.query(
    `INSERT INTO omdb_config (api_key, is_active, daily_limit)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       api_key = EXCLUDED.api_key,
       is_active = EXCLUDED.is_active,
       daily_limit = EXCLUDED.daily_limit`,
    [config.api_key, config.is_active, config.daily_limit]
  );
}

export async function restoreAiConfig(client, config) {
  if (!config) return;
  await client.query(
    `INSERT INTO ai_config (provider, api_key, model, base_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       provider = EXCLUDED.provider,
       api_key = EXCLUDED.api_key,
       model = EXCLUDED.model,
       base_url = EXCLUDED.base_url`,
    [config.provider, config.api_key, config.model, config.base_url]
  );
}

export async function restoreWebhookConfig(client, config) {
  if (!config) return;
  const secretKey = config.secret_key ?? config.webhook_key ?? null;
  await client.query(
    `INSERT INTO webhook_config (id, secret_key, enabled)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       secret_key = EXCLUDED.secret_key,
       enabled = EXCLUDED.enabled`,
    [config.id || 1, secretKey, config.enabled]
  );
}

export async function restoreSettings(client, settings) {
  if (!settings) return;
  for (const setting of settings) {
    await client.query(
      `INSERT INTO settings (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value`,
      [setting.key, setting.value]
    );
  }
}

export async function restoreLibraryLabels(client, labels, libraryIdMap) {
  if (!labels) return;
  for (const label of labels) {
    const newLibraryId = libraryIdMap.get(label.library_id);
    if (!newLibraryId) continue;

    await client.query(
      `INSERT INTO library_labels (library_id, label_preset_id, rule_type)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [newLibraryId, label.label_preset_id, label.rule_type || 'include']
    );
  }
}
