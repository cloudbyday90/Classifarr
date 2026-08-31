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
  '../../../../database/migrations/20260830_130000_add_policy_candidate_correction_review_projection.sql',
);

describe('representative review projection migration', () => {
  test('creates only redacted projection structures with retention and append-only audit enforcement', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_projections');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_projection_items');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_projection_audit_events');
    expect(migration).toContain('ON DELETE CASCADE');
    expect(migration).toContain("action_id IN ('projection_created', 'projection_viewed', 'projection_expired')");
    expect(migration).toContain("RAISE EXCEPTION 'Representative review-projection audit events are append-only'");
    expect(migration).not.toContain('classification_history');
    expect(migration).not.toContain('tmdb_id');
    expect(migration).not.toContain('library_id');
  });
});
