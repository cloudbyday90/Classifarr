import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('policy authoring proposal migration', () => {
  test('stores only opaque, revision-bound server admission records', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../../../database/migrations/20260803_120000_add_policy_authoring_proposals.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS policy_authoring_proposals');
    expect(sql).toContain('policy_authoring_proposals_reference_unique');
    expect(sql).toContain('canonical_declared_intent JSONB NOT NULL');
    expect(sql).toContain('display_summary JSONB NOT NULL');
    expect(sql).toContain("state IN ('prepared', 'consumed')");
    expect(sql).toContain('idx_policy_authoring_proposals_library_state_expiry');
  });
});
