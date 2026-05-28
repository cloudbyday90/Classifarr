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
  if (!policies) return;
  for (const policy of policies) {
    const newLibraryId = libraryIdMap.get(policy.library_id);
    if (!newLibraryId) continue;

    const { id: _id, library_id: _library_id, created_at: _created_at, updated_at: _updated_at, ...data } = policy;
    const keys = Object.keys(data).filter(key => POLICY_ALLOWED_COLUMNS.includes(key) || POLICY_JSONB_COLUMNS.has(key));
    const values = keys.map(key => {
      const val = data[key];
      if (POLICY_JSONB_COLUMNS.has(key) && val != null && typeof val !== 'string') return JSON.stringify(val);
      return val;
    });
    const placeholders = keys.map((_, i) => `$${i + 2}`).join(', ');

    if (keys.length > 0) {
      const updateClauses = keys.filter(k => k !== 'name').map(k => `${k} = EXCLUDED.${k}`).join(', ');
      await client.query(
        `INSERT INTO library_policies (library_id, ${keys.join(', ')}) VALUES ($1, ${placeholders})
         ON CONFLICT (library_id) DO UPDATE SET ${updateClauses}`,
        [newLibraryId, ...values]
      );
    }
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
