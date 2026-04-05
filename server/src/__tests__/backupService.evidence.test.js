/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Focused tests for backupService evidence-boundary integration.
 */

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
  }
}));

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
}));

jest.mock('../services/classificationEvidenceService', () => ({
  listLegacyPatterns: jest.fn(),
  purgeAllLegacyPatterns: jest.fn(),
  restoreLegacyPattern: jest.fn()
}));

jest.mock('../services/classificationEvidenceRepository', () => ({
  listAll: jest.fn(),
  purgeAll: jest.fn(),
  upsertEvidence: jest.fn()
}));

const db = require('../config/database');
const classificationEvidenceService = require('../services/classificationEvidenceService');
const classificationEvidenceRepository = require('../services/classificationEvidenceRepository');
const backupService = require('../services/backupService');

describe('BackupService evidence integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('collectBackupData uses the evidence service for learned pattern export', async () => {
    db.query.mockResolvedValue({ rows: [] });
    classificationEvidenceService.listLegacyPatterns.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    classificationEvidenceRepository.listAll.mockResolvedValue([]);

    const result = await backupService.collectBackupData({ includePatterns: true });

    expect(classificationEvidenceService.listLegacyPatterns).toHaveBeenCalledWith();
    expect(result.data.learningPatterns).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.meta.learningPatternsCount).toBe(2);
  });

  test('restoreBackup uses the evidence service for replace-mode purge and pattern restore', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
      release: jest.fn()
    };

    db.pool.connect.mockResolvedValue(client);
    jest.spyOn(backupService, 'readBackup').mockResolvedValue({
      version: '2.0',
      data: {
        confidenceSettings: [],
        mediaServers: [],
        radarrConfigs: [],
        sonarrConfigs: [],
        libraries: [{ id: 99, name: 'Movies', type: 'movie', media_type: 'movie', media_server_id: 1 }],
        libraryPolicies: [],
        libraryCustomRules: [],
        labelPresets: [],
        scheduledTasks: [],
        autoLearnedPreferences: [],
        learningPatterns: [{
          tmdb_id: 550,
          media_type: 'movie',
          library_id: 99,
          pattern_type: 'exact_match',
          pattern_data: { title: 'Fight Club' }
        }],
        pathMappings: []
      }
    });

    classificationEvidenceService.purgeAllLegacyPatterns.mockResolvedValue({ deleted: 4, rows: [] });
    classificationEvidenceService.restoreLegacyPattern.mockResolvedValue({ id: 77 });

    await backupService.restoreBackup('phase1.json', { mode: 'replace' });

    expect(classificationEvidenceService.purgeAllLegacyPatterns).toHaveBeenCalledWith({
      client,
      actor: 'backup_restore',
      reason: 'replace_mode'
    });
    expect(classificationEvidenceService.restoreLegacyPattern).toHaveBeenCalledWith({
      pattern: expect.objectContaining({
        tmdb_id: 550,
        media_type: 'movie',
        library_id: 99
      }),
      libraryId: 1,
      client
    });
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });
});

// ── Phase 6A: classification_evidence restore mapping tests ──────────────────

describe('BackupService classification_evidence export (Phase 6A)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('includes classification_evidence rows in backup when includePatterns is true', async () => {
    const ceRows = [
      { id: 1, scope: 'item_exact', tmdb_id: 550, media_type: 'movie', library_id: 10, evidence_key: null, provenance: 'human_confirmed', confidence: 100, status: 'active' },
      { id: 2, scope: 'genre', tmdb_id: null, media_type: 'movie', library_id: 10, evidence_key: 'genre:documentary', provenance: 'policy_confirmed', confidence: 85, status: 'active' }
    ];

    db.query.mockResolvedValue({ rows: [] });
    classificationEvidenceService.listLegacyPatterns.mockResolvedValue([]);
    classificationEvidenceRepository.listAll.mockResolvedValue(ceRows);

    const result = await backupService.collectBackupData({ includePatterns: true });

    expect(classificationEvidenceRepository.listAll).toHaveBeenCalledWith();
    expect(result.data.classificationEvidence).toEqual(ceRows);
    expect(result.meta.classificationEvidenceCount).toBe(2);
  });

  test('does not include classification_evidence rows when includePatterns is false', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const result = await backupService.collectBackupData({ includePatterns: false });

    expect(classificationEvidenceRepository.listAll).not.toHaveBeenCalled();
    expect(result.data.classificationEvidence).toBeUndefined();
    expect(result.meta.classificationEvidenceCount).toBeUndefined();
  });

  test('exposes evidenceCategories metadata with correct scope and provenance counts', async () => {
    const ceRows = [
      { id: 1, scope: 'item_exact', provenance: 'human_confirmed', status: 'active' },
      { id: 2, scope: 'genre', provenance: 'policy_confirmed', status: 'active' },
      { id: 3, scope: 'genre', provenance: 'mined', status: 'active' }
    ];

    db.query.mockResolvedValue({ rows: [] });
    classificationEvidenceService.listLegacyPatterns.mockResolvedValue([]);
    classificationEvidenceRepository.listAll.mockResolvedValue(ceRows);

    const result = await backupService.collectBackupData({ includePatterns: true });

    expect(result.meta.classificationEvidenceCount).toBe(3);
  });
});

describe('BackupService classification_evidence restore mapping (Phase 6A)', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValue(client);
    classificationEvidenceService.purgeAllLegacyPatterns.mockResolvedValue({ deleted: 0, rows: [] });
    classificationEvidenceRepository.purgeAll.mockResolvedValue({ deleted: 0 });
    classificationEvidenceRepository.upsertEvidence.mockResolvedValue({ id: 99 });
    classificationEvidenceService.restoreLegacyPattern.mockResolvedValue({ id: 77 });
  });

  function makeBackup(ceRows = [], extra = {}) {
    return {
      version: '2.0',
      data: {
        confidenceSettings: [],
        mediaServers: [],
        radarrConfigs: [],
        sonarrConfigs: [],
        libraries: [{ id: 99, name: 'Movies', type: 'movie', media_type: 'movie', media_server_id: 1 }],
        libraryPolicies: [],
        libraryCustomRules: [],
        labelPresets: [],
        scheduledTasks: [],
        autoLearnedPreferences: [],
        learningPatterns: [],
        pathMappings: [],
        classificationEvidence: ceRows,
        ...extra
      }
    };
  }

  test('calls purgeAll on classificationEvidenceRepository in replace mode', async () => {
    jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup());

    await backupService.restoreBackup('backup.json', { mode: 'replace' });

    expect(classificationEvidenceRepository.purgeAll).toHaveBeenCalledWith({ client });
  });

  test('does not call purgeAll in merge mode', async () => {
    jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup());

    await backupService.restoreBackup('backup.json', { mode: 'merge' });

    expect(classificationEvidenceRepository.purgeAll).not.toHaveBeenCalled();
  });

  test('upserts each CE row using the remapped library ID', async () => {
    // library 99 in backup → new library ID 1 (from client.query returning { id: 1 })
    const ceRow = {
      scope: 'genre',
      tmdb_id: null,
      media_type: 'movie',
      library_id: 99,
      evidence_key: 'genre:documentary',
      evidence_data: { genre: 'documentary' },
      confidence: 85,
      usage_count: 3,
      success_rate: 100,
      provenance: 'policy_confirmed',
      status: 'active',
      created_by: null,
      source_classification_id: null,
      source_system: null
    };

    jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup([ceRow]));

    await backupService.restoreBackup('backup.json', { mode: 'merge' });

    expect(classificationEvidenceRepository.upsertEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'genre',
        libraryId: 1,
        evidenceKey: 'genre:documentary',
        provenance: 'policy_confirmed'
      }),
      { client, conflictMode: 'do_nothing' }
    );
  });

  test('item_exact CE rows with null library_id are restored with libraryId null (not skipped)', async () => {
    const ceRow = {
      scope: 'item_exact',
      tmdb_id: 550,
      media_type: 'movie',
      library_id: null,
      evidence_key: null,
      evidence_data: { title: 'Fight Club' },
      confidence: 100,
      usage_count: 1,
      success_rate: null,
      provenance: 'human_confirmed',
      status: 'active',
      created_by: null,
      source_classification_id: null,
      source_system: null
    };

    jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup([ceRow]));

    await backupService.restoreBackup('backup.json', { mode: 'merge' });

    expect(classificationEvidenceRepository.upsertEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'item_exact',
        tmdbId: 550,
        libraryId: null
      }),
      expect.anything()
    );
  });

  test('CE rows whose old library_id has no mapping are restored with libraryId null (not skipped)', async () => {
    // library_id 777 does not exist in the backup's library list → no mapping → null
    const ceRow = {
      scope: 'genre',
      tmdb_id: null,
      media_type: 'movie',
      library_id: 777,
      evidence_key: 'genre:horror',
      evidence_data: null,
      confidence: 70,
      usage_count: 2,
      success_rate: null,
      provenance: 'mined',
      status: 'active',
      created_by: null,
      source_classification_id: null,
      source_system: null
    };

    jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup([ceRow]));

    await backupService.restoreBackup('backup.json', { mode: 'merge' });

    expect(classificationEvidenceRepository.upsertEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'genre',
        libraryId: null
      }),
      expect.anything()
    );
    // Should still have been called — not skipped
    expect(classificationEvidenceRepository.upsertEvidence).toHaveBeenCalledTimes(1);
  });

  test('uses conflictMode do_nothing so existing evidence rows are not overwritten', async () => {
    const ceRow = {
      scope: 'item_exact',
      tmdb_id: 550,
      media_type: 'movie',
      library_id: 99,
      evidence_key: null,
      evidence_data: null,
      confidence: 100,
      usage_count: 1,
      success_rate: null,
      provenance: 'human_confirmed',
      status: 'active',
      created_by: null,
      source_classification_id: null,
      source_system: null
    };

    jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup([ceRow]));

    await backupService.restoreBackup('backup.json', { mode: 'merge' });

    const [, opts] = classificationEvidenceRepository.upsertEvidence.mock.calls[0];
    expect(opts.conflictMode).toBe('do_nothing');
  });

  test('restore stats include classificationEvidenceRestored count', async () => {
    const ceRows = [
      { scope: 'item_exact', tmdb_id: 550, media_type: 'movie', library_id: 99, evidence_key: null, evidence_data: null, confidence: 100, usage_count: 1, success_rate: null, provenance: 'human_confirmed', status: 'active', created_by: null, source_classification_id: null, source_system: null },
      { scope: 'genre', tmdb_id: null, media_type: 'movie', library_id: 99, evidence_key: 'genre:documentary', evidence_data: null, confidence: 85, usage_count: 3, success_rate: null, provenance: 'policy_confirmed', status: 'active', created_by: null, source_classification_id: null, source_system: null }
    ];

    jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup(ceRows));

    const result = await backupService.restoreBackup('backup.json', { mode: 'merge' });

    expect(result.stats.classificationEvidenceRestored).toBe(2);
  });

  test('gracefully skips CE restoration when classificationEvidence key is absent from backup', async () => {
    jest.spyOn(backupService, 'readBackup').mockResolvedValue(
      makeBackup([], { classificationEvidence: undefined })
    );

    const result = await backupService.restoreBackup('backup.json', { mode: 'merge' });

    expect(classificationEvidenceRepository.upsertEvidence).not.toHaveBeenCalled();
    expect(result.stats.classificationEvidenceRestored).toBe(0);
  });

  test('maps all evidence fields including optional nullable columns', async () => {
    const ceRow = {
      scope: 'studio',
      tmdb_id: null,
      media_type: 'movie',
      library_id: 99,
      evidence_key: 'studio:a24',
      evidence_data: { studio: 'A24' },
      confidence: 72,
      usage_count: 5,
      success_rate: 80,
      provenance: 'mined',
      status: 'active',
      created_by: 'backfill',
      source_classification_id: 12345,
      source_system: 'learning_patterns'
    };

    jest.spyOn(backupService, 'readBackup').mockResolvedValue(makeBackup([ceRow]));

    await backupService.restoreBackup('backup.json', { mode: 'merge' });

    expect(classificationEvidenceRepository.upsertEvidence).toHaveBeenCalledWith(
      {
        scope: 'studio',
        tmdbId: null,
        mediaType: 'movie',
        libraryId: 1,
        evidenceKey: 'studio:a24',
        evidenceData: { studio: 'A24' },
        confidence: 72,
        usageCount: 5,
        successRate: 80,
        provenance: 'mined',
        status: 'active',
        createdBy: 'backfill',
        sourceClassificationId: 12345,
        sourceSystem: 'learning_patterns'
      },
      { client, conflictMode: 'do_nothing' }
    );
  });
});
