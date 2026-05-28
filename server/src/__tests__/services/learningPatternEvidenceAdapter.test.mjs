import { jest } from '@jest/globals';

import { LearningPatternEvidenceAdapter } from '../../services/learningPatternEvidenceAdapter.mjs';

describe('LearningPatternEvidenceAdapter', () => {
  let db;
  let adapter;

  beforeEach(() => {
    db = { query: jest.fn() };
    adapter = new LearningPatternEvidenceAdapter({ db });
  });

  test('rememberExactMatch supports metadata upsert mode', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 11, library_id: 7 }] });

    const result = await adapter.rememberExactMatch({
      tmdbId: 550,
      mediaType: 'movie',
      libraryId: 7,
      payload: { title: 'Fight Club' },
      createdBy: 'admin',
      payloadColumn: 'metadata',
      conflictMode: 'update_metadata'
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO learning_patterns'),
      [550, 'movie', 7, JSON.stringify({ title: 'Fight Club' }), 'admin']
    );
    expect(result).toEqual({ id: 11, library_id: 7 });
  });

  test('rememberExactMatch supports pattern_data do-nothing mode', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await adapter.rememberExactMatch({
      tmdbId: 551,
      mediaType: 'movie',
      libraryId: 8,
      payload: { title: 'Se7en' },
      payloadColumn: 'pattern_data',
      conflictMode: 'do_nothing'
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT DO NOTHING'),
      [551, 'movie', 8, 'exact_match', JSON.stringify({ title: 'Se7en' }), 100.0]
    );
  });

  test('reinforceGenrePatterns updates then inserts genre rows as needed', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2 }] });

    const touched = await adapter.reinforceGenrePatterns({
      mediaType: 'movie',
      libraryId: 7,
      genres: ['Documentary', 'History'],
      createdBy: 'admin'
    });

    expect(touched).toEqual(['documentary', 'history']);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE learning_patterns'),
      ['movie', 7, 'documentary']
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO learning_patterns'),
      ['movie', 7, 'history', 'admin']
    );
  });

  test('listAll and purgeAll expose legacy lifecycle operations', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ rowCount: 2, rows: [{ id: 1 }, { id: 2 }] });

    const listResult = await adapter.listAll();
    const purgeResult = await adapter.purgeAll();

    expect(db.query).toHaveBeenNthCalledWith(1, 'SELECT * FROM learning_patterns ORDER BY id');
    expect(db.query).toHaveBeenNthCalledWith(2, 'DELETE FROM learning_patterns RETURNING id');
    expect(listResult).toEqual([{ id: 1 }, { id: 2 }]);
    expect(purgeResult).toEqual({
      deleted: 2,
      rows: [{ id: 1 }, { id: 2 }]
    });
  });

  test('restoreLegacyPattern replays backup rows through the canonical upsert', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 91, library_id: 7 }] });

    const result = await adapter.restoreLegacyPattern({
      pattern: {
        tmdb_id: 550,
        media_type: 'movie',
        pattern_type: 'exact_match',
        pattern_data: { title: 'Fight Club' },
        confidence: 100,
        usage_count: 4,
        success_rate: 100,
        metadata: { source: 'backup' },
        created_by: 'system',
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-02T00:00:00.000Z'
      },
      libraryId: 7
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (tmdb_id, media_type, pattern_type) DO UPDATE SET'),
      [
        550,
        'movie',
        7,
        'exact_match',
        '{"title":"Fight Club"}',
        100,
        4,
        100,
        '{"source":"backup"}',
        'system',
        '2026-04-01T00:00:00.000Z',
        '2026-04-02T00:00:00.000Z',
      ]
    );
    expect(result).toEqual({ id: 91, library_id: 7 });
  });
});
