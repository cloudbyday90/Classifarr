/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

import { describe, expect, test } from '@jest/globals';

import {
  composePolicyCandidateSemanticReferenceSet,
} from '../../../../scripts/compose-policy-candidate-semantic-reference-set.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION,
} from '../../services/policyCandidateSemanticIndependentReviewConsensus.mjs';

const PROJECT_ROOT = resolve(import.meta.dirname, '../../../..');
const SCRIPT_PATH = resolve(
  PROJECT_ROOT,
  'scripts/compose-policy-candidate-semantic-reference-set.mjs',
);
const FIXTURE_DOCUMENT_FINGERPRINT = `sha256:${'a'.repeat(64)}`;

function submission(submissionId, labels) {
  return {
    fixtureDocumentFingerprint: FIXTURE_DOCUMENT_FINGERPRINT,
    labels,
    submissionId,
    version: POLICY_CANDIDATE_SEMANTIC_REVIEWER_SUBMISSION_VERSION,
  };
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value), 'utf8');
}

describe('composePolicyCandidateSemanticReferenceSet', () => {
  test('writes a completed content-free reference set under ignored .tmp and returns only an aggregate report', async () => {
    const temporaryRoot = await mkdtemp(join(PROJECT_ROOT, '.tmp', 'independent-review-consensus-'));
    const reviewerOnePath = join(temporaryRoot, 'reviewer-one.json');
    const reviewerTwoPath = join(temporaryRoot, 'reviewer-two.json');
    const outputPath = join(temporaryRoot, 'reference-set.json');
    const labels = [{ fixtureId: 'fixture-a', referenceDecisionId: 'review' }];

    try {
      await Promise.all([
        writeJson(reviewerOnePath, submission('reviewer-one-opaque', labels)),
        writeJson(reviewerTwoPath, submission('reviewer-two-opaque', labels)),
      ]);
      const report = await composePolicyCandidateSemanticReferenceSet({
        argv: [
          '--reviewer-one-file', relative(PROJECT_ROOT, reviewerOnePath),
          '--reviewer-two-file', relative(PROJECT_ROOT, reviewerTwoPath),
          '--reference-set-id', 'prospective-reference-set',
          '--output-file', relative(PROJECT_ROOT, outputPath),
        ],
      });

      expect(report.status.id).toBe('complete');
      expect(report.outputWritten).toBe(true);
      expect(JSON.stringify(report)).not.toContain('fixture-a');
      const writtenReferenceSet = JSON.parse(await readFile(outputPath, 'utf8'));
      expect(writtenReferenceSet.labels).toEqual([{
        consensusStatusId: 'unanimous',
        fixtureId: 'fixture-a',
        referenceDecisionId: 'review',
        reviewerCount: 2,
      }]);
      await expect(composePolicyCandidateSemanticReferenceSet({
        argv: [
          '--reviewer-one-file', relative(PROJECT_ROOT, reviewerOnePath),
          '--reviewer-two-file', relative(PROJECT_ROOT, reviewerTwoPath),
          '--reference-set-id', 'prospective-reference-set',
          '--output-file', relative(PROJECT_ROOT, outputPath),
        ],
      })).rejects.toMatchObject({ code: 'EEXIST' });
      expect(JSON.parse(await readFile(outputPath, 'utf8'))).toEqual(writtenReferenceSet);
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  test('does not create an output when a disagreement still needs adjudication', async () => {
    const temporaryRoot = await mkdtemp(join(PROJECT_ROOT, '.tmp', 'independent-review-pending-'));
    const reviewerOnePath = join(temporaryRoot, 'reviewer-one.json');
    const reviewerTwoPath = join(temporaryRoot, 'reviewer-two.json');
    const outputPath = join(temporaryRoot, 'reference-set.json');

    try {
      await Promise.all([
        writeJson(reviewerOnePath, submission('reviewer-one-opaque', [
          { fixtureId: 'fixture-a', referenceDecisionId: 'review' },
        ])),
        writeJson(reviewerTwoPath, submission('reviewer-two-opaque', [
          { fixtureId: 'fixture-a', referenceDecisionId: 'admit' },
        ])),
      ]);
      const result = spawnSync(process.execPath, [
        SCRIPT_PATH,
        '--reviewer-one-file', relative(PROJECT_ROOT, reviewerOnePath),
        '--reviewer-two-file', relative(PROJECT_ROOT, reviewerTwoPath),
        '--reference-set-id', 'prospective-reference-set',
        '--output-file', relative(PROJECT_ROOT, outputPath),
      ], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
      });

      expect(result.status).toBe(2);
      expect(result.stderr).toBe('');
      const report = JSON.parse(result.stdout);
      expect(report).toMatchObject({
        outputWritten: false,
        status: { id: 'adjudication_required' },
      });
      expect(result.stdout).not.toContain('fixture-a');
      await expect(readFile(outputPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  test('rejects an output target outside the project temporary directory', async () => {
    const externalRoot = await mkdtemp(join(tmpdir(), 'classifarr-independent-review-output-'));
    const temporaryRoot = await mkdtemp(join(PROJECT_ROOT, '.tmp', 'independent-review-outside-'));
    const reviewerOnePath = join(temporaryRoot, 'reviewer-one.json');
    const reviewerTwoPath = join(temporaryRoot, 'reviewer-two.json');

    try {
      const labels = [{ fixtureId: 'fixture-a', referenceDecisionId: 'review' }];
      await Promise.all([
        writeJson(reviewerOnePath, submission('reviewer-one-opaque', labels)),
        writeJson(reviewerTwoPath, submission('reviewer-two-opaque', labels)),
      ]);
      await expect(composePolicyCandidateSemanticReferenceSet({
        argv: [
          '--reviewer-one-file', relative(PROJECT_ROOT, reviewerOnePath),
          '--reviewer-two-file', relative(PROJECT_ROOT, reviewerTwoPath),
          '--reference-set-id', 'prospective-reference-set',
          '--output-file', relative(PROJECT_ROOT, join(externalRoot, 'reference-set.json')),
        ],
      })).rejects.toThrow('Output must remain beneath the project temporary directory.');
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
      await rm(externalRoot, { force: true, recursive: true });
    }
  });
});
