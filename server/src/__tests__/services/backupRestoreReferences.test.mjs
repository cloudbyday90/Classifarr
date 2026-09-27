/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0-or-later */
import { jest } from '@jest/globals';
import { restoredReference, restoredArrReference, validateBackupRestoreReferences } from '../../services/backupRestoreReferences.mjs';
import { restoreAllTables } from '../../services/backupRestore.mjs';

function graph() {
  return {
    mediaServers: [{ id: 1 }],
    radarrConfigs: [{ id: 2, media_server_id: 1 }],
    sonarrConfigs: [{ id: 2, media_server_id: 1 }],
    libraries: [{ id: 3, media_server_id: 1, arr_type: 'radarr', arr_id: 2 }],
    libraryPolicies: [{ id: 4, library_id: 3, source_library_ids: ['provider-owned'] }],
    policyIntents: [{ id: 5, policy_id: 4, library_id: 3 }],
    policyIntentRoutingTargets: [{ intent_id: 5, library_id: 3, arr_type: 'radarr', arr_config_id: 2 }],
    libraryArrMappings: [{ library_id: 3, arr_type: 'radarr', arr_config_id: 2 }],
    autoLearnedPreferences: [{ library_id: 3, policy_id: 4 }],
    labelPresets: [{ id: 6 }],
    libraryLabels: [{ library_id: 3, label_preset_id: 6 }],
  };
}

describe('restore reference preflight', () => {
  it('accepts complete graphs without mutating them, including optional legacy sections', () => {
    const data = graph();
    const original = structuredClone(data);
    validateBackupRestoreReferences(data);
    expect(data).toEqual(original);
    validateBackupRestoreReferences({});
    validateBackupRestoreReferences({ libraries: [{ name: 'Legacy', media_server_id: null }], labelPresets: null });
    data.autoLearnedPreferences[0].policy_id = null;
    data.policyIntentRoutingTargets[0].arr_config_id = null;
    validateBackupRestoreReferences(data);
  });

  it.each([
    ['mediaServers', 'id', 1.5], ['mediaServers', 'id', 'not-an-id'],
    ['libraries', 'media_server_id', 999], ['libraries', 'arr_type', 'unknown'],
    ['libraries', 'arr_id', 999], ['radarrConfigs', 'media_server_id', 999],
    ['libraryPolicies', 'library_id', 999], ['policyIntents', 'policy_id', 999],
    ['policyIntents', 'library_id', 999], ['policyIntentRoutingTargets', 'intent_id', 999],
    ['policyIntentRoutingTargets', 'library_id', 999], ['policyIntentRoutingTargets', 'arr_config_id', 999],
    ['libraryArrMappings', 'arr_config_id', null], ['libraryArrMappings', 'library_id', 999],
    ['libraryArrMappings', 'arr_type', 'unknown'],
    ['autoLearnedPreferences', 'policy_id', 999], ['libraryLabels', 'label_preset_id', 999],
  ])('rejects a missing/invalid %s.%s before replace-mode SQL', async (section, field, value) => {
    const data = graph();
    data[section][0][field] = value;
    const client = { query: jest.fn() };
    await expect(restoreAllTables(client, { data }, 'replace')).rejects.toThrow(`${section}[0].${field}`);
    expect(client.query).not.toHaveBeenCalled();
  });

  it.each([null, [], { libraries: {} }, { libraries: [null] }, { libraries: [[]] }])('rejects malformed section shapes', data => {
    expect(() => validateBackupRestoreReferences(data)).toThrow('Invalid backup reference');
  });

  it('rejects duplicate IDs, including differently formatted numeric IDs, and duplicate fallback rows', () => {
    const data = graph();
    data.mediaServers.push({ id: '1' });
    expect(() => validateBackupRestoreReferences(data)).toThrow('mediaServers[1].id');
    data.mediaServers.pop();
    data.libraryArrMappings.push({ ...data.libraryArrMappings[0] });
    expect(() => validateBackupRestoreReferences(data)).toThrow('libraryArrMappings[1].library_id');
  });

  it.each(['policyIntents', 'policyIntentRoutingTargets', 'autoLearnedPreferences'])('rejects cross-library %s links', section => {
    const data = graph();
    data.libraries.push({ id: 99 });
    data[section][0].library_id = 99;
    expect(() => validateBackupRestoreReferences(data)).toThrow(section);
  });

  it('keeps Radarr and Sonarr ID spaces separate and never falls back to an old ID', () => {
    const maps = { radarr: new Map([[2, 200]]), sonarr: new Map([[2, 300]]) };
    expect(restoredArrReference({ arr_type: 'radarr', id: 2 }, 'id', maps, 'target')).toBe(200);
    expect(restoredArrReference({ arr_type: 'sonarr', id: 2 }, 'id', maps, 'target')).toBe(300);
    expect(restoredArrReference({}, 'id', maps, 'target')).toBeNull();
    expect(() => restoredArrReference({ arr_type: 'music', id: 2 }, 'id', maps, 'target')).toThrow('target.arr_type');
    expect(() => restoredArrReference({ arr_type: 'radarr', id: 2 }, 'id', {}, 'target')).toThrow('target.id');
    expect(restoredReference(maps.radarr, '2', 'id')).toBe(200);
    expect(restoredReference(new Map([['2', 200]]), 2, 'id')).toBe(200);
    expect(restoredReference(null, null, 'id', { nullable: true })).toBeNull();
    expect(() => restoredReference(new Map([[9007199254740992, 200]]), '9007199254740993', 'id')).toThrow('id');
  });
});
