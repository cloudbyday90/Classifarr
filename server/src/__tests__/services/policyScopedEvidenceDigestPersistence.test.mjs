/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  loadPolicyScopedEvidenceDigestContext,
} from '../../services/policyScopedEvidenceDigestPersistence.mjs';

describe('policyScopedEvidenceDigestPersistence', () => {
  test('loads metadata-only selected-policy evidence and bounds history by policy, library, and time', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ id: 17, library_id: 8 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const since = new Date('2026-05-18T12:00:00.000Z');

    await loadPolicyScopedEvidenceDigestContext({
      db: { query },
      policyId: 17,
      since,
    });

    expect(query).toHaveBeenCalledTimes(4);
    const [policySql, policyValues] = query.mock.calls[0];
    const [intentsSql, intentsValues] = query.mock.calls[1];
    const [profileSql, profileValues] = query.mock.calls[2];
    const [historySql, historyValues] = query.mock.calls[3];
    expect(policySql).toContain('FROM library_policies policy');
    expect(policyValues).toEqual([17]);
    expect(intentsSql).toContain('LIMIT 2');
    expect(intentsSql).not.toContain('purpose_rule.values');
    expect(intentsValues).toEqual([17]);
    expect(profileSql).toContain('policy_observed_evidence_provenance_snapshots');
    expect(profileSql).not.toContain('snapshot_payload');
    expect(profileSql).not.toContain('evidence_fingerprint');
    expect(profileValues).toEqual([17, 8]);
    expect(historySql).toContain('policy_identity_evidence_admissions');
    expect(historySql).toContain('authority_policy_id = $1');
    expect(historySql).toContain('library_id = $2');
    expect(historySql).toContain('created_at >= $3');
    expect(historySql).not.toContain('evidence_key');
    expect(historySql).not.toContain('classification_id');
    expect(historySql).not.toContain('source_event_id');
    expect(historyValues).toEqual([17, 8, since]);
  });

  test('does not query secondary evidence tables for a policy that does not exist', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });

    await expect(loadPolicyScopedEvidenceDigestContext({
      db: { query },
      policyId: 17,
      since: new Date('2026-05-18T12:00:00.000Z'),
    })).resolves.toBeNull();

    expect(query).toHaveBeenCalledTimes(1);
  });
});
