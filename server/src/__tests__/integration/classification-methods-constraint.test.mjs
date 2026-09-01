/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { getPool } from './setup.mjs';

const VALID_METHODS = [
  'existing_media',
  'manual_correction',
  'manual_classification',
  'exact_match',
  'learned_pattern',
  'source_library',
  'policy_auto',
  'policy_prompt',
  'policy_recheck',
  'ai_verified',
  'ai_analysis',
  'ai_rerun',
  'signal_calculation',
  'fallback',
  'queued_for_retry',
  'custom_rule',
  'rule_match',
  'ai_fallback',
  'holiday_detection',
  'library_rule',
  'rag_improved',
  'authoritative_source_library',
  'policy_engine',
  'policy_candidate_adjudication'
];

describe('Classification Methods Database Constraint', () => {
  let db;

  beforeAll(() => {
    db = getPool();
  });

  test('VALID_METHODS list matches database constraint', async () => {
    const result = await db.query(`
      SELECT pg_get_constraintdef(oid) as constraint_def
      FROM pg_constraint 
      WHERE conname = 'classification_history_method_check'
    `);

    expect(result.rows.length).toBeGreaterThan(0);

    const constraintDef = result.rows[0].constraint_def;
    const constraintMethods = constraintDef
      .match(/\[([^\]]+)\]/)?.[1]
      ?.split(',')
      .map((method) => method.trim().replace(/::character varying/g, '').replace(/'/g, ''))
      .sort();

    const validMethodsSorted = [...VALID_METHODS].sort();

    expect(constraintMethods).toEqual(validMethodsSorted);
  });

  test('can insert classification_history with each valid method', async () => {
    const testId = 'test-' + Date.now();

    for (const method of VALID_METHODS) {
      const result = await db.query(`
        INSERT INTO classification_history 
          (title, media_type, method, status, confidence, library_name, reason)
        VALUES 
          ($1, 'movie', $2, 'pending', 100, 'Test Library', 'Test')
        RETURNING id
      `, [testId, method]);

      expect(result.rows[0].id).toBeDefined();

      await db.query('DELETE FROM classification_history WHERE id = $1', [result.rows[0].id]);
    }
  });
});
