/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import {
  SOURCE_CONFLICT_LIBRARY_WINDOW_LIMITS,
  sourceConflictLibraryWindowCtes,
} from '../services/sourceConflictLibraryWindow.mjs';

test('builds a bounded, deterministic daily library window from a trusted positional limit', () => {
  const sql = sourceConflictLibraryWindowCtes('$4::integer');
  expect(SOURCE_CONFLICT_LIBRARY_WINDOW_LIMITS).toEqual({
    libraryLimit: 12,
    librarySelection: 'daily_rotating_library_id_window',
  });
  expect(sql).toContain('FROM libraries WHERE is_active=true');
  expect(sql).toContain("date_trunc('day', statement_timestamp())");
  expect(sql).toContain('ORDER BY id');
  expect(sql).toContain('LIMIT $4::integer');
});

test('does not interpolate an untrusted SQL limit', () => {
  expect(() => sourceConflictLibraryWindowCtes('$4; DELETE FROM libraries')).toThrow(
    'source conflict library window requires a positional integer parameter',
  );
});
