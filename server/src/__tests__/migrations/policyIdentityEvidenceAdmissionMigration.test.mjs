/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('policy identity evidence admission migration', () => {
  test('creates an append-only runtime admission table with independent authority checks', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../../../database/migrations/20260726_110000_add_policy_identity_evidence_admissions.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS policy_identity_evidence_admissions');
    expect(sql).toContain('policy_identity_evidence_admissions_authority_shape_chk');
    expect(sql).toContain("authority_source_id IN ('media_server_contents', 'operator_declared_intent')");
    expect(sql).toContain('policy_identity_evidence_admissions_source_event_unique');
    expect(sql).toContain('idx_policy_identity_evidence_admissions_library_created');
    expect(sql).toContain('guard_policy_identity_evidence_admission_mutation');
    expect(sql).toContain("= 'replace_restore'");
  });
});
