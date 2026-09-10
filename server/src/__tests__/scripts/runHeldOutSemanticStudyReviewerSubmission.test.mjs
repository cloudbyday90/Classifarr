/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, jest, test } from '@jest/globals';

import {
  runHeldOutSemanticStudyReviewerSubmission,
} from '../../scripts/runHeldOutSemanticStudyReviewerSubmission.mjs';

const packet = {
  cases: Array.from({ length: 24 }, (_, index) => ({ fixtureId: `fixture_${String(index).padStart(16, '0')}` })),
  fixtureDocumentFingerprint: `sha256:${'a'.repeat(64)}`,
  instructions: {},
  packetId: `review_packet_${'b'.repeat(64)}`,
  studyWindow: { expiresAt: '2026-09-11T12:00:00.000Z', startsAt: '2026-09-09T12:00:00.000Z' },
  version: 'policy.held_out_semantic_study_reviewer_packet.v1',
};

test('creates a private template and reports only an aggregate result', async () => {
  const template = { labels: Array.from({ length: 24 }, () => ({})), sensitive: 'not in report' };
  const readJson = jest.fn(async () => packet);
  const writeJson = jest.fn(async () => undefined);

  const result = await runHeldOutSemanticStudyReviewerSubmission({
    argv: ['create-template', '--packet-file', '.tmp/packet.json', '--output-file', '.tmp/reviewer-one-template.json'],
    buildTemplate: jest.fn(() => template),
    readJson,
    writeJson,
  });

  expect(result).toEqual(expect.objectContaining({
    status: { id: 'template_created' },
    summary: { fixtureCount: 24 },
  }));
  expect(JSON.stringify(result)).not.toContain('not in report');
  expect(writeJson).toHaveBeenCalledWith('.tmp/reviewer-one-template.json', template, {
    label: 'Reviewer submission template',
  });
});

test('finalizes a completed template and refuses malformed arguments before reading a packet', async () => {
  const readJson = jest.fn();
  await expect(runHeldOutSemanticStudyReviewerSubmission({
    argv: ['create-template', '--packet-file', '.tmp/packet.json'],
    readJson,
  })).rejects.toThrow('arguments_invalid');
  expect(readJson).not.toHaveBeenCalled();

  const submission = { labels: Array.from({ length: 24 }, () => ({})), sensitive: 'not in report' };
  readJson.mockResolvedValueOnce(packet).mockResolvedValueOnce({ labels: [] });
  const writeJson = jest.fn(async () => undefined);
  const result = await runHeldOutSemanticStudyReviewerSubmission({
    argv: [
      'finalize-submission',
      '--packet-file', '.tmp/packet.json',
      '--template-file', '.tmp/reviewer-one-template.json',
      '--output-file', '.tmp/reviewer-one.json',
    ],
    finalizeSubmission: jest.fn(() => submission),
    readJson,
    writeJson,
  });

  expect(result.status.id).toBe('submission_created');
  expect(JSON.stringify(result)).not.toContain('not in report');
  expect(writeJson).toHaveBeenCalledWith('.tmp/reviewer-one.json', submission, { label: 'Reviewer submission' });
});

test('runs the private file workflow without copying packet context into the final submission', async () => {
  const temporaryDirectory = '.tmp/reviewer-submission-workflow-test';
  const packetFile = `${temporaryDirectory}/packet.json`;
  const templateFile = `${temporaryDirectory}/reviewer-one-template.json`;
  const submissionFile = `${temporaryDirectory}/reviewer-one.json`;
  const projectRoot = join(process.cwd(), '..');
  const packetPath = join(projectRoot, packetFile);
  const startsAt = new Date(Date.now() - 1_000).toISOString();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const privatePacket = {
    ...packet,
    cases: packet.cases.map((studyCase, index) => ({
      ...studyCase,
      media: { title: `Private source ${index}` },
    })),
    studyWindow: { expiresAt, startsAt },
  };
  await rm(join(projectRoot, temporaryDirectory), { force: true, recursive: true });
  try {
    await mkdir(dirname(packetPath), { recursive: true });
    await writeFile(packetPath, JSON.stringify(privatePacket), 'utf8');
    await expect(runHeldOutSemanticStudyReviewerSubmission({
      argv: ['create-template', '--packet-file', packetFile, '--output-file', templateFile],
    })).resolves.toMatchObject({ status: { id: 'template_created' } });
    const templatePath = join(projectRoot, templateFile);
    const template = JSON.parse(await readFile(templatePath, 'utf8'));
    expect(JSON.stringify(template)).not.toContain('Private source');
    template.labels.forEach((label, index) => {
      label.referenceDecisionId = index % 2 === 0 ? 'admit' : 'review';
    });
    await writeFile(templatePath, JSON.stringify(template), 'utf8');
    await expect(runHeldOutSemanticStudyReviewerSubmission({
      argv: [
        'finalize-submission',
        '--packet-file', packetFile,
        '--template-file', templateFile,
        '--output-file', submissionFile,
      ],
    })).resolves.toMatchObject({ status: { id: 'submission_created' } });
    const submission = await readFile(join(projectRoot, submissionFile), 'utf8');
    expect(submission).not.toContain('Private source');
    expect(submission).not.toContain('media');
  } finally {
    await rm(join(projectRoot, temporaryDirectory), { force: true, recursive: true });
  }
});
