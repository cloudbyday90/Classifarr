/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import {
  loadPolicyPurposeCoveragePreflightContext,
  loadPolicyPurposeCoveragePreflightOverlap,
} from '../../services/policyPurposeCoveragePreflightPersistence.mjs';

describe('policyPurposeCoveragePreflightPersistence', () => {
  test('loads the requested persisted policy context without accepting client-supplied library scope', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ policy_id: 17, library_id: 18 }] });

    await expect(loadPolicyPurposeCoveragePreflightContext({
      db: { query },
      policyId: 17,
    })).resolves.toEqual({ policy_id: 17, library_id: 18 });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE policy.id = $1'), [17]);
  });

  test('compares transient candidate terms inside PostgreSQL and returns aggregate overlap only', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        required_signal_type_count: 1,
        required_term_count: 1,
        shared_required_term_count: 1,
        overlapping_destination_count: 1,
      }],
    });

    await expect(loadPolicyPurposeCoveragePreflightOverlap({
      db: { query },
      candidateTerms: [{
        signalType: 'genres',
        operator: 'require_any',
        termKey: 'Family',
      }],
      libraryId: 18,
      mediaType: 'movie',
    })).resolves.toEqual(expect.objectContaining({
      shared_required_term_count: 1,
      overlapping_destination_count: 1,
    }));

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('jsonb_to_recordset($1::jsonb)');
    expect(sql).toContain('operator TEXT')
    expect(sql).toContain("candidate.operator IN ('require_all', 'require_any')")
    expect(sql).toContain("policy.library_id <> $2");
    expect(sql).toContain("LOWER(library.media_type) = LOWER($3)");
    expect(sql).toContain("rule.intent_role = 'purpose'");
    expect(sql).toContain("rule.semantics = 'identity'");
    expect(sql).toContain("rule.signal_type IN ('genres', 'keywords', 'studios')");
    expect(sql).toContain("intent.source = 'native_intent'");
    expect(sql).toContain("intent.validation_status IN ('valid', 'warning')");
    expect(sql).not.toMatch(/SELECT\s+[^;]*rule\.values\s+AS/isu);
    expect(sql).not.toContain('classification_history');
    expect(sql).not.toContain('rag_');
    expect(JSON.stringify(values)).toContain('family');
    expect(values).toEqual([
      JSON.stringify([{
        signal_type: 'genres',
        operator: 'require_any',
        term_key: 'family',
      }]),
      18,
      'movie',
    ]);
  });
});
