/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  import.meta.dirname,
  '../../../../database/migrations/20260830_120000_add_policy_candidate_correction_review_corpus_control_plane.sql',
);

describe('representative review-corpus control-plane migration', () => {
  test('creates a bounded control configuration and append-only minimal audit event table', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_corpus_controls');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_corpus_audit_events');
    expect(migration).toContain("control_key = 'representative_review_corpus'");
    expect(migration).toContain('review_record_retention_days BETWEEN 7 AND 90');
    expect(migration).toContain('BEFORE UPDATE OR DELETE');
    expect(migration).toContain("RAISE EXCEPTION 'Representative review-corpus audit events are append-only'");
    expect(migration).not.toContain('classification_history');
    expect(migration).not.toContain('media_items');
  });
});
