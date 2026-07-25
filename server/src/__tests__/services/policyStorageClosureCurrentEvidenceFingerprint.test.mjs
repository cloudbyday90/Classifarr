/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_STATUS_IDS,
  buildPolicyStorageClosureCurrentEvidenceFingerprint,
  validatePolicyStorageClosureCurrentEvidenceFingerprint,
} from '../../services/policyStorageClosureCurrentEvidenceFingerprint.mjs';

function readTextFile(filePath) {
  return `content:${filePath.replace(/\\/g, '/')}`;
}

describe('policyStorageClosureCurrentEvidenceFingerprint', () => {
  test('binds mapped artifact, roadmap, and changelog contents in stable path order', () => {
    const options = {
      cwd: '/repo',
      roadmapPath: 'docs/roadmap.md',
      roadmapContent: 'roadmap',
      changelogPath: 'CHANGELOG.md',
      changelogContent: 'changelog',
      readTextFile,
    };
    const first = buildPolicyStorageClosureCurrentEvidenceFingerprint({
      ...options,
      artifactPaths: ['server/b.mjs', '.\\server\\a.mjs', 'server/b.mjs'],
    });
    const second = buildPolicyStorageClosureCurrentEvidenceFingerprint({
      ...options,
      artifactPaths: ['server/a.mjs', 'server/b.mjs'],
    });

    expect(first).toEqual(second);
    expect(first).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_STATUS_IDS.COMPLETE,
      complete: true,
      artifactPathCount: 2,
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  test('changes the fingerprint when a mapped artifact content changes', () => {
    const options = {
      cwd: '/repo',
      artifactPaths: ['server/a.mjs'],
      roadmapPath: 'docs/roadmap.md',
      roadmapContent: 'roadmap',
      changelogPath: 'CHANGELOG.md',
      changelogContent: 'changelog',
    };
    const original = buildPolicyStorageClosureCurrentEvidenceFingerprint({
      ...options,
      readTextFile: () => 'original',
    });
    const changed = buildPolicyStorageClosureCurrentEvidenceFingerprint({
      ...options,
      readTextFile: () => 'changed',
    });

    expect(changed.fingerprint).not.toBe(original.fingerprint);
  });

  test('reports incomplete evidence when a mapped artifact cannot be read', () => {
    const evidence = buildPolicyStorageClosureCurrentEvidenceFingerprint({
      cwd: '/repo',
      artifactPaths: ['server/a.mjs', 'server/missing.mjs'],
      roadmapPath: 'docs/roadmap.md',
      roadmapContent: 'roadmap',
      changelogPath: 'CHANGELOG.md',
      changelogContent: 'changelog',
      readTextFile: filePath => {
        if (filePath.endsWith('missing.mjs')) throw new Error('not found');
        return 'present';
      },
    });

    expect(evidence).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_STATUS_IDS.INCOMPLETE,
      complete: false,
      missingArtifactPaths: ['server/missing.mjs'],
    }));
  });

  test('rejects malformed or status-inconsistent fingerprint evidence', () => {
    const validation = validatePolicyStorageClosureCurrentEvidenceFingerprint({
      currentEvidenceFingerprint: {
        version: 'legacy',
        algorithm: 'sha1',
        statusId: POLICY_STORAGE_CLOSURE_CURRENT_EVIDENCE_FINGERPRINT_STATUS_IDS.COMPLETE,
        complete: false,
        artifactPathCount: -1,
        missingArtifactPaths: null,
        fingerprint: 'not-a-digest',
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issueCount).toBe(4);
  });
});
