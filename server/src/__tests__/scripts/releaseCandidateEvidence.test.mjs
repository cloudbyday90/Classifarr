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

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { receipt, scheduledRecoveryReceipt, ENV, WORKFLOW } from '../helpers/publishedRoutingFixture.mjs';

import {
  POLICY_RELEASE_ACCEPTANCE_STATUS_IDS,
  buildPolicyReleaseAcceptanceReadout,
} from '../../../../server/src/services/policyReleaseAcceptanceManifest.mjs';
import {
  LEGACY_RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION,
  RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS,
  buildReleaseCandidateEvidence,
  buildReleaseCandidateNotes,
  validateReleaseCandidateEvidence,
} from '../../../../scripts/lib/releaseCandidateEvidence.mjs';
import {
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES,
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID,
  createAiProviderFaultComposeReceipt,
} from '../../../../scripts/lib/aiProviderFaultComposeReceipt.mjs';
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

function createProviderFaultReceipt() {
  return createAiProviderFaultComposeReceipt({
    completedAt: '2026-08-09T04:00:30.000Z',
    outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.PASSED,
    sourceRevision: SOURCE_REVISION,
    statusId: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID,
  });
}

function buildEvidence(overrides = {}) {
  return buildReleaseCandidateEvidence({
    ciReadout: createCiReadout(),
    consumerSmokeEvidence: createConsumerSmokeEvidence(),
    digest: DIGEST,
    generatedAt: GENERATED_AT,
    providerFaultReceipt: createProviderFaultReceipt(),
    publishedRoutingReceipts: [receipt(), receipt('linux/arm64')],
    publishedScheduledRecoveryReceipt: scheduledRecoveryReceipt(TAG),
    workflow: WORKFLOW,
    sourceRevision: SOURCE_REVISION,
    tag: TAG,
    ...overrides,
  });
}

describe('releaseCandidateEvidence', () => {
  test('binds a passed provider-fault receipt, CI readout, and smoke result to immutable images', () => {
    const evidence = buildEvidence();

    expect(evidence).toEqual(expect.objectContaining({
      images: {
        dockerHub: `docker.io/cloudbyday90/classifarr@${DIGEST}`,
        ghcr: `ghcr.io/cloudbyday90/classifarr@${DIGEST}`,
      },
      provider_fault_receipt: expect.objectContaining({
        outcome: 'passed',
        receiptFingerprint: {
          algorithm: 'sha256',
          value: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        },
        sourceRevision: SOURCE_REVISION,
        statusId: 'passed',
      }),
      schema_version: 'classifarr.release.candidate-evidence.v4',
      published_scheduled_recovery: scheduledRecoveryReceipt(TAG),
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
    expect(buildReleaseCandidateNotes(evidence)).toContain('Provider-fault receipt:');
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

  test('rejects a failed or source-mismatched provider-fault receipt before creating evidence', () => {
    const failedReceipt = createAiProviderFaultComposeReceipt({
      completedAt: '2026-08-09T04:00:30.000Z',
      outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.FAILED,
      sourceRevision: SOURCE_REVISION,
      statusId: 'test_failed',
    });

    expect(() => buildEvidence({ providerFaultReceipt: failedReceipt })).toThrow(
      RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.PROVIDER_FAULT_RECEIPT_INVALID
    );

    expect(() => buildEvidence({
      providerFaultReceipt: createAiProviderFaultComposeReceipt({
        completedAt: '2026-08-09T04:00:30.000Z',
        outcome: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.PASSED,
        sourceRevision: 'fedcba9876543210fedcba9876543210fedcba98',
        statusId: AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID,
      }),
    })).toThrow(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.PROVIDER_FAULT_RECEIPT_INVALID);
  });

  test('accepts an immutable legacy v1 record but rejects extra public receipt data in v4', () => {
    const legacyPayload = buildEvidence();
    delete legacyPayload.provider_fault_receipt;
    delete legacyPayload.published_routing;
    delete legacyPayload.published_scheduled_recovery;
    delete legacyPayload.evidence_fingerprint;
    legacyPayload.schema_version = LEGACY_RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION;
    const legacyEvidence = {
      ...legacyPayload,
      evidence_fingerprint: {
        algorithm: 'sha256',
        value: `sha256:${createHash('sha256')
          .update(JSON.stringify(legacyPayload))
          .digest('hex')}`,
      },
    };
    expect(validateReleaseCandidateEvidence(legacyEvidence)).toEqual(expect.objectContaining({ ok: true }));

    const expandedEvidence = buildEvidence();
    expandedEvidence.provider_fault_receipt.provider_response = 'must never become release evidence';
    expect(validateReleaseCandidateEvidence(expandedEvidence)).toEqual(expect.objectContaining({
      issues: expect.arrayContaining(['unexpected_provider_fault_receipt_summary_fields']),
      ok: false,
    }));
  });

  test('writes evidence and notes only under its fixed temporary release directory', () => {
    const cwd = fs.mkdtempSync(join(os.tmpdir(), 'classifarr-release-candidate-'));
    const ciPath = join(cwd, 'ci-readout.json');
    const smokePath = join(cwd, 'consumer-smoke.json');
    const providerFaultReceiptPath = join(cwd, 'provider-fault-receipt.json');
    fs.writeFileSync(ciPath, JSON.stringify(createCiReadout()));
    fs.writeFileSync(smokePath, JSON.stringify(createConsumerSmokeEvidence()));
    fs.writeFileSync(providerFaultReceiptPath, JSON.stringify(createProviderFaultReceipt()));
    fs.writeFileSync(join(cwd, 'amd64.json'), JSON.stringify(receipt()));
    fs.writeFileSync(join(cwd, 'arm64.json'), JSON.stringify(receipt('linux/arm64')));
    const scheduledPath = join(cwd, 'scheduled.json');
    fs.writeFileSync(scheduledPath, JSON.stringify(scheduledRecoveryReceipt(TAG)));
    fs.writeFileSync(join(cwd, 'RELEASE_NOTES.md'), `# Release Notes\n\n## ${TAG}\n\nReviewed upgrade guidance.\n\n## v0.47.5-beta\n\nOlder prose.`);

    try {
      const args = [
        '--tag', TAG,
        '--source-revision', SOURCE_REVISION,
        '--digest', DIGEST,
        '--ci-readout', 'ci-readout.json',
        '--consumer-smoke', 'consumer-smoke.json',
        '--provider-fault-receipt', 'provider-fault-receipt.json',
        '--routing-amd64', 'amd64.json',
        '--routing-arm64', 'arm64.json',
        '--scheduled-recovery-arm64', 'scheduled.json',
      ];
      const options = {
        cwd,
        env: ENV,
        now: () => new Date(GENERATED_AT),
      };
      const result = assembleReleaseCandidateEvidence(args, options);

      expect(result.outputPaths.evidencePath).toBe(join(cwd, '.tmp', 'release-candidate', `${TAG}-evidence.json`));
      expect(result.outputPaths.notesPath).toBe(join(cwd, '.tmp', 'release-candidate', `${TAG}-notes.md`));
      expect(JSON.parse(fs.readFileSync(result.outputPaths.evidencePath, 'utf8')))
        .toEqual(result.evidence);
      expect(fs.readFileSync(result.outputPaths.notesPath, 'utf8')).toContain(`# Classifarr ${TAG}`);
      expect(fs.readFileSync(result.outputPaths.notesPath, 'utf8')).toContain('Reviewed upgrade guidance.');
      expect(fs.readFileSync(result.outputPaths.notesPath, 'utf8')).toContain('## Release evidence');
      expect(fs.readFileSync(result.outputPaths.notesPath, 'utf8')).not.toContain('Older prose.');

      fs.rmSync(result.outputPaths.notesPath);
      fs.rmSync(result.outputPaths.evidencePath);
      fs.rmSync(scheduledPath);
      expect(() => assembleReleaseCandidateEvidence(args, options)).toThrow('release_artifact_unreadable');
      expect(fs.existsSync(result.outputPaths.evidencePath)).toBe(false);

      fs.writeFileSync(scheduledPath, JSON.stringify({ ...scheduledRecoveryReceipt(TAG), workflow: { ...WORKFLOW, runAttempt: '1' } }));
      expect(() => assembleReleaseCandidateEvidence(args, options)).toThrow('published_scheduled_recovery_invalid');
      expect(fs.existsSync(result.outputPaths.evidencePath)).toBe(false);

      fs.writeFileSync(scheduledPath, JSON.stringify(scheduledRecoveryReceipt(TAG)));
      fs.writeFileSync(join(cwd, 'RELEASE_NOTES.md'), '## v9.9.9\nWrong version.');
      expect(() => assembleReleaseCandidateEvidence(args, options)).toThrow('release_notes_version_mismatch');
      expect(fs.existsSync(result.outputPaths.evidencePath)).toBe(false);
      expect(fs.existsSync(result.outputPaths.notesPath)).toBe(false);
    } finally {
      fs.rmSync(cwd, { force: true, recursive: true });
    }
  });

  test('requires the provider-fault receipt argument before reading artifacts', () => {
    expect(() => assembleReleaseCandidateEvidence([
      '--tag', TAG,
      '--source-revision', SOURCE_REVISION,
      '--digest', DIGEST,
      '--ci-readout', 'ci-readout.json',
      '--consumer-smoke', 'consumer-smoke.json',
    ])).toThrow(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.INVALID_INPUT);
  });

  test('keeps immutable v2 fingerprints verifiable without authorizing new v2 creation', () => {
    const value = buildEvidence();
    delete value.published_routing;
    delete value.published_scheduled_recovery;
    delete value.evidence_fingerprint;
    value.schema_version = 'classifarr.release.candidate-evidence.v2';
    const legacy = { ...value, evidence_fingerprint: { algorithm: 'sha256', value: `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}` } };
    expect(validateReleaseCandidateEvidence(legacy).ok).toBe(true);
    expect(buildReleaseCandidateNotes(legacy)).toContain('Provider-fault receipt:');
    expect(() => buildEvidence({ publishedRoutingReceipts: undefined })).toThrow('published_routing_invalid');
    expect(() => buildEvidence({ workflow: { ...WORKFLOW, runAttempt: '3' } })).toThrow('published_routing_invalid');
  });

  test.each([
    value => { value.status = 'blocked'; },
    value => { value.tag = 'v9.9.9'; },
    value => { value.workflow.runId = '456'; },
    value => { value.workflow.runAttempt = '1'; },
    value => { value.subject = receipt('linux/amd64').subject; },
    value => { value.subject.sourceRevision = 'b'.repeat(40); },
    value => { value.subject.image = `ghcr.io/cloudbyday90/classifarr@sha256:${'b'.repeat(64)}`; },
    value => { value.subject.manifestDigest = `sha256:${'f'.repeat(64)}`; },
    value => { value.subject.configDigest = `sha256:${'f'.repeat(64)}`; },
    value => { value.subject.imageId = `sha256:${'f'.repeat(64)}`; },
    value => { value.completedAt = '2026-08-09T03:59:59.000Z'; },
    value => { value.completedAt = '2026-08-09T04:05:01.000Z'; },
    value => { value.crashRecovery.routingTasks = 1; },
    value => { value.crashRecovery.completedTasks = 0; },
    value => { value.cleanup = 'not_verified'; },
    value => { value.rawLog = 'private'; },
  ])('rejects mismatched scheduled evidence during assembly and signed record validation', mutate => {
    const scheduled = scheduledRecoveryReceipt(TAG);
    mutate(scheduled);
    expect(() => buildEvidence({ publishedScheduledRecoveryReceipt: scheduled })).toThrow('published_scheduled_recovery_invalid');
    const evidence = buildEvidence();
    delete evidence.evidence_fingerprint;
    evidence.published_scheduled_recovery = scheduled;
    evidence.evidence_fingerprint = { algorithm: 'sha256', value: `sha256:${createHash('sha256').update(JSON.stringify(evidence)).digest('hex')}` };
    expect(validateReleaseCandidateEvidence(evidence).issues).toContain('invalid_published_scheduled_recovery');
  });

  test('requires scheduled evidence independently of passing routing and smoke', () => {
    expect(() => buildEvidence({ publishedScheduledRecoveryReceipt: undefined })).toThrow('published_scheduled_recovery_invalid');
    expect(buildReleaseCandidateNotes(buildEvidence())).toContain('Published scheduled recovery linux/arm64: passed');
  });

  test('routing is required even if an attacker recomputes the public fingerprint', () => {
    const value = buildEvidence();
    delete value.evidence_fingerprint;
    value.published_routing[0].routing.providerWrites = 1;
    value.evidence_fingerprint = { algorithm: 'sha256', value: `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}` };
    expect(validateReleaseCandidateEvidence(value).issues).toContain('invalid_published_routing');
    expect(() => buildReleaseCandidateNotes(value)).toThrow();
  });
});
