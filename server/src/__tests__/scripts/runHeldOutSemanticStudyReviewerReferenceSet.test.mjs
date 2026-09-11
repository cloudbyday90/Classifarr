/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, jest, test } from '@jest/globals';

import {
  runHeldOutSemanticStudyReviewerReferenceSet,
} from '../../scripts/runHeldOutSemanticStudyReviewerReferenceSet.mjs';

const completeResult = {
  referenceSetDocument: { sensitive: 'never reported' },
  status: { id: 'complete' },
  summary: {
    adjudicatedFixtureCount: 0,
    disagreementFixtureCount: 0,
    fixtureCount: 24,
    unanimousFixtureCount: 24,
  },
};

const validArguments = [
  '--packet-file', '.tmp/packet.json',
  '--reviewer-one-file', '.tmp/reviewer-one.json',
  '--reviewer-two-file', '.tmp/reviewer-two.json',
  '--output-file', '.tmp/reference-set.json',
];

test('writes only a complete reference set and emits an aggregate-only receipt', async () => {
  const readJson = jest.fn(async () => ({}));
  const writeJson = jest.fn(async () => undefined);

  const result = await runHeldOutSemanticStudyReviewerReferenceSet({
    argv: validArguments,
    composeReferenceSet: jest.fn(() => completeResult),
    readJson,
    writeJson,
  });

  expect(result).toEqual({
    referenceSetWritten: true,
    status: { id: 'complete' },
    summary: completeResult.summary,
    version: 'policy.held_out_semantic_study_reviewer_reference_set_workflow.v1',
  });
  expect(JSON.stringify(result)).not.toContain('never reported');
  expect(writeJson).toHaveBeenCalledWith('.tmp/reference-set.json', completeResult.referenceSetDocument, {
    label: 'Reviewer reference set',
  });
  expect(readJson).toHaveBeenCalledTimes(3);
});

test('does not write a partial reference set while adjudication is required', async () => {
  const writeJson = jest.fn();
  const result = await runHeldOutSemanticStudyReviewerReferenceSet({
    argv: validArguments,
    composeReferenceSet: jest.fn(() => ({
      ...completeResult,
      referenceSetDocument: null,
      status: { id: 'adjudication_required' },
    })),
    readJson: jest.fn(async () => ({})),
    writeJson,
  });

  expect(result.referenceSetWritten).toBe(false);
  expect(writeJson).not.toHaveBeenCalled();
});

test('rejects invalid arguments before reading a private document', async () => {
  const readJson = jest.fn();

  await expect(runHeldOutSemanticStudyReviewerReferenceSet({
    argv: ['--packet-file', '.tmp/packet.json'],
    readJson,
  })).rejects.toThrow('arguments_invalid');
  expect(readJson).not.toHaveBeenCalled();
});

test('does not treat a write permission error as an existing validated reference set', async () => {
  const readJson = jest.fn(async () => ({}));
  const failure = Object.assign(new Error('permission denied'), { code: 'EACCES' });
  await expect(runHeldOutSemanticStudyReviewerReferenceSet({
    argv: validArguments,
    composeReferenceSet: jest.fn(() => completeResult),
    readJson,
    writeJson: jest.fn(async () => { throw failure; }),
  })).rejects.toBe(failure);
  expect(readJson).toHaveBeenCalledTimes(3);
});

test('rejects an unreadable existing reference set instead of trusting its existence', async () => {
  const readJson = jest.fn(async (file) => {
    if (file === '.tmp/reference-set.json') throw new Error('invalid private JSON');
    return {};
  });
  await expect(runHeldOutSemanticStudyReviewerReferenceSet({
    argv: validArguments,
    composeReferenceSet: jest.fn(() => completeResult),
    readJson,
    writeJson: jest.fn(async () => { throw Object.assign(new Error('exists'), { code: 'EEXIST' }); }),
  })).rejects.toThrow('invalid private JSON');
});

test('writes an exact completed document through the real private-file boundary without packet context', async () => {
  const temporaryDirectory = '.tmp/reviewer-reference-set-workflow-test';
  const packetFile = `${temporaryDirectory}/packet.json`;
  const reviewerOneFile = `${temporaryDirectory}/reviewer-one.json`;
  const reviewerTwoFile = `${temporaryDirectory}/reviewer-two.json`;
  const outputFile = `${temporaryDirectory}/reference-set.json`;
  const projectRoot = join(process.cwd(), '..');
  const fixtureDocumentFingerprint = `sha256:${'a'.repeat(64)}`;
  const labels = Array.from({ length: 24 }, (_, index) => ({
    fixtureId: `fixture_${String(index).padStart(16, '0')}`,
    referenceDecisionId: index % 2 === 0 ? 'admit' : 'review',
  }));
  const submission = (submissionId) => ({
    fixtureDocumentFingerprint,
    labels,
    submissionId,
    version: 'policy.candidate_semantic_reviewer_submission.v1',
  });
  const packet = {
    cases: labels.map((label, index) => ({
      fixtureId: label.fixtureId,
      media: { title: `Private packet title ${index}` },
    })),
    fixtureDocumentFingerprint,
    instructions: { boundary: 'Private reviewer context.' },
    packetId: `review_packet_${'b'.repeat(64)}`,
    studyWindow: {
      expiresAt: '2026-09-11T12:00:00.000Z',
      startsAt: '2026-09-10T12:00:00.000Z',
    },
    version: 'policy.held_out_semantic_study_reviewer_packet.v1',
  };

  await rm(join(projectRoot, temporaryDirectory), { force: true, recursive: true });
  try {
    await mkdir(dirname(join(projectRoot, packetFile)), { recursive: true });
    await Promise.all([
      writeFile(join(projectRoot, packetFile), JSON.stringify(packet), 'utf8'),
      writeFile(join(projectRoot, reviewerOneFile), JSON.stringify(submission('reviewer_one')), 'utf8'),
      writeFile(join(projectRoot, reviewerTwoFile), JSON.stringify(submission('reviewer_two')), 'utf8'),
    ]);
    await expect(runHeldOutSemanticStudyReviewerReferenceSet({
      argv: [
        '--packet-file', packetFile,
        '--reviewer-one-file', reviewerOneFile,
        '--reviewer-two-file', reviewerTwoFile,
        '--output-file', outputFile,
      ],
    })).resolves.toMatchObject({
      referenceSetWritten: true,
      status: { id: 'complete' },
      summary: { fixtureCount: 24 },
    });
    const output = await readFile(join(projectRoot, outputFile), 'utf8');
    expect(output).not.toContain('Private packet title');
    expect(output).not.toContain('media');
    expect(JSON.parse(output)).toMatchObject({
      fixtureDocumentFingerprint,
      labelingProtocolId: 'independent_double_blind_human.v1',
      labels: expect.any(Array),
    });
  } finally {
    await rm(join(projectRoot, temporaryDirectory), { force: true, recursive: true });
  }
});
