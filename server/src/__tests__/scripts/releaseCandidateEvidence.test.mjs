/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

import {
  POLICY_RELEASE_ACCEPTANCE_STATUS_IDS,
  buildPolicyReleaseAcceptanceReadout,
} from '../../../../server/src/services/policyReleaseAcceptanceManifest.mjs';
import {
  RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS,
  buildReleaseCandidateEvidence,
  buildReleaseCandidateNotes,
  validateReleaseCandidateEvidence,
} from '../../../../scripts/lib/releaseCandidateEvidence.mjs';
import {
  assembleReleaseCandidateEvidence,
} from '../../../../scripts/assemble-release-candidate-evidence.mjs';

const SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567';
const DIGEST = `sha256:${'a'.repeat(64)}`;
const TAG = 'v0.47.6-beta';
const GENERATED_AT = '2026-08-09T04:00:00.000Z';

function createCiReadout() {
  return buildPolicyReleaseAcceptanceReadout({
    generatedAt: GENERATED_AT,
    isolatedRuntimeAcceptanceStatusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED,
    modeId: 'ci',
    repositoryValidationStatusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED,
    sourceRevision: SOURCE_REVISION,
  });
}

function createConsumerSmokeEvidence() {
  return {
    checks: {
      compose_configuration: 'validated',
      compose_startup: 'healthy',
      migration_readiness: 'ready',
      provenance: 'verified',
      runtime_health: 'healthy',
      teardown: 'completed',
    },
    completed_at: '2026-08-09T04:01:00.000Z',
    image: `ghcr.io/cloudbyday90/classifarr@${DIGEST}`,
    schema_version: 'classifarr.release.published-digest-consumer-smoke.v1',
    signer_workflow: 'cloudbyday90/Classifarr/.github/workflows/ci.yml',
    source_repository: 'cloudbyday90/Classifarr',
    source_revision: SOURCE_REVISION,
  };
}

function buildEvidence(overrides = {}) {
  return buildReleaseCandidateEvidence({
    ciReadout: createCiReadout(),
    consumerSmokeEvidence: createConsumerSmokeEvidence(),
    digest: DIGEST,
    generatedAt: GENERATED_AT,
    sourceRevision: SOURCE_REVISION,
    tag: TAG,
    ...overrides,
  });
}

describe('releaseCandidateEvidence', () => {
  test('binds a passed CI readout and verified smoke result to both immutable image subjects', () => {
    const evidence = buildEvidence();

    expect(evidence).toEqual(expect.objectContaining({
      images: {
        dockerHub: `docker.io/cloudbyday90/classifarr@${DIGEST}`,
        ghcr: `ghcr.io/cloudbyday90/classifarr@${DIGEST}`,
      },
      schema_version: 'classifarr.release.candidate-evidence.v1',
      source_repository: 'cloudbyday90/Classifarr',
      source_revision: SOURCE_REVISION,
      tag: TAG,
    }));
    expect(evidence.evidence_fingerprint).toEqual({
      algorithm: 'sha256',
      value: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
    expect(validateReleaseCandidateEvidence(evidence)).toEqual({
      evidence: { digest: DIGEST, sourceRevision: SOURCE_REVISION, tag: TAG },
      issueCount: 0,
      issues: [],
      ok: true,
    });
    expect(buildReleaseCandidateNotes(evidence)).toContain(`GHCR image: \`ghcr.io/cloudbyday90/classifarr@${DIGEST}\``);
  });

  test('rejects consumer smoke evidence from another source revision before constructing a release record', () => {
    const consumerSmokeEvidence = createConsumerSmokeEvidence();
    consumerSmokeEvidence.source_revision = 'fedcba9876543210fedcba9876543210fedcba98';

    expect(() => buildEvidence({ consumerSmokeEvidence })).toThrow(
      RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.CONSUMER_SMOKE_INVALID
    );
  });

  test('rejects a blocked CI readout even when its supplied validation object claims success', () => {
    const ciReadout = createCiReadout();
    ciReadout.statusId = 'blocked';
    ciReadout.complete = false;
    ciReadout.validation = { ok: true };

    expect(() => buildEvidence({ ciReadout })).toThrow(
      RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.CI_ACCEPTANCE_INVALID
    );
  });

  test('detects post-generation evidence tampering', () => {
    const evidence = buildEvidence();
    evidence.images.ghcr = `ghcr.io/cloudbyday90/classifarr@sha256:${'b'.repeat(64)}`;

    expect(validateReleaseCandidateEvidence(evidence)).toEqual(expect.objectContaining({
      issues: expect.arrayContaining(['invalid_evidence_fingerprint']),
      ok: false,
    }));
  });

  test('writes evidence and notes only under its fixed temporary release directory', () => {
    const cwd = fs.mkdtempSync(join(os.tmpdir(), 'classifarr-release-candidate-'));
    const ciPath = join(cwd, 'ci-readout.json');
    const smokePath = join(cwd, 'consumer-smoke.json');
    fs.writeFileSync(ciPath, JSON.stringify(createCiReadout()));
    fs.writeFileSync(smokePath, JSON.stringify(createConsumerSmokeEvidence()));

    try {
      const result = assembleReleaseCandidateEvidence([
        '--tag', TAG,
        '--source-revision', SOURCE_REVISION,
        '--digest', DIGEST,
        '--ci-readout', 'ci-readout.json',
        '--consumer-smoke', 'consumer-smoke.json',
      ], {
        cwd,
        now: () => new Date(GENERATED_AT),
      });

      expect(result.outputPaths.evidencePath).toBe(join(cwd, '.tmp', 'release-candidate', `${TAG}-evidence.json`));
      expect(result.outputPaths.notesPath).toBe(join(cwd, '.tmp', 'release-candidate', `${TAG}-notes.md`));
      expect(JSON.parse(fs.readFileSync(result.outputPaths.evidencePath, 'utf8')))
        .toEqual(result.evidence);
      expect(fs.readFileSync(result.outputPaths.notesPath, 'utf8')).toContain(`# Classifarr ${TAG}`);
    } finally {
      fs.rmSync(cwd, { force: true, recursive: true });
    }
  });
});
