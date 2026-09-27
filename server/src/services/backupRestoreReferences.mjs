/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0-or-later */
import { ValidationError } from '../utils/appError.mjs';

function invalidReference(field) {
  return new ValidationError(`Invalid backup reference at ${field}. Re-export a complete configuration backup; do not substitute destination database IDs.`);
}

function idKey(id, field) {
  if (typeof id === 'number' && Number.isSafeInteger(id)) return String(id);
  if (typeof id === 'string' && /^-?(0|[1-9]\d{0,19})$/.test(id) && id !== '-0') return BigInt(id).toString();
  throw invalidReference(field);
}

export function restoredReference(map, id, field, { nullable = false } = {}) {
  if (nullable && id == null) return null;
  const key = idKey(id, field);
  const numericKey = Number(key);
  const restored = map?.get(id) ?? map?.get(key) ?? (Number.isSafeInteger(numericKey) ? map?.get(numericKey) : undefined);
  if (restored == null) throw invalidReference(field);
  return restored;
}

export function restoredArrReference(row, idField, maps, field) {
  if (row[idField] == null) return null;
  if (row.arr_type !== 'radarr' && row.arr_type !== 'sonarr') throw invalidReference(`${field}.arr_type`);
  return restoredReference(maps?.[row.arr_type], row[idField], `${field}.${idField}`);
}

export function validateBackupRestoreReferences(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw invalidReference('data');
  const names = ['mediaServers', 'radarrConfigs', 'sonarrConfigs', 'libraries', 'libraryPolicies',
    'labelPresets', 'libraryLabels', 'autoLearnedPreferences', 'libraryArrMappings',
    'policyIntents', 'policyIntentRoutingTargets'];
  const rows = new Map();
  const indexes = new Map();
  for (const name of names) {
    const section = data[name] ?? [];
    if (!Array.isArray(section)) throw invalidReference(name);
    const index = new Map();
    section.forEach((row, position) => {
      const field = `${name}[${position}]`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw invalidReference(field);
      if (row.id != null) {
        const key = idKey(row.id, `${field}.id`);
        if (index.has(key)) throw invalidReference(`${field}.id`);
        index.set(key, row);
      }
    });
    rows.set(name, section);
    indexes.set(name, index);
  }
  const reference = (section, id, field, nullable = false) => {
    if (nullable && id == null) return null;
    const parent = indexes.get(section).get(idKey(id, field));
    if (!parent) throw invalidReference(field);
    return parent;
  };
  const each = (section, fn) => rows.get(section).forEach((row, i) => fn(row, `${section}[${i}]`));
  const arr = (row, idField, field, required = false) => {
    if (!required && row[idField] == null) return;
    if (row.arr_type !== 'radarr' && row.arr_type !== 'sonarr') throw invalidReference(`${field}.arr_type`);
    reference(row.arr_type === 'radarr' ? 'radarrConfigs' : 'sonarrConfigs', row[idField], `${field}.${idField}`);
  };
  for (const section of ['radarrConfigs', 'sonarrConfigs', 'libraries']) {
    each(section, (row, field) => reference('mediaServers', row.media_server_id, `${field}.media_server_id`, true));
  }
  each('libraries', (row, field) => arr(row, 'arr_id', field));
  each('libraryPolicies', (row, field) => reference('libraries', row.library_id, `${field}.library_id`));
  each('policyIntents', (row, field) => {
    const policy = reference('libraryPolicies', row.policy_id, `${field}.policy_id`);
    reference('libraries', row.library_id, `${field}.library_id`);
    if (idKey(policy.library_id, field) !== idKey(row.library_id, field)) throw invalidReference(`${field}.library_id`);
  });
  const mappedLibraries = new Set();
  each('libraryArrMappings', (row, field) => {
    reference('libraries', row.library_id, `${field}.library_id`);
    const key = idKey(row.library_id, field);
    if (mappedLibraries.has(key)) throw invalidReference(`${field}.library_id`);
    mappedLibraries.add(key);
    arr(row, 'arr_config_id', field, true);
  });
  each('policyIntentRoutingTargets', (row, field) => {
    const intent = reference('policyIntents', row.intent_id, `${field}.intent_id`);
    reference('libraries', row.library_id, `${field}.library_id`);
    if (idKey(intent.library_id, field) !== idKey(row.library_id, field)) throw invalidReference(`${field}.library_id`);
    arr(row, 'arr_config_id', field);
  });
  each('autoLearnedPreferences', (row, field) => {
    reference('libraries', row.library_id, `${field}.library_id`);
    const policy = reference('libraryPolicies', row.policy_id, `${field}.policy_id`, true);
    if (policy && idKey(policy.library_id, field) !== idKey(row.library_id, field)) throw invalidReference(`${field}.policy_id`);
  });
  each('libraryLabels', (row, field) => {
    reference('libraries', row.library_id, `${field}.library_id`);
    reference('labelPresets', row.label_preset_id, `${field}.label_preset_id`);
  });
}
