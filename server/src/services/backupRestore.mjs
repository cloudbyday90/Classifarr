import { createLogger } from '../utils/logger.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { classificationEvidenceRepository } from './classificationEvidenceRepository.mjs';
import { generateApiKey } from './apiKeyService.mjs';

const logger = createLogger('BackupRestore');

const RADARR_ALLOWED_COLUMNS = ['name', 'url', 'api_key', 'is_active', 'quality_profile_id', 'root_folder_path', 'monitored', 'search_on_add'];
const SONARR_ALLOWED_COLUMNS = ['name', 'url', 'api_key', 'is_active', 'quality_profile_id', 'root_folder_path', 'monitored', 'search_on_add', 'season_folder'];
const LIBRARY_ALLOWED_COLUMNS = ['name', 'type', 'media_server_id', 'external_id', 'is_active', 'sync_enabled'];

export function buildLibraryIdMap(client, libraries) {
  const libraryIdMap = new Map();
  if (!libraries) return libraryIdMap;

  for (const library of libraries) {
    const { id: oldId, created_at: _created_at, updated_at: _updated_at, last_sync: _last_sync, ...data } = library;
    const keys = Object.keys(data).filter(key => LIBRARY_ALLOWED_COLUMNS.includes(key));
    const values = keys.map(key => data[key]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    if (keys.length > 0) {
      const updateClauses = keys.filter(k => k !== 'name' && k !== 'type').map(k => `${k} = EXCLUDED.${k}`).join(', ');
      client.query(
        `INSERT INTO libraries (${keys.join(', ')}) VALUES (${placeholders})
         ON CONFLICT (name, media_type) DO UPDATE SET ${updateClauses}
         RETURNING id`,
        values
      ).then(result => {
        libraryIdMap.set(oldId, result.rows[0].id);
      });
    }
  }

  return libraryIdMap;
}

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
       ON CONFLICT (type, name) DO UPDATE SET
         url = EXCLUDED.url,
         api_key = EXCLUDED.api_key,
         is_active = EXCLUDED.is_active`,
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
      const updateClauses = keys.filter(k => k !== 'name').map(k => `${k} = EXCLUDED.${k}`).join(', ');
      await client.query(
        `INSERT INTO radarr_config (${keys.join(', ')}) VALUES (${placeholders})
         ON CONFLICT (name) DO UPDATE SET ${updateClauses}`,
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
      const updateClauses = keys.filter(k => k !== 'name').map(k => `${k} = EXCLUDED.${k}`).join(', ');
      await client.query(
        `INSERT INTO sonarr_config (${keys.join(', ')}) VALUES (${placeholders})
         ON CONFLICT (name) DO UPDATE SET ${updateClauses}`,
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
      const updateClauses = keys.filter(k => k !== 'name' && k !== 'type').map(k => `${k} = EXCLUDED.${k}`).join(', ');
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

export async function restoreLibraryPolicies(client, policies, libraryIdMap) {
  if (!policies) return;
  for (const policy of policies) {
    const newLibraryId = libraryIdMap.get(policy.library_id);
    if (!newLibraryId) continue;

    const { id: _id, library_id: _library_id, created_at: _created_at, updated_at: _updated_at, ...data } = policy;
    await client.query(
      `INSERT INTO library_policies (library_id, policy_type, policy_data, is_active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (library_id, policy_type) DO UPDATE SET
         policy_data = EXCLUDED.policy_data,
         is_active = EXCLUDED.is_active`,
      [newLibraryId, data.policy_type, data.policy_data, data.is_active]
    );
  }
}

export async function restoreLibraryCustomRules(client, rules, libraryIdMap) {
  if (!rules) return;
  for (const rule of rules) {
    const newLibraryId = libraryIdMap.get(rule.library_id);
    if (!newLibraryId) continue;

    await client.query(
      `INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (library_id, name) DO UPDATE SET
         description = EXCLUDED.description,
         rule_json = EXCLUDED.rule_json,
         is_active = EXCLUDED.is_active`,
      [newLibraryId, rule.name, rule.description, rule.rule_json, rule.is_active]
    );
  }
}

export async function restoreLabelPresets(client, presets) {
  if (!presets) return;
  for (const preset of presets) {
    const { id: _id, created_at: _created_at, ...data } = preset;
    await client.query(
      `INSERT INTO label_presets (name, labels) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET
         labels = EXCLUDED.labels`,
      [data.name, data.labels]
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
       ON CONFLICT (name, task_type) DO UPDATE SET
         library_id = EXCLUDED.library_id,
         interval_minutes = EXCLUDED.interval_minutes,
         enabled = EXCLUDED.enabled`,
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
    await client.query(
      `INSERT INTO path_mappings (source_path, target_path, is_active)
       VALUES ($1, $2, $3)
       ON CONFLICT (source_path) DO UPDATE SET
         target_path = EXCLUDED.target_path,
         is_active = EXCLUDED.is_active`,
      [data.source_path, data.target_path, data.is_active]
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
      `INSERT INTO library_labels (library_id, label)
       VALUES ($1, $2)
       ON CONFLICT (library_id, label) DO NOTHING`,
      [newLibraryId, label.label]
    );
  }
}

export async function clearExistingConfig(client) {
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

  await restoreLibraryPolicies(client, backupData.data.libraryPolicies, libraryIdMap);
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
      rulesRestored: backupData.data.libraryCustomRules?.length || 0,
      patternsRestored: backupData.data.learningPatterns?.length || 0,
      classificationEvidenceRestored: backupData.data.classificationEvidence?.length || 0
    }
  };
}
