/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const {
  buildQuestionContextCacheKey,
  extractQuestionContext,
  getPolicyQuestionContextVersion,
  isPolicyQuestionStale,
  stampPolicyQuestionContext,
} = require('../utils/policyQuestionContext');

describe('policyQuestionContext', () => {
  test('extracts unique policy and library ids from candidates and options', () => {
    const context = extractQuestionContext({
      options: [
        { library_id: 8 },
        { library_id: 9 },
      ],
      meta: {
        primary_candidate_library_id: 8,
        question_anchor_library_id: 9,
        candidates: [
          { policy_id: 21, library_id: 8 },
          { policy_id: 22, library_id: 9 },
          { policy_id: 21, library_id: 8 },
        ]
      }
    });

    expect(context).toEqual({
      policyIds: [21, 22],
      libraryIds: [8, 9],
    });
    expect(buildQuestionContextCacheKey(context)).toBe('p:21,22|l:8,9');
  });

  test('stamps question context metadata', () => {
    const stamped = stampPolicyQuestionContext(
      { question: 'Where should this go?', meta: {} },
      '2026-03-15T00:00:00.000Z',
      { policyIds: [21], libraryIds: [8] }
    );

    expect(stamped.meta.question_context).toEqual({
      version: '2026-03-15T00:00:00.000Z',
      policy_ids: [21],
      library_ids: [8],
    });
  });

  test('detects stale questions from stamped context version or generated_at fallback', () => {
    expect(isPolicyQuestionStale({
      generated_at: '2026-03-14T23:00:00.000Z',
      meta: {
        question_context: {
          version: '2026-03-14T23:30:00.000Z',
        }
      }
    }, '2026-03-15T00:00:00.000Z')).toBe(true);

    expect(isPolicyQuestionStale({
      generated_at: '2026-03-15T00:00:00.000Z',
      meta: {}
    }, '2026-03-14T23:59:59.000Z')).toBe(false);
  });

  test('handles invalid inputs and cache key normalization safely', () => {
    expect(extractQuestionContext(null)).toEqual({
      policyIds: [],
      libraryIds: [],
    });

    expect(extractQuestionContext({
      options: { bad: true },
      meta: {
        candidates: { nope: true },
        primary_candidate_library_id: '7',
        question_anchor_library_id: '8',
      }
    })).toEqual({
      policyIds: [],
      libraryIds: [7, 8],
    });

    expect(buildQuestionContextCacheKey({
      policyIds: ['21', 'bad', 21, 0],
      libraryIds: [9, '9', 'nope', -1],
    })).toBe('p:21|l:9');
    expect(buildQuestionContextCacheKey()).toBe('p:|l:');

    expect(stampPolicyQuestionContext(null, '2026-03-15T00:00:00.000Z', { policyIds: [1], libraryIds: [2] })).toBeNull();
  });

  test('getPolicyQuestionContextVersion returns null when there is no context or invalid timestamp', async () => {
    const db = { query: jest.fn() };
    await expect(getPolicyQuestionContextVersion(db, { policyIds: [], libraryIds: [] })).resolves.toBeNull();
    expect(db.query).not.toHaveBeenCalled();

    db.query.mockResolvedValueOnce({ rows: [{ context_version: 'not-a-date' }] });
    await expect(getPolicyQuestionContextVersion(db, { policyIds: [21], libraryIds: [8] })).resolves.toBeNull();

    db.query.mockResolvedValueOnce({ rows: [{}] });
    await expect(getPolicyQuestionContextVersion(db, { policyIds: [21], libraryIds: [8] })).resolves.toBeNull();
  });

  test('getPolicyQuestionContextVersion returns ISO string for valid dates', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ context_version: new Date('2026-03-15T01:23:45.000Z') }] }) };

    await expect(getPolicyQuestionContextVersion(db, {
      policyIds: ['21', 22, 'bad'],
      libraryIds: ['8', 9, null],
    })).resolves.toBe('2026-03-15T01:23:45.000Z');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT GREATEST('), [[8, 9], [21, 22]]);
  });

  test('stamps non-object meta safely and uses generated_at fallback for stale detection', () => {
    const stamped = stampPolicyQuestionContext(
      { question: 'Where should this go?', meta: 'bad-meta' },
      '2026-03-15T00:00:00.000Z',
      { policyIds: ['11', 'bad'], libraryIds: ['5', null] }
    );

    expect(stamped.meta.question_context).toEqual({
      version: '2026-03-15T00:00:00.000Z',
      policy_ids: [11],
      library_ids: [5],
    });

    expect(isPolicyQuestionStale({
      generated_at: '2026-03-14T20:00:00.000Z',
      meta: null
    }, '2026-03-15T00:00:00.000Z')).toBe(true);
  });

  test('isPolicyQuestionStale returns false for missing or invalid timestamps', () => {
    expect(isPolicyQuestionStale(null, '2026-03-15T00:00:00.000Z')).toBe(false);
    expect(isPolicyQuestionStale({ meta: { question_context: { version: 'invalid' } } }, '2026-03-15T00:00:00.000Z')).toBe(false);
    expect(isPolicyQuestionStale({ generated_at: '2026-03-15T00:00:00.000Z' }, null)).toBe(false);
  });
});
