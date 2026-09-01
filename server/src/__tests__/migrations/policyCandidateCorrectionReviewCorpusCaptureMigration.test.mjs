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
  '../../../../database/migrations/20260901_090000_add_policy_candidate_correction_review_corpus_capture.sql',
);

describe('representative review-corpus future-capture migration', () => {
  test('creates bounded redacted capture and append-only audit structures', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_corpus_captures');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS policy_candidate_correction_review_corpus_capture_audit_events');
    expect(migration).toContain("action_id IN ('capture_recorded', 'capture_expired')");
    expect(migration).toContain('captured_at < expires_at');
    expect(migration).toContain("RAISE EXCEPTION 'Representative review-corpus capture audit events are append-only'");
    expect(migration).not.toContain('classification_history');
    expect(migration).not.toContain('tmdb_id');
    expect(migration).not.toContain('library_id');
    expect(migration).not.toContain('prompt_text');
    expect(migration).not.toContain('embedding_vector');
  });

  test('uses unique PostgreSQL-safe check constraint names', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    const constraintNames = [...migration.matchAll(/CONSTRAINT\s+([a-z0-9_]+)\s+CHECK/gi)].map(([, name]) => name);

    expect(constraintNames).toHaveLength(new Set(constraintNames).size);
    expect(constraintNames.every(name => name.length <= 63)).toBe(true);
    expect(constraintNames).toContain('pccrc_audit_expiry_actor_ck');
  });
});
